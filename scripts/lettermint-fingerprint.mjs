import { createHash } from 'node:crypto'
import { readFile, rename, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const registryPath = fileURLToPath(
  new URL('../src/features/transactionalEmail/lettermintRegistry.json', import.meta.url),
)
const targetLockPath = fileURLToPath(
  new URL('../src/features/transactionalEmail/lettermintTargetLocks.json', import.meta.url),
)
const kinds = new Set(['project-token', 'webhook-current', 'webhook-previous', 'digest-key'])

function fail() {
  throw new Error('Invalid Lettermint fingerprint setup')
}

function validTime(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value
}

function checkedTarget(registry, environment, locks) {
  if (!registry || !Array.isArray(registry.targets) || !Array.isArray(registry.fingerprints)) fail()
  if (!locks || !Array.isArray(locks.targets)) fail()
  const matching = registry.targets.filter((target) => target.environment === environment)
  const pinned = locks.targets.filter((target) => target.environment === environment)
  if (matching.length !== 1 || pinned.length !== 1) fail()
  const target = matching[0]
  if (
    !Object.hasOwn(target, 'activatedTarget') ||
    ['teamId', 'projectId', 'routeId', 'webhookId', 'senderEvidenceId', 'digestKeyId'].some(
      (field) => typeof target[field] !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(target[field]),
    ) ||
    ['teamId', 'projectId', 'routeId'].some((field) => target[field] !== pinned[0][field]) ||
    (target.activatedTarget &&
      ['teamId', 'projectId', 'routeId'].some((field) => target[field] !== target.activatedTarget[field]))
  )
    fail()
  return target
}

export function recordFingerprint(registry, options, credential, locks) {
  const { environment, kind, startsAt, validUntil } = options
  if (!['preview', 'production'].includes(environment) || !kinds.has(kind)) fail()
  if (typeof credential !== 'string' || !credential || credential !== credential.trim() || /[\r\n\0]/.test(credential))
    fail()
  if (kind === 'project-token' && !/^lm_[A-Za-z0-9_-]{16,}$/.test(credential)) fail()
  if (kind !== 'project-token' && (credential.length < 16 || credential.length > 1024)) fail()
  const target = checkedTarget(registry, environment, locks)
  const overlap = kind === 'webhook-previous' ? { startsAt, validUntil } : null
  if (kind === 'webhook-previous') {
    if (!validTime(startsAt) || !validTime(validUntil)) fail()
    const duration = Date.parse(validUntil) - Date.parse(startsAt)
    if (duration <= 0 || duration > 600_000) fail()
  } else if (startsAt || validUntil) fail()
  const sha256 = createHash('sha256').update(credential, 'utf8').digest('hex')
  if (
    registry.fingerprints.some(
      (entry) => entry.sha256 === sha256 && (entry.environment !== environment || entry.kind !== kind),
    )
  )
    fail()
  const entry = {
    environment,
    kind,
    bindingId: `${kind}-${environment}`,
    sha256,
    teamId: target.teamId,
    projectId: target.projectId,
    routeId: target.routeId,
    webhookId: kind.startsWith('webhook-') ? target.webhookId : null,
    overlap,
  }
  return {
    ...registry,
    targets: registry.targets.map((current) =>
      current.environment === environment
        ? {
            ...current,
            activatedTarget: current.activatedTarget ?? {
              teamId: current.teamId,
              projectId: current.projectId,
              routeId: current.routeId,
            },
          }
        : current,
    ),
    fingerprints: [
      ...registry.fingerprints.filter((current) => current.environment !== environment || current.kind !== kind),
      entry,
    ],
  }
}

export async function recordFingerprintFile(path, options, credential, locks) {
  const registry = JSON.parse(await readFile(path, 'utf8'))
  const updated = recordFingerprint(registry, options, credential, locks)
  const temporary = `${path}.${process.pid}.tmp`
  try {
    await writeFile(temporary, `${JSON.stringify(updated, null, 2)}\n`, { mode: 0o600, flag: 'wx' })
    await rename(temporary, path)
  } catch {
    throw new Error('Could not record Lettermint fingerprint')
  }
}

export function readConcealedInput(input = process.stdin, output = process.stdout) {
  if (!input.isTTY || typeof input.setRawMode !== 'function') fail()
  return new Promise((resolve, reject) => {
    let value = ''
    let finished = false
    const complete = (error) => {
      if (finished) return
      finished = true
      input.setRawMode(false)
      input.pause()
      input.off('data', onData)
      output.write('\n')
      if (error) reject(error)
      else resolve(value)
    }
    const onData = (chunk) => {
      for (const character of String(chunk)) {
        if (character === '\u0003') return complete(new Error('Cancelled'))
        if (character === '\r' || character === '\n') return complete()
        if (character === '\u007f' || character === '\b') value = value.slice(0, -1)
        else if (character >= ' ' && value.length < 4096) value += character
      }
    }
    output.write('Credential (hidden): ')
    input.setRawMode(true)
    input.resume()
    input.on('data', onData)
  })
}

function parseOptions(args) {
  const options = {}
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index]
    const value = args[index + 1]
    if (!['--environment', '--kind', '--starts-at', '--valid-until'].includes(key) || !value) fail()
    options[
      { '--environment': 'environment', '--kind': 'kind', '--starts-at': 'startsAt', '--valid-until': 'validUntil' }[
        key
      ]
    ] = value
  }
  return options
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const options = parseOptions(process.argv.slice(2))
    const locks = JSON.parse(await readFile(targetLockPath, 'utf8'))
    checkedTarget(JSON.parse(await readFile(registryPath, 'utf8')), options.environment, locks)
    const credential = await readConcealedInput()
    await recordFingerprintFile(registryPath, options, credential, locks)
    process.stdout.write('Fingerprint recorded.\n')
  } catch {
    process.stderr.write('Lettermint fingerprint setup failed.\n')
    process.exitCode = 1
  }
}
