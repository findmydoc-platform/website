import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { selectIntegration } from '../../../scripts/ci-selection-poc/integration.mjs'

const repositoryRoot = path.resolve(import.meta.dirname, '../../..')
const registry = 'tests/integration/contracts/collectionContractRegistry.ts'
const contract = 'tests/integration/contracts/collectionContractCoverage.test.ts'
const emailTests = [
  'tests/integration/transactionalEmail.delivery.test.ts',
  'tests/integration/transactionalEmail.retention.test.ts',
  'tests/integration/transactionalEmail.worker.test.ts',
] as const
const temporaryRoots: string[] = []
const modified = (filenames: readonly string[]) => ({
  changes: filenames.map((filename) => ({ status: 'M', path: filename })),
})
const select = (filenames: readonly string[], root = repositoryRoot) => selectIntegration(modified(filenames), { root })

function fixtureRoot() {
  const root = mkdtempSync(path.join(tmpdir(), 'ci-selection-integration-'))
  temporaryRoots.push(root)
  return root
}

function fixtureFile(root: string, filename: string, content = 'throw new Error("must never execute")') {
  const absolutePath = path.join(root, filename)
  mkdirSync(path.dirname(absolutePath), { recursive: true })
  writeFileSync(absolutePath, content)
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('integration selection POC', () => {
  it('selects exactly the historical three email tests without registry consumers', () => {
    expect(select(emailTests)).toEqual({
      mode: 'selected',
      files: emailTests,
      lanes: [],
      reasons: ['modified-integration-tests-only'],
      shadowFiles: [],
    })
  })

  it('includes the source-reading registry contract for a registered modified test', () => {
    const filename = 'tests/integration/countries.lifecycle.test.ts'
    expect(select([filename])).toEqual({
      mode: 'selected',
      files: [contract, filename],
      lanes: [],
      reasons: ['modified-integration-tests-only', 'registry-contract-reads-modified-test'],
      shadowFiles: [],
    })
  })

  it('deduplicates files and the contract while retaining all modified assertions', () => {
    const filename = 'tests/integration/countries.lifecycle.test.ts'
    expect(select([filename, filename, contract]).files).toEqual([contract, filename])
  })

  it('includes the registry contract for deep-only references', () => {
    const filename = 'tests/integration/doctors.titles.test.ts'
    expect(select([filename])).toMatchObject({ mode: 'selected', files: [contract, filename] })
  })

  it('reads registry references without executing registry or test source', () => {
    const root = fixtureRoot()
    const filename = 'tests/integration/access/example.test.ts'
    fixtureFile(root, filename)
    fixtureFile(root, contract)
    fixtureFile(
      root,
      registry,
      `throw new Error('must never execute'); export const collectionContractRegistry = { example: { baseline: ["${filename}"], deep: ['${filename}'] } }`,
    )
    expect(select([filename], root).files).toEqual([filename, contract].sort())
  })

  it.each(['missing', 'dynamic', 'computed', 'spread', 'empty'])(
    'falls back when registry references are %s',
    (kind) => {
      const root = fixtureRoot()
      fixtureFile(root, emailTests[0])
      if (kind !== 'missing')
        fixtureFile(
          root,
          registry,
          {
            dynamic: 'export const collectionContractRegistry = { example: { baseline: resolveTests() } }',
            computed:
              'export const collectionContractRegistry = { example: { baseline: [prefix + "example.test.ts"] } }',
            spread: `export const collectionContractRegistry = { example: { baseline: ['${emailTests[0]}'] }, ...otherContracts }`,
            empty: 'export const collectionContractRegistry = {}',
          }[kind]!,
        )
      expect(select([emailTests[0]], root)).toMatchObject({
        mode: 'full',
        files: [],
        reasons: ['registry-unavailable-or-unsupported'],
      })
    },
  )

  it('falls back when the registry contract is absent', () => {
    const root = fixtureRoot()
    fixtureFile(root, emailTests[0])
    fixtureFile(
      root,
      registry,
      `export const collectionContractRegistry = { example: { baseline: ['${emailTests[0]}'] } }`,
    )
    expect(select([emailTests[0]], root)).toMatchObject({
      mode: 'full',
      files: [],
      reasons: ['missing-registry-contract'],
    })
  })

  it('does not select missing files or directories named as tests', () => {
    const root = fixtureRoot()
    expect(select([emailTests[0]], root).mode).toBe('full')
    mkdirSync(path.join(root, emailTests[0]), { recursive: true })
    expect(select([emailTests[0]], root).mode).toBe('full')
  })

  it('rejects a test symlink resolving outside the supplied root', () => {
    const root = fixtureRoot()
    const outside = fixtureRoot()
    fixtureFile(outside, 'outside.ts')
    mkdirSync(path.dirname(path.join(root, emailTests[0])), { recursive: true })
    symlinkSync(path.join(outside, 'outside.ts'), path.join(root, emailTests[0]))
    expect(select([emailTests[0]], root)).toMatchObject({ mode: 'full', files: [] })
  })

  it('skips only the known documentation class and allows it alongside modified tests', () => {
    expect(select(['docs/engineering/ci-optimization-results.md'])).toEqual({
      mode: 'skip',
      files: [],
      lanes: [],
      reasons: ['known-documentation-only'],
      shadowFiles: [],
    })
    expect(select([...emailTests, 'docs/testing/strategy.md']).files).toEqual(emailTests)
  })

  it.each([
    'tests/fixtures/transactionalEmail.ts',
    'tests/helpers/deliveryEdgeNetworkBoundary.ts',
    'tests/setup/integrationGlobalSetup.ts',
    'scripts/test-database-harness.mjs',
    'docker-compose.test.yml',
    'package.json',
    'pnpm-lock.yaml',
    'src/payload.config.ts',
    'src/plugins/index.ts',
    'src/migrations/index.ts',
    'src/endpoints/seed/baseline.ts',
    registry,
    'docs/engineering/generated/contracts.md',
    'docs/engineering/contracts.generated.md',
    'docs/generated/api.md',
    'docs/unknown/report.md',
    'docs/testing/fixture.json',
    'unknown.txt',
    'tests/unit/example.test.ts',
  ])('keeps full execution when %s accompanies a modified test', (filename) => {
    expect(select([emailTests[0], filename])).toMatchObject({ mode: 'full', files: [], lanes: [], shadowFiles: [] })
  })

  it.each(['A', 'D', 'R', 'C', 'T'])('does not narrow status %s, including documentation', (status) => {
    for (const filename of [emailTests[0], 'docs/testing/strategy.md']) {
      expect(
        selectIntegration(
          { changes: [{ status, path: filename, previousPath: 'docs/testing/old.md' }] },
          { root: repositoryRoot },
        ),
      ).toMatchObject({ mode: 'full', files: [], shadowFiles: [] })
    }
  })

  it.each([
    { changes: [] },
    { changes: [{ status: 'M', path: '../outside.test.ts' }] },
    { changes: [{ status: 'M', path: '/absolute.test.ts' }] },
    { changes: [{ status: 'M', path: emailTests[0] }], classificationFailed: true },
  ])('fails closed for invalid or failed classification %j', (input) => {
    expect(selectIntegration(input, { root: repositoryRoot })).toMatchObject({
      mode: 'full',
      files: [],
      lanes: [],
      shadowFiles: [],
    })
  })

  it('keeps email source selection advisory even alongside modified test files', () => {
    const decision = select(['src/features/transactionalEmail/lettermintDelivery.ts', emailTests[1]])
    expect(decision).toEqual({
      mode: 'full',
      files: [],
      lanes: [],
      reasons: ['product-shadow-only:src/features/transactionalEmail/lettermintDelivery.ts'],
      shadowFiles: [emailTests[0], emailTests[2]],
    })
  })

  it('keeps the Gallery hook advisory with known cross-consumers', () => {
    expect(select(['src/collections/ClinicGalleryEntries/hooks/beforeChangeClinicGalleryEntry.ts'])).toMatchObject({
      mode: 'full',
      files: [],
      shadowFiles: [
        'tests/integration/clinicGalleryEntries.lifecycle.test.ts',
        'tests/integration/clinicGalleryEntries.validation.test.ts',
        'tests/integration/clinicGalleryMedia.lifecycle.test.ts',
        'tests/integration/clinicProfileDrafts.lifecycle.test.ts',
        contract,
      ],
    })
  })

  it('does not generalize source ownership to adjacent email files', () => {
    expect(select(['src/features/transactionalEmail/worker.ts'])).toMatchObject({
      mode: 'full',
      files: [],
      shadowFiles: [],
    })
  })

  it('reports missing advisory candidates without claiming execution', () => {
    const decision = select(['src/features/transactionalEmail/retentionPolicy.ts'], fixtureRoot())
    expect(decision).toMatchObject({ mode: 'full', files: [], shadowFiles: [] })
    expect(decision.reasons).toContain('missing-shadow-candidate')
  })
})
