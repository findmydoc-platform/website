import { readFileSync, realpathSync, statSync } from 'node:fs'
import path from 'node:path'
import { validateInput } from './common.mjs'

const REGISTRY = 'tests/integration/contracts/collectionContractRegistry.ts'
const REGISTRY_CONTRACT = 'tests/integration/contracts/collectionContractCoverage.test.ts'
const TEST_PATH = /^tests\/integration\/.+\.test\.ts$/
const DOC_PATH = /^docs\/(?:engineering|agents|frontend|roadmap|testing|tutorials)\/.+\.md$/
const SHADOW_CONSUMERS = new Map([
  [
    'src/features/transactionalEmail/lettermintDelivery.ts',
    ['tests/integration/transactionalEmail.delivery.test.ts', 'tests/integration/transactionalEmail.worker.test.ts'],
  ],
  [
    'src/features/transactionalEmail/retentionPolicy.ts',
    ['tests/integration/transactionalEmail.events.test.ts', 'tests/integration/transactionalEmail.retention.test.ts'],
  ],
  [
    'src/collections/ClinicGalleryEntries/hooks/beforeChangeClinicGalleryEntry.ts',
    [
      'tests/integration/clinicGalleryEntries.lifecycle.test.ts',
      'tests/integration/clinicGalleryEntries.validation.test.ts',
      'tests/integration/clinicGalleryMedia.lifecycle.test.ts',
      'tests/integration/clinicProfileDrafts.lifecycle.test.ts',
      REGISTRY_CONTRACT,
    ],
  ],
])

const result = (mode, reasons, files = [], shadowFiles = []) => ({
  mode,
  files: [...new Set(files)].sort(),
  lanes: [],
  reasons,
  shadowFiles: [...new Set(shadowFiles)].sort(),
})

function isExistingFile(root, relativePath) {
  try {
    const absolutePath = path.resolve(root, relativePath)
    const resolvedRoot = realpathSync(root)
    const resolvedPath = realpathSync(absolutePath)
    const relative = path.relative(resolvedRoot, resolvedPath)
    return (
      !relative.startsWith(`..${path.sep}`) &&
      relative !== '..' &&
      !path.isAbsolute(relative) &&
      statSync(absolutePath).isFile()
    )
  } catch {
    return false
  }
}

function readRegistryReferences(root) {
  if (!isExistingFile(root, REGISTRY)) throw new Error('missing-registry')
  const registrySource = readFileSync(path.resolve(root, REGISTRY), 'utf8')
  const declaration = /\bexport\s+const\s+collectionContractRegistry\s*=\s*\{/.exec(registrySource)
  if (!declaration) throw new Error('unsupported-registry')
  const literal = /^([\s\S]*?)\}\s*(?:as const\b|;|$)/.exec(
    registrySource.slice(declaration.index + declaration[0].length),
  )
  if (!literal) throw new Error('unsupported-registry')
  const source = literal[1]
  const entry = /(?:[\w$]+|'[^']+'|"[^"]+")\s*:\s*\{\s*(?:(?:baseline|deep)\s*:\s*\[[^\]]*\]\s*,?\s*)+\}\s*,?\s*/g
  if (source.replace(entry, '').trim()) throw new Error('unsupported-registry')
  const properties = [...source.matchAll(/\b(?:baseline|deep)\s*:/g)]
  const arrays = [...source.matchAll(/\b(?:baseline|deep)\s*:\s*\[([^\]]*)\]/g)]
  if (arrays.length === 0 || arrays.length !== properties.length) throw new Error('unsupported-registry')
  const references = new Set()
  for (const [, body] of arrays) {
    // Read static references only; never import the registry or any test module.
    const literals = [...body.matchAll(/(['"])(tests\/integration\/[^'"\n]+\.test\.ts)\1/g)]
    const remaining = body.replace(/(['"])(tests\/integration\/[^'"\n]+\.test\.ts)\1/g, '').replace(/[\s,]/g, '')
    if (literals.length === 0 || remaining) throw new Error('unsupported-registry')
    for (const [, , filename] of literals) references.add(filename)
  }
  return references
}

/** Select modified test files only. Product consumers are advisory and always run the full suite. */
export function selectIntegration(input, { root = process.cwd() } = {}) {
  const validated = validateInput(input)
  if (!validated.valid) return result('full', [validated.reason])
  const { changes } = validated
  if (changes.some((change) => change.status !== 'M')) return result('full', ['non-modification-change'])

  const isDocumentation = (filename) => DOC_PATH.test(filename) && !/(?:^|[/.])generated(?:[./-]|$)/i.test(filename)
  if (changes.every(({ path: filename }) => isDocumentation(filename)))
    return result('skip', ['known-documentation-only'])

  const relevant = changes.filter(({ path: filename }) => !isDocumentation(filename))
  if (relevant.some(({ path: filename }) => !TEST_PATH.test(filename))) {
    const reasons = relevant
      .filter(({ path: filename }) => !TEST_PATH.test(filename))
      .map(
        ({ path: filename }) =>
          `${SHADOW_CONSUMERS.has(filename) ? 'product-shadow-only' : 'unmapped-or-shared-path'}:${filename}`,
      )
    const candidates = relevant.flatMap(({ path: filename }) => SHADOW_CONSUMERS.get(filename) ?? [])
    const shadowFiles = candidates.filter((filename) => isExistingFile(root, filename))
    if (shadowFiles.length !== candidates.length) reasons.push('missing-shadow-candidate')
    return result('full', reasons, [], shadowFiles)
  }

  const files = relevant.map(({ path: filename }) => filename)
  const missing = files.find((filename) => !isExistingFile(root, filename))
  if (missing) return result('full', [`missing-test-file:${missing}`])
  let references
  try {
    references = readRegistryReferences(root)
  } catch {
    return result('full', ['registry-unavailable-or-unsupported'])
  }
  const reasons = ['modified-integration-tests-only']
  if (files.some((filename) => references.has(filename))) {
    if (!isExistingFile(root, REGISTRY_CONTRACT)) return result('full', ['missing-registry-contract'])
    files.push(REGISTRY_CONTRACT)
    reasons.push('registry-contract-reads-modified-test')
  }
  return result('selected', reasons, files)
}
