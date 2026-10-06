import { afterEach, describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { runInNewContext } from 'node:vm'
import { parse } from 'yaml'
import {
  classify,
  filesFingerprint,
  fixtures,
  githubOutputs,
  scenarioDecision,
  scenarios,
  workflowDigest,
} from '../../../scripts/ci-build-scope.mjs'

const root = path.resolve(import.meta.dirname, '../../..')
const require = createRequire(import.meta.url)
const picomatch = require(
  path.join(realpathSync(path.join(root, 'node_modules')), '.pnpm/picomatch@2.3.2/node_modules/picomatch'),
) as (pattern: string, options: { dot: boolean }) => (filename: string) => boolean
const source = readFileSync(path.join(root, '.github/workflows/deploy.yml'), 'utf8')
const workflow = parse(source)
const filters = parse(
  workflow.jobs.paths.steps.find((step: { id?: string }) => step.id === 'filter').with.filters,
) as Record<string, string[]>
const directories: string[] = []
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

// Evaluate the frozen workflow's expression independently, including its implicit needs-success gate.
function originalRouting(files: string[]) {
  const matches = (name: string) =>
    files.some((file) => filters[name]!.some((pattern) => picomatch(pattern, { dot: true })(file)))
  const validation = runInNewContext(workflow.jobs.paths.outputs.validation.replace(/^\$\{\{\s*|\s*\}\}$/g, ''), {
    steps: {
      filter: { outputs: { changed: String(matches('changed')), non_markdown: String(matches('non_markdown')) } },
    },
  }) as boolean
  return {
    validation,
    integration: validation && matches('integration'),
    buildRequired: validation && matches('deployable'),
  }
}

describe('frozen deployment scope routing', () => {
  it.each([
    ['docs', false, false, false],
    ['tests', true, true, false],
    ['metadata', true, true, false],
    ['runtime', true, true, false],
  ] as const)('preserves baseline dependency routing for %s', (scenario, validation, buildRequired, integration) => {
    const decision = classify({ files: scenarios[scenario] })
    expect(decision).toMatchObject({ success: true, validation, buildRequired, integration })
    expect(decision.dependencies).toEqual({ static: validation, unit: validation, storybook: validation })
    expect(decision).toMatchObject(originalRouting([...scenarios[scenario]]))
  })
  it('preserves the default some predicate even where negative deployable rules look like exclusions', () => {
    const decision = classify({ files: ['tests/unit/example.test.ts'] })
    expect(decision.sourceFilters.deployable).toBe(true)
    expect(decision.buildRequired).toBe(true)
    expect(workflow.jobs.build.needs).toEqual(['ci-static', 'unit-tests', 'storybook-tests', 'paths'])
  })
  it.each([
    ['added runtime', ['src/new.ts']],
    ['deleted runtime', ['src/removed.ts']],
    ['added docs', ['docs/new.md']],
    ['deleted docs', ['docs/removed.md']],
    ['rename into runtime', ['docs/old.md', 'src/new.ts']],
    ['rename out of runtime', ['src/old.ts', 'docs/new.md']],
    ['rename metadata', ['.github/workflows/old.yml', '.github/workflows/new.yml']],
    ['integration docs dependency skip', ['src/access/README.md']],
    ['integration setup', ['tests/setup/integration.ts']],
    ['integration case', ['tests/integration/example.test.ts']],
    ['integration runtime', ['src/collections/Clinics.ts']],
    ['mixed', ['README.md', 'tests/unit/example.test.ts', 'src/hooks/update.ts']],
  ])('keeps validation and integration identical across variants: %s', (_change, files) => {
    const baseline = classify({ files })
    const candidate = classify({ files, variant: 'candidate' })
    expect(baseline).toMatchObject(originalRouting(files as string[]))
    expect(candidate.validation).toBe(baseline.validation)
    expect(candidate.integration).toBe(baseline.integration)
    expect(candidate.dependencies).toEqual(baseline.dependencies)
  })
  it('does not report a documentation-only build saving where skipped dependencies already suppress baseline build', () => {
    for (const variant of ['baseline', 'candidate']) {
      expect(classify({ files: fixtures.docs, variant })).toMatchObject({
        validation: false,
        buildRequired: false,
        integration: false,
        buildRunnable: false,
        dependencies: { static: false, unit: false, storybook: false },
      })
    }
  })
  it('captures the source workflow and a canonical status-neutral file fingerprint', () => {
    expect(workflowDigest).toBe(createHash('sha256').update(source).digest('hex'))
    const first = classify({ files: ['src/a.ts', 'docs/b.md', 'src/a.ts'] })
    const second = classify({ files: ['docs/b.md', 'src/a.ts'], variant: 'candidate' })
    expect(first.files).toEqual(['docs/b.md', 'src/a.ts'])
    expect(first.filesDigest).toBe(second.filesDigest)
    expect(first.filesDigest).not.toBe(filesFingerprint(['src/a.ts']))
  })
})

describe('candidate app compiler scope', () => {
  it.each([
    ['ordinary test', ['tests/unit/example.test.ts'], false],
    ['tooling test', ['tests/tooling/scripts/example.test.ts'], false],
    ['integration test', ['tests/integration/example.test.ts'], false],
    ['workflow build configuration', ['.github/workflows/deploy.yml', '.github/workflows/check.yaml'], true],
    [
      'issue template metadata',
      ['.github/ISSUE_TEMPLATE/bug_report.yml', '.github/ISSUE_TEMPLATE/feature.yaml'],
      false,
    ],
    ['dependency update metadata', ['.github/dependabot.yml'], false],
    ['executable issue template tool', ['.github/ISSUE_TEMPLATE/generate.mjs'], true],
    ['mixed metadata and workflow config', ['.secrets.baseline', '.github/workflows/deploy.yml'], true],
    ['secret scan baseline', ['.secrets.baseline'], false],
    ['Storybook config', ['.storybook/main.ts'], false],
    ['story directory', ['src/stories/Button.tsx'], false],
    ['story file', ['src/components/Button.stories.tsx'], false],
    ['documentation data', ['docs/example.json', 'docs/diagram.svg'], false],
    ['test setup', ['tests/setup/integration.ts'], true],
    ['test setup entry', ['tests/globalSetup.ts'], true],
    ['CI build helper', ['.github/scripts/ci/build.sh'], true],
    ['CI helper configuration', ['.github/scripts/ci/config.json'], true],
    ['runtime frontend', ['src/app/(frontend)/page.tsx'], true],
    ['manifest', ['package.json'], true],
    ['lockfile', ['pnpm-lock.yaml'], true],
    ['executable documentation', ['docs/example.mjs'], true],
    ['unknown documentation extension', ['docs/example.unknown'], true],
    ['unknown root path', ['new-directory/custom.config'], true],
    ['similar baseline filename', ['.secrets.baseline.json'], true],
    ['non-YAML workflow tool', ['.github/workflows/generate.mjs'], true],
    ['mixed runtime and test', ['tests/unit/example.test.ts', 'src/app/(frontend)/page.tsx'], true],
    ['rename from tool to documentation', ['.github/scripts/old.sh', 'docs/new.md'], true],
  ] as const)('routes %s to build = %s', (_name, files, buildRequired) => {
    const decision = classify({ files, variant: 'candidate' })
    expect(decision.buildRequired).toBe(buildRequired)
    expect(decision.validation).toBe(originalRouting([...files]).validation)
    expect(decision.integration).toBe(originalRouting([...files]).integration)
  })
  it.each([
    [],
    null,
    undefined,
    'src/a.ts',
    [null],
    [''],
    ['../src/a.ts'],
    ['/src/a.ts'],
    ['src/../a.ts'],
    ['src//a.ts'],
    ['C:/src/a.ts'],
    ['src\\a.ts'],
    ['docs/a.md\nvalidation=false'],
  ])('fails closed on malformed or unsafe file manifests: %j', (files) => {
    for (const variant of ['baseline', 'candidate']) {
      expect(classify({ files, variant })).toMatchObject({
        failClosed: true,
        validation: true,
        buildRequired: true,
        integration: true,
      })
    }
  })
  it('fails closed for sparse manifests instead of treating skipped array entries as valid paths', () => {
    for (const variant of ['baseline', 'candidate']) {
      expect(classify({ files: new Array(2), variant })).toMatchObject({
        failClosed: true,
        validation: true,
        buildRequired: true,
      })
    }
  })
  it('cannot hide an unsafe entry inside an otherwise harmless file set', () => {
    expect(classify({ files: ['README.md', '../secret'], variant: 'candidate' })).toMatchObject({
      failClosed: true,
      validation: true,
      buildRequired: true,
    })
  })
  it.each(['baseline', 'candidate'])('forces all scheduled scope decisions for %s', (variant) => {
    for (const files of Object.values(scenarios))
      expect(classify({ files, variant, experiment: 'schedule' })).toMatchObject({
        success: true,
        validation: true,
        buildRequired: true,
        integration: true,
        dependencies: { static: true, unit: true, storybook: true },
      })
  })
  it('reports classification failure instead of converting it into a successful skip', () => {
    expect(classify({ files: scenarios.docs, variant: 'candidate', classificationFailed: true })).toMatchObject({
      success: false,
      failureReason: 'classification',
      failClosed: true,
      validation: true,
      buildRequired: true,
      integration: true,
      buildRunnable: false,
    })
  })
  it('leaves classification and early-build routing successful when the workflow will inject static failure', () => {
    expect(scenarioDecision({ scenario: 'runtime', failure: 'static' })).toMatchObject({
      success: true,
      failureReason: 'static',
      validation: true,
      buildRequired: true,
      buildRunnable: true,
    })
    for (const scenario of Object.keys(scenarios)) {
      for (const variant of ['baseline', 'candidate']) {
        for (const experiment of ['filter', 'schedule']) {
          const original = scenarioDecision({ scenario, variant, experiment })
          expect(scenarioDecision({ scenario, variant, experiment, failure: 'static' })).toEqual({
            ...original,
            failureReason: 'static',
          })
        }
      }
    }
  })
})

describe('scope CLI and Actions outputs', () => {
  const cli = (args: string[], overrides: Record<string, string | undefined> = {}) => {
    const env = { ...process.env }
    delete env.DIAGNOSTIC_ROUND
    delete env.GITHUB_SHA
    return spawnSync(process.execPath, [path.join(root, 'scripts/ci-build-scope.mjs'), ...args], {
      cwd: root,
      env: { ...env, GITHUB_OUTPUT: '', ...overrides },
      encoding: 'utf8',
    })
  }
  it('emits the same structured decision as the exported classifier', () => {
    const result = cli([
      '--scenario',
      'runtime',
      '--variant',
      'candidate',
      '--experiment',
      'schedule',
      '--failure',
      'none',
    ])
    expect(result.status).toBe(0)
    expect(JSON.parse(result.stdout)).toEqual({
      ...scenarioDecision({ scenario: 'runtime', variant: 'candidate', experiment: 'schedule' }),
      scenario: 'runtime',
      failure: 'none',
      round: 1,
      commit: null,
    })
  })
  it.each(['1', '2', '3'])('includes validated round %s and the workflow commit in the receipt only', (round) => {
    const directory = mkdtempSync(path.join(os.tmpdir(), 'ci-scope-test-'))
    directories.push(directory)
    const output = path.join(directory, 'outputs')
    const commit = 'a'.repeat(40)
    const result = cli(['--scenario', 'runtime'], {
      DIAGNOSTIC_ROUND: round,
      GITHUB_SHA: commit,
      GITHUB_OUTPUT: output,
    })
    expect(result.status).toBe(0)
    expect(JSON.parse(result.stdout)).toEqual({
      ...scenarioDecision({ scenario: 'runtime' }),
      scenario: 'runtime',
      failure: 'none',
      round: Number(round),
      commit,
    })
    expect(readFileSync(output, 'utf8')).toBe(githubOutputs(scenarioDecision({ scenario: 'runtime' })))
  })
  it.each([
    { DIAGNOSTIC_ROUND: '0' },
    { DIAGNOSTIC_ROUND: '4' },
    { DIAGNOSTIC_ROUND: 'NaN' },
    { GITHUB_SHA: '' },
    { GITHUB_SHA: 'a'.repeat(39) },
    { GITHUB_SHA: 'z'.repeat(40) },
    { GITHUB_SHA: 'a'.repeat(40) + '\nINJECTED=true' },
  ])('rejects unsafe receipt provenance before emitting stdout or outputs: %j', (overrides) => {
    const directory = mkdtempSync(path.join(os.tmpdir(), 'ci-scope-test-'))
    directories.push(directory)
    const output = path.join(directory, 'outputs')
    writeFileSync(output, 'existing=true\n')
    const result = cli(['--scenario', 'runtime'], { ...overrides, GITHUB_OUTPUT: output })
    expect(result.status).toBe(1)
    expect(result.stdout).toBe('')
    expect(readFileSync(output, 'utf8')).toBe('existing=true\n')
  })
  it('appends only allowed output keys and ignores arbitrary environment output values', () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), 'ci-scope-test-'))
    directories.push(directory)
    const output = path.join(directory, 'outputs')
    writeFileSync(output, 'existing=true\n')
    const result = cli(['--scenario', 'metadata', '--variant', 'candidate'], {
      GITHUB_OUTPUT: output,
      validation: 'false\nINJECTED=value',
      EXTRA_OUTPUT: 'private-marker',
    })
    expect(result.status).toBe(0)
    expect(JSON.parse(result.stdout)).toEqual({
      ...scenarioDecision({ scenario: 'metadata', variant: 'candidate' }),
      scenario: 'metadata',
      failure: 'none',
      round: 1,
      commit: null,
    })
    const content = readFileSync(output, 'utf8')
    expect(content).toBe(
      'existing=true\n' + githubOutputs(scenarioDecision({ scenario: 'metadata', variant: 'candidate' })),
    )
    expect(content).toContain('validation=true\nbuild_required=false\nintegration=false\n')
    expect(content).not.toMatch(/INJECTED|EXTRA_OUTPUT|private-marker/)
  })
  it.each([
    ['classification', 1, false],
    ['static', 0, true],
  ] as const)('writes both receipt and outputs before exiting for %s', (failure, exitCode, success) => {
    const directory = mkdtempSync(path.join(os.tmpdir(), 'ci-scope-test-'))
    directories.push(directory)
    const output = path.join(directory, 'outputs')
    const result = cli(['--scenario', 'runtime', '--failure', failure], { GITHUB_OUTPUT: output })
    expect(result.status).toBe(exitCode)
    const decision = scenarioDecision({ scenario: 'runtime', failure })
    expect(JSON.parse(result.stdout)).toEqual({ ...decision, scenario: 'runtime', failure, round: 1, commit: null })
    const content = readFileSync(output, 'utf8')
    expect(content).toBe(githubOutputs(decision))
    expect(content).toContain(`success=${success}\n`)
    expect(content).toContain(`failure_reason=${failure}\n`)
    expect(content).toContain(`build_runnable=${success}\n`)
  })
  it('flushes the JSON receipt even when the later GITHUB_OUTPUT write fails', () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), 'ci-scope-test-'))
    directories.push(directory)
    const result = cli(['--scenario', 'runtime', '--failure', 'classification'], {
      GITHUB_OUTPUT: path.join(directory, 'missing-parent/outputs'),
    })
    expect(result.status).toBe(1)
    expect(JSON.parse(result.stdout)).toEqual({
      ...scenarioDecision({ scenario: 'runtime', failure: 'classification' }),
      scenario: 'runtime',
      failure: 'classification',
      round: 1,
      commit: null,
    })
    expect(result.stderr).not.toContain(directory)
  })
  it('rejects unknown CLI inputs instead of accepting arbitrary output destinations or flags', () => {
    for (const args of [
      ['--scenario', 'unknown'],
      ['--scenario', 'docs', '--failure', 'unknown'],
      ['--scenario', 'docs', '--output', 'other'],
      ['--scenario', 'docs', '--variant', 'other'],
    ]) {
      const result = cli(args)
      expect(result.status).toBe(1)
      expect(result.stdout).toBe('')
    }
  })
  it('rejects injected Actions values even when called directly', () => {
    const decision = scenarioDecision({ scenario: 'runtime' })
    expect(() => githubOutputs({ ...decision, workflowDigest: 'hash\nINJECTED=true' })).toThrow('Unsafe')
    expect(() => githubOutputs({ ...decision, validation: 'true\nINJECTED=true' })).toThrow('Unsafe')
    expect(() => githubOutputs({ ...decision, failureReason: 'private-error' })).toThrow('Unsafe')
  })
})
