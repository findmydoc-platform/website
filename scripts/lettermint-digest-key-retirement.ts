import { readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createLocalReq, getPayload, type PayloadRequest } from 'payload'
import {
  DigestKeyRetirementBlockedError,
  retireDigestKey,
  type DigestKeyRetirementApproval,
} from '../src/features/transactionalEmail/digestKeyRotation'

const registryPath = fileURLToPath(
  new URL('../src/features/transactionalEmail/lettermintRegistry.json', import.meta.url),
)

type RetirementOptions = {
  environment: 'preview' | 'production'
  version: string
}
type DigestKeyRetirementRuntime = {
  open(): Promise<{ req: PayloadRequest; close(): Promise<void> }>
  registryPath: string
  write(value: string): void
}

function fail(): never {
  throw new Error('Invalid digest-key retirement request')
}

export function parseDigestKeyRetirementArgs(argv: string[]): RetirementOptions {
  const args = argv.filter((arg) => arg !== '--')
  const options: Partial<RetirementOptions> = {}
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index]
    const value = args[index + 1]
    if (!value || !['--environment', '--version'].includes(key ?? '')) fail()
    if (key === '--environment') {
      if (value !== 'preview' && value !== 'production') fail()
      options.environment = value
    } else if (/^[A-Za-z0-9_-]{1,128}$/.test(value)) options.version = value
    else fail()
  }
  if (args.length !== 4 || !options.environment || !options.version) fail()
  return options as RetirementOptions
}

export async function removeApprovedDigestFingerprintFile(path: string, approval: DigestKeyRetirementApproval) {
  const temporary = `${path}.${process.pid}.tmp`
  try {
    const raw = await readFile(path, 'utf8')
    const registry: unknown = JSON.parse(raw)
    if (!registry || typeof registry !== 'object') throw new Error()
    const candidate = registry as {
      targets?: unknown[]
      fingerprints?: Record<string, unknown>[]
    }
    if (!Array.isArray(candidate.targets) || !Array.isArray(candidate.fingerprints)) throw new Error()
    const target = candidate.targets.filter(
      (entry): entry is Record<string, unknown> =>
        Boolean(entry) &&
        typeof entry === 'object' &&
        (entry as Record<string, unknown>).environment === approval.environment,
    )
    const matches = candidate.fingerprints.filter(
      (entry) =>
        entry.environment === approval.environment &&
        entry.kind === 'digest-key' &&
        entry.digestKeyId === approval.version &&
        entry.bindingId === approval.fingerprint.bindingId &&
        entry.sha256 === approval.fingerprint.sha256,
    )
    if (
      target.length !== 1 ||
      target[0]!.digestKeyId === approval.version ||
      approval.fingerprint.version !== approval.version ||
      matches.length !== 1
    )
      throw new Error()
    const updated = {
      ...candidate,
      fingerprints: candidate.fingerprints.filter((entry) => entry !== matches[0]),
    }
    const mode = (await stat(path)).mode & 0o777
    await writeFile(temporary, `${JSON.stringify(updated, null, 2)}\n`, { flag: 'wx', mode })
    await rename(temporary, path)
  } catch {
    await rm(temporary, { force: true }).catch(() => undefined)
    throw new Error('Digest-key retirement failed')
  }
}

export function formatDigestKeyRetirementFailure(error: unknown) {
  if (error instanceof DigestKeyRetirementBlockedError) {
    const { environment, version, outboxRecords, suppressionRecords, previewAllowlistEntries } = error.evidence
    return `Digest-key retirement blocked: environment=${environment} version=${version} outbox=${outboxRecords} suppressions=${suppressionRecords} previewAllowlist=${previewAllowlistEntries}.`
  }
  return 'Digest-key retirement failed.'
}

async function defaultRuntime(): Promise<DigestKeyRetirementRuntime> {
  const { default: config } = await import('../src/payload.config')
  const payload = await getPayload({ config })
  return {
    registryPath,
    write: (value) => process.stdout.write(value),
    open: async () => ({
      req: await createLocalReq({}, payload),
      close: () => payload.destroy(),
    }),
  }
}

export async function runDigestKeyRetirement(argv: string[], injectedRuntime?: DigestKeyRetirementRuntime) {
  const options = parseDigestKeyRetirementArgs(argv)
  const runtime = injectedRuntime ?? (await defaultRuntime())
  const session = await runtime.open()
  try {
    const evidence = await retireDigestKey(session.req, options.environment, options.version, (approval) =>
      removeApprovedDigestFingerprintFile(runtime.registryPath, approval),
    )
    runtime.write(
      `Digest key fingerprint removed: environment=${evidence.environment} version=${evidence.version} outbox=0 suppressions=0 previewAllowlist=0. Remove the matching previous secret and approve the updated activation preflight before deployment.\n`,
    )
  } finally {
    await session.close().catch(() => undefined)
  }
}

const entryPoint = process.argv[1]
if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  runDigestKeyRetirement(process.argv.slice(2)).catch((error: unknown) => {
    process.stderr.write(`${formatDigestKeyRetirementFailure(error)}\n`)
    process.exitCode = 1
  })
}
