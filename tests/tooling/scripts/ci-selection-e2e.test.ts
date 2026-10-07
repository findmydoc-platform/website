import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { assessE2eTarget, evaluateE2eOutcomes, selectE2e } from '../../../scripts/ci-selection-poc/e2e.mjs'

const adminPath = 'tests/e2e/admin/clinics.admin-smoke.spec.ts'
const publicPath = 'tests/e2e/public/clinic-detail.public-smoke.spec.ts'
const modified = (...paths: string[]) => ({ changes: paths.map((path) => ({ status: 'M', path })) })
const full = { mode: 'full', files: [], lanes: ['admin', 'public'], shadowFiles: [] }
const specPaths = [
  adminPath,
  'tests/e2e/admin/auth.admin-login.spec.ts',
  'tests/e2e/admin/platform.admin-regression.spec.ts',
  'tests/e2e/admin/nested/clinics.admin-smoke.spec.ts',
  publicPath,
  'tests/e2e/public/auth.registration.public-smoke.spec.ts',
]
let fixtureDirectory: string
let root: string

beforeEach(() => {
  fixtureDirectory = mkdtempSync(path.join(tmpdir(), 'ci-selection-e2e-'))
  root = path.join(fixtureDirectory, 'repo')
  for (const spec of specPaths) {
    const file = path.join(root, spec)
    mkdirSync(path.dirname(file), { recursive: true })
    writeFileSync(file, 'export {}\n')
  }
})

afterEach(() => {
  rmSync(fixtureDirectory, { recursive: true, force: true })
})

const select = (input: Parameters<typeof selectE2e>[0]) => selectE2e(input, { root })

describe('E2E relevance selection', () => {
  it.each([
    [adminPath, 'admin'],
    ['tests/e2e/admin/auth.admin-login.spec.ts', 'admin'],
    ['tests/e2e/admin/platform.admin-regression.spec.ts', 'admin'],
    ['tests/e2e/admin/nested/clinics.admin-smoke.spec.ts', 'admin'],
    [publicPath, 'public'],
    ['tests/e2e/public/auth.registration.public-smoke.spec.ts', 'public'],
  ])('selects only the lane for a modified spec %s', (path, lane) => {
    expect(select(modified(path, 'docs/testing/setup.md'))).toEqual({
      mode: 'selected',
      files: [],
      lanes: [lane],
      reasons: ['modified-lane-specs-only'],
      shadowFiles: [],
    })
  })

  it('requires both lanes for mixed spec changes', () => {
    expect(select(modified(publicPath, adminPath))).toEqual({ ...full, reasons: ['both-lanes-affected'] })
  })

  it('requires both lanes when a matching spec is missing', () => {
    expect(select(modified(adminPath, 'tests/e2e/public/missing.public-smoke.spec.ts'))).toEqual({
      ...full,
      reasons: ['missing-or-unconfined-spec'],
    })
  })

  it('rejects directories with a matching spec name', () => {
    const directory = 'tests/e2e/admin/directory.admin-smoke.spec.ts'
    mkdirSync(path.join(root, directory))
    expect(select(modified(directory))).toEqual({ ...full, reasons: ['missing-or-unconfined-spec'] })
  })

  it('rejects matching specs symlinked outside the root', () => {
    const outsideFile = path.join(fixtureDirectory, 'outside.spec.ts')
    writeFileSync(outsideFile, 'export {}\n')
    const linkedSpec = 'tests/e2e/public/linked.public-smoke.spec.ts'
    symlinkSync(outsideFile, path.join(root, linkedSpec))
    expect(select(modified(linkedSpec))).toEqual({ ...full, reasons: ['missing-or-unconfined-spec'] })
  })

  it('rejects an escaping symlinked parent directory', () => {
    const outsideDirectory = path.join(fixtureDirectory, 'outside')
    mkdirSync(outsideDirectory)
    writeFileSync(path.join(outsideDirectory, 'linked.admin-smoke.spec.ts'), 'export {}\n')
    symlinkSync(outsideDirectory, path.join(root, 'tests/e2e/admin/linked'))
    expect(select(modified('tests/e2e/admin/linked/linked.admin-smoke.spec.ts'))).toEqual({
      ...full,
      reasons: ['missing-or-unconfined-spec'],
    })
  })

  it('rejects symlinks to another lane even inside the root', () => {
    const linkedSpec = 'tests/e2e/admin/linked.admin-smoke.spec.ts'
    symlinkSync(path.join(root, publicPath), path.join(root, linkedSpec))
    expect(select(modified(linkedSpec))).toEqual({ ...full, reasons: ['missing-or-unconfined-spec'] })
  })

  it('falls back when the supplied root cannot be resolved', () => {
    expect(selectE2e(modified(adminPath), { root: path.join(fixtureDirectory, 'missing') })).toEqual({
      ...full,
      reasons: ['missing-or-unconfined-spec'],
    })
  })

  it('resolves a symlinked root before checking its specs', () => {
    const linkedRoot = path.join(fixtureDirectory, 'linked-repo')
    symlinkSync(root, linkedRoot)
    expect(selectE2e(modified(publicPath), { root: linkedRoot })).toMatchObject({ mode: 'selected', lanes: ['public'] })
  })

  it('skips modified documentation only', () => {
    expect(select(modified('docs/testing/setup.md', 'tests/e2e/AGENTS.md'))).toEqual({
      mode: 'skip',
      files: [],
      lanes: [],
      reasons: ['modified-documentation-only'],
      shadowFiles: [],
    })
  })

  it.each(['docs/testing/setup.md', 'AGENTS.md', 'README.md', 'src/components/README.md', 'tests/e2e/AGENTS.md'])(
    'preserves the documentation exclusion for %s',
    (filename) => {
      expect(select(modified(filename))).toMatchObject({ mode: 'skip', lanes: [] })
      expect(select(modified(adminPath, filename))).toMatchObject({ mode: 'selected', lanes: ['admin'] })
    },
  )

  it.each([
    'src/content/foo.md',
    'config/runtime.md',
    'unknown.md',
    'docs/generated/routes.md',
    'docs/generated/README.md',
    'src/generated/AGENTS.md',
    'src/generated-content/README.md',
    'docs/routes.generated.md',
    'docs/runtime.json',
  ])('requires full execution for unknown or generated documentation-like input %s', (filename) => {
    expect(select(modified(filename))).toEqual({ ...full, reasons: ['shared-or-unknown-input'] })
    expect(select(modified(publicPath, filename))).toEqual({ ...full, reasons: ['shared-or-unknown-input'] })
  })

  it.each([
    'playwright.config.ts',
    'src/payload.config.ts',
    'src/auth/utilities/emailNormalization.ts',
    'src/app/(frontend)/about/page.tsx',
    'tests/e2e/helpers/adminFixtures.ts',
    'tests/e2e/helpers/browserIssues.ts',
    'tests/e2e/setup/admin.setup.ts',
    'scripts/public-e2e-clinic-fixture.ts',
    'tests/e2e/admin/fixture.ts',
    'tests/e2e/public/unknown.spec.ts',
    'package.json',
    'pnpm-lock.yaml',
    '.github/workflows/admin-e2e-smoke.yml',
    'unknown.ts',
  ])('falls back for shared or unrecognized input %s', (path) => {
    expect(select(modified(adminPath, path))).toMatchObject(full)
  })

  it.each(['A', 'D', 'R', 'C', 'T'])('never narrows status %s', (status) => {
    expect(select({ changes: [{ status, path: publicPath, previousPath: adminPath }] })).toMatchObject(full)
  })

  it.each([
    undefined,
    { changes: [] },
    { changes: [{ status: 'M', path: '../public.spec.ts' }] },
    { changes: [{ status: 'M', path: '/tests/e2e/public/a.public-smoke.spec.ts' }] },
    { changes: [{ status: 'M', path: publicPath }], classificationFailed: true },
    { changes: [{ status: 'M', path: publicPath, previousPath: adminPath }] },
    { changes: [{ status: 'A', path: 'docs/new.md' }] },
  ])('fails closed for incomplete or unsafe classification %j', (input) => {
    expect(select(input)).toMatchObject(full)
  })
})

describe('E2E outcome policy', () => {
  it('allows Public success when Admin is intentionally skipped', () => {
    expect(evaluateE2eOutcomes(select(modified(publicPath)), { admin: 'skipped', public: 'success' })).toEqual({
      valid: true,
      reasons: [],
    })
  })

  it('allows Admin success and a documentation-only skip', () => {
    expect(evaluateE2eOutcomes(select(modified(adminPath)), { admin: 'success', public: 'skipped' }).valid).toBe(true)
    expect(
      evaluateE2eOutcomes(select(modified('docs/testing/setup.md')), { admin: 'skipped', public: 'skipped' }).valid,
    ).toBe(true)
    expect(
      evaluateE2eOutcomes(select(modified(adminPath, publicPath)), { admin: 'success', public: 'success' }).valid,
    ).toBe(true)
  })

  it.each(['failure', 'skipped', 'cancelled', 'timed_out', 'neutral', undefined])(
    'rejects a required Public outcome %s even when Admin is skipped',
    (publicOutcome) => {
      expect(evaluateE2eOutcomes(select(modified(publicPath)), { admin: 'skipped', public: publicOutcome })).toEqual({
        valid: false,
        reasons: ['public-required-but-not-successful'],
      })
    },
  )

  it('retains failures for both required lanes', () => {
    expect(
      evaluateE2eOutcomes(select(modified(adminPath, publicPath)), { admin: 'failure', public: 'skipped' }),
    ).toEqual({
      valid: false,
      reasons: ['admin-required-but-not-successful', 'public-required-but-not-successful'],
    })
  })

  it.each(['success', 'failure', 'cancelled', undefined])(
    'rejects unrequested Admin execution or missing skip %s',
    (adminOutcome) => {
      expect(evaluateE2eOutcomes(select(modified(publicPath)), { admin: adminOutcome, public: 'success' }).valid).toBe(
        false,
      )
    },
  )

  it.each([
    undefined,
    { mode: 'skip', lanes: ['public'] },
    { mode: 'full', lanes: [] },
    { mode: 'selected', lanes: ['unknown'] },
    { mode: 'full', lanes: ['admin', 'admin'] },
  ])('rejects malformed selection %j', (selection) => {
    expect(evaluateE2eOutcomes(selection, { admin: 'skipped', public: 'skipped' })).toEqual({
      valid: false,
      reasons: ['invalid-e2e-selection'],
    })
  })
})

describe('immutable E2E target evidence', () => {
  const commit = ['0123456789', 'abcdef'].join('').repeat(3).slice(0, 40)
  const evidence = { deploymentCommit: commit, sourceCommit: commit, databaseCommit: commit, immutable: true }

  it('accepts only matching full identities and explicit immutability', () => {
    expect(assessE2eTarget(evidence)).toEqual({
      blocked: false,
      reason: 'immutable-target-matches-source-and-database',
    })
    expect(assessE2eTarget({ ...evidence, deploymentCommit: commit.toUpperCase() }).blocked).toBe(false)
  })

  it.each([false, undefined, 'true'])('blocks missing immutable evidence %s', (immutable) => {
    expect(assessE2eTarget({ ...evidence, immutable })).toEqual({
      blocked: true,
      reason: 'immutable-target-evidence-required',
    })
  })

  it.each(['deploymentCommit', 'sourceCommit', 'databaseCommit'])('blocks a mismatch in %s', (field) => {
    expect(assessE2eTarget({ ...evidence, [field]: 'a'.repeat(40) })).toEqual({
      blocked: true,
      reason: 'target-source-database-commit-mismatch',
    })
  })

  it.each([undefined, '', 'eda78ba8', 'main', 'z'.repeat(40), ` ${commit}`, `${commit}\n`])(
    'blocks invalid identity %j',
    (identity) => {
      expect(assessE2eTarget({ ...evidence, sourceCommit: identity })).toEqual({
        blocked: true,
        reason: 'valid-full-commit-identities-required',
      })
    },
  )

  it('blocks absent evidence', () => {
    expect(assessE2eTarget(undefined).blocked).toBe(true)
  })
})
