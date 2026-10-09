import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { runInNewContext } from 'node:vm'

import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

const repositoryRoot = path.resolve(import.meta.dirname, '../../..')
const require = createRequire(import.meta.url)
// Dorny's pinned action uses picomatch 2; reuse the installed transitive version.
const picomatch = require(
  path.join(realpathSync(path.join(repositoryRoot, 'node_modules')), '.pnpm/picomatch@2.3.2/node_modules/picomatch'),
) as (pattern: string, options: { dot: boolean }) => (filename: string) => boolean
const workflow = parse(readFileSync(path.join(repositoryRoot, '.github/workflows/deploy.yml'), 'utf8'))
const previewWorkflow = parse(readFileSync(path.join(repositoryRoot, '.github/workflows/deploy-preview.yml'), 'utf8'))

const matches = (name: string, filename: string, target = workflow) => {
  const action = target.jobs.paths.steps.find((step: { id?: string }) => step.id === 'filter')
  const rules = parse(readFileSync(path.join(repositoryRoot, action.with.filters), 'utf8')) as Record<string, string[]>
  const rule = rules[name]
  if (!rule) throw new Error(`Missing native path filter: ${name}`)
  const patterns = rule.map((pattern) => picomatch(pattern, { dot: true })(filename))
  return action.with['predicate-quantifier'] === 'every' ? patterns.every(Boolean) : patterns.some(Boolean)
}

const validationDecision = (filenames: string[]) => {
  const outputs = {
    changed: String(filenames.some((filename) => matches('changed', filename))),
    non_markdown: String(filenames.some((filename) => matches('non_markdown', filename))),
  }
  const expression = workflow.jobs.paths.outputs.validation.replace(/^\$\{\{\s*|\s*\}\}$/g, '')
  // The workflow output is a boolean expression over action outputs, with no shell execution.
  return runInNewContext(expression, { steps: { filter: { outputs } } }) as boolean
}

const conditionDecision = (
  expression: string,
  event: string,
  needs: Record<string, unknown>,
  headRepository = 'findmydoc-platform/website',
) =>
  runInNewContext(expression.replace(/needs\.([\w-]+)/g, 'needs["$1"]'), {
    always: () => true,
    github: {
      event_name: event,
      ref: 'refs/heads/main',
      ref_name: 'main',
      repository: 'findmydoc-platform/website',
      event: { pull_request: { head: { repo: { full_name: headRepository } } } },
    },
    needs,
  }) as boolean

describe('PR application validation workflow filters', () => {
  it.each([
    [['README.md', 'docs/contract.md'], false],
    [['.github/README.md', 'docs/.hidden.md'], false],
    [['docs/contract.md', 'src/auth/session.ts'], true],
    [['.github/workflows/deploy.yml'], true],
    [['package.json', 'pnpm-lock.yaml'], true],
    [['docs/read me.md'], false],
    [['scripts/a $(echo hello); name.sh'], true],
    [[], true],
  ])('routes changed paths %j to application validation = %s', (filenames, expected) => {
    expect(validationDecision(filenames)).toBe(expected)
  })

  it('validates a rename across the Markdown boundary in either direction', () => {
    expect(validationDecision(['docs/old.md', 'src/new.ts'])).toBe(true)
    expect(validationDecision(['src/old.ts', 'docs/new.md'])).toBe(true)
  })

  it.each(['failure', 'cancelled', 'skipped'])('runs failure reporting when scope classification is %s', (result) => {
    const needs = {
      paths: { result, outputs: {} },
      'ci-static': { result: 'skipped' },
      'unit-tests': { result: 'skipped' },
      'storybook-tests': { result: 'skipped' },
    }
    for (const job of ['ci-static', 'unit-tests', 'storybook-tests', 'build', 'integration-tests']) {
      expect(conditionDecision(workflow.jobs[job].if, 'pull_request', needs)).toBe(true)
      expect(conditionDecision(workflow.jobs[job].steps[0].if, 'pull_request', needs)).toBe(true)
    }
  })

  it('permits documentation omissions only after successful scope classification', () => {
    const needs = {
      paths: { result: 'success', outputs: { validation: 'false', deployable: 'false', integration: 'false' } },
      'ci-static': { result: 'skipped' },
      'unit-tests': { result: 'skipped' },
      'storybook-tests': { result: 'skipped' },
    }
    for (const job of ['ci-static', 'unit-tests', 'storybook-tests', 'build', 'integration-tests']) {
      expect(conditionDecision(workflow.jobs[job].if, 'pull_request', needs)).toBe(false)
    }
  })

  it.each(['failure', 'cancelled', 'skipped'])(
    'rejects an expected %s prerequisite despite a build omission',
    (result) => {
      const needs = {
        paths: { result: 'success', outputs: { validation: 'true', deployable: 'false', integration: 'true' } },
        'ci-static': { result: 'success' },
        'unit-tests': { result },
        'storybook-tests': { result: 'success' },
      }
      expect(conditionDecision(workflow.jobs.build.if, 'pull_request', needs)).toBe(true)
      expect(conditionDecision(workflow.jobs.build.steps[0].if, 'pull_request', needs)).toBe(true)
    },
  )

  it('runs independent full Main integration for integration-test changes with an omitted build', () => {
    const needs = {
      paths: { result: 'success', outputs: { validation: 'true', deployable: 'false', integration: 'true' } },
      'ci-static': { result: 'success' },
    }
    expect(conditionDecision(workflow.jobs['integration-tests'].if, 'push', needs)).toBe(true)
    expect(conditionDecision(workflow.jobs['integration-tests'].steps[0].if, 'push', needs)).toBe(false)
  })

  it.each([
    ['push', 'true', 'true', 'false', 'false', 0, 'integration=true'],
    ['workflow_dispatch', 'true', 'false', 'false', 'false', 0, 'integration=true'],
    ['pull_request', 'false', 'false', 'false', 'false', 0, 'deployable=true'],
    ['pull_request', 'true', 'true', '', 'false', 1, ''],
    ['pull_request', '', 'false', 'false', 'false', 1, ''],
  ])(
    'applies native action outputs for %s without inferring an omission from missing evidence',
    (event, changed, nonMarkdown, deployable, integration, status, expectedOutput) => {
      const directory = mkdtempSync(path.join(tmpdir(), 'ci-native-scope-'))
      const output = path.join(directory, 'output')
      try {
        const result = spawnSync(
          'bash',
          ['-c', workflow.jobs.paths.steps.find((step: { id?: string }) => step.id === 'set-path-outputs').run],
          {
            env: {
              ...process.env,
              EVENT_NAME: event,
              CHANGED: changed,
              NON_MARKDOWN: nonMarkdown,
              DEPLOYABLE: deployable,
              INTEGRATION: integration,
              TEST_SUPPORT: 'false',
              CHANGED_COUNT: changed === 'false' ? '0' : '1',
              PR_CHANGED_COUNT: changed === 'false' ? '0' : '1',
              GITHUB_OUTPUT: output,
              GITHUB_STEP_SUMMARY: path.join(directory, 'summary'),
            },
            encoding: 'utf8',
          },
        )
        expect(result.status).toBe(status)
        if (status === 0) expect(readFileSync(output, 'utf8')).toContain(expectedOutput)
        else expect(result.stdout).toContain('No omission is approved')
      } finally {
        rmSync(directory, { recursive: true, force: true })
      }
    },
  )
})

const scopeOutputs = (workflow: typeof previewWorkflow, env: Record<string, string | undefined>) => {
  const directory = mkdtempSync(path.join(tmpdir(), 'ci-build-routing-'))
  const output = path.join(directory, 'output')
  try {
    const result = spawnSync(
      'bash',
      ['-c', workflow.jobs.paths.steps.find((step: { id?: string }) => step.id === 'set-path-outputs').run],
      {
        env: {
          ...process.env,
          EVENT_NAME: 'pull_request',
          CHANGED: 'true',
          NON_MARKDOWN: 'true',
          DEPLOYABLE: 'false',
          INTEGRATION: 'false',
          TEST_SUPPORT: 'false',
          CHANGED_COUNT: '1',
          PR_CHANGED_COUNT: '1',
          ...env,
          GITHUB_OUTPUT: output,
          GITHUB_STEP_SUMMARY: path.join(directory, 'summary'),
        },
        encoding: 'utf8',
      },
    )
    return {
      status: result.status,
      output: result.status === 0 ? readFileSync(output, 'utf8') : '',
      summary: result.status === 0 ? readFileSync(path.join(directory, 'summary'), 'utf8') : '',
    }
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

describe('shared native build routing', () => {
  it.each([
    ['src/auth/session.ts', true],
    ['src/collections/Clinics.ts', true],
    ['tests/integration/example.test.ts', true],
    ['tests/setup/unit.setup.ts', true],
    ['vitest.config.ts', true],
    ['scripts/test-database-harness.mjs', true],
    ['tests/unit/example.test.ts', false],
    ['.secrets.baseline', false],
    ['README.md', false],
  ])('retains existing PR integration relevance for %s', (filename, expected) => {
    const result = scopeOutputs(workflow, { INTEGRATION: String(matches('integration', filename)) })
    expect(result.output).toContain(`integration=${expected}`)
  })

  it.each(['success', 'failure'])('preserves Preview trust when classification is %s', (result) => {
    const needs = { paths: { result, outputs: { deployable: 'true' } } }
    expect(conditionDecision(previewWorkflow.jobs['deploy-preview'].if, 'pull_request', needs)).toBe(true)
    expect(
      conditionDecision(previewWorkflow.jobs['deploy-preview'].if, 'pull_request', needs, 'contributor/website'),
    ).toBe(false)
  })

  it.each([
    [['tests/unit/example.test.ts'], false],
    [['tests/e2e/example.spec.tsx'], false],
    [['tests/integration/example.test.ts'], false],
    [['.secrets.baseline', '.github/ISSUE_TEMPLATE/feature.yaml'], false],
    [['README.md', 'docs/contract.md', 'tests/unit/example.test.ts', '.secrets.baseline'], false],
    [['tests/integration/fixtures/example.test.ts'], true],
    [['tests/unit/exampleHelper.test.ts'], true],
    [['tests/e2e/helpers/example.spec.ts'], true],
    [['tests/setup/unit.test.ts'], true],
    [['src/example.ts', 'tests/unit/example.test.ts'], true],
    [['src/styles.css'], true],
    [['public/icon.svg'], true],
    [['package.json', 'pnpm-lock.yaml'], true],
    [['vitest.config.ts', '.storybook/main.ts', 'src/stories/example.stories.tsx'], true],
    [['docs/script.mjs', 'scripts/tool.mjs'], true],
    [['.github/workflows/deploy.yml', '.github/filters/validation.yml'], true],
    [['unknown.md'], true],
    [['GLOSSARY.md', 'DESIGN.md', 'CONTRIBUTING.md'], true],
    [['docs/old.md', 'src/new.ts'], true],
    [['src/old.ts', 'docs/new.md'], true],
    [['tests/unit/old.test.ts', 'tests/unit/new.test.ts'], false],
  ])('routes native changed paths %j to CI and Preview build = %s', (filenames, expected) => {
    for (const target of [workflow, previewWorkflow]) {
      const nativeOutputs = {
        CHANGED: 'true',
        NON_MARKDOWN: String(filenames.some((filename) => matches('non_markdown', filename, target))),
        DEPLOYABLE: String(filenames.some((filename) => matches('deployable', filename, target))),
        INTEGRATION: String(filenames.some((filename) => matches('integration', filename, target))),
        TEST_SUPPORT: String(filenames.some((filename) => matches('test_support', filename, target))),
        CHANGED_COUNT: String(filenames.length),
        PR_CHANGED_COUNT: String(filenames.length),
      }
      const result = scopeOutputs(target, nativeOutputs)
      expect(result.status).toBe(0)
      expect(result.output).toContain(`deployable=${expected}`)
      if (!expected) expect(result.summary).toContain('every changed path is an approved test case')
    }
  })

  it.each([
    [{ CHANGED: 'false', CHANGED_COUNT: '0', PR_CHANGED_COUNT: '0' }, 0, 'true'],
    [{ EVENT_NAME: 'workflow_dispatch' }, 0, 'true'],
    [{ CHANGED_COUNT: '2', PR_CHANGED_COUNT: '1' }, 0, 'false'],
    [{ CHANGED_COUNT: '3000', PR_CHANGED_COUNT: '3001' }, 1, ''],
    [{ CHANGED_COUNT: '1', PR_CHANGED_COUNT: '2' }, 1, ''],
    [{ CHANGED_COUNT: '3', PR_CHANGED_COUNT: '1' }, 1, ''],
    [{ CHANGED_COUNT: '1', PR_CHANGED_COUNT: '0' }, 1, ''],
    [{ CHANGED_COUNT: '0' }, 1, ''],
    [{ CHANGED_COUNT: '' }, 1, ''],
    [{ PR_CHANGED_COUNT: '' }, 1, ''],
    [{ CHANGED_COUNT: 'invalid' }, 1, ''],
    [{ DEPLOYABLE: '' }, 1, ''],
    [{ TEST_SUPPORT: '' }, 1, ''],
  ])('preserves conservative native-output handling for %j', (nativeOutputs, status, expected) => {
    for (const target of [workflow, previewWorkflow]) {
      const result = scopeOutputs(target, nativeOutputs)
      expect(result.status).toBe(status)
      if (status === 0) expect(result.output).toContain(`deployable=${expected}`)
    }
  })

  it.each(['failure', 'cancelled', 'skipped'])('reports failed Preview classification %s', (result) => {
    const needs = { paths: { result, outputs: {} } }
    expect(conditionDecision(previewWorkflow.jobs['deploy-preview'].if, 'pull_request', needs)).toBe(true)
    expect(conditionDecision(previewWorkflow.jobs['deploy-preview'].steps[0].if, 'pull_request', needs)).toBe(true)
  })

  it.each(['pull_request', 'push'])('permits matching CI and Preview build omissions on %s', (event) => {
    const needs = {
      paths: { result: 'success', outputs: { validation: 'true', deployable: 'false', integration: 'true' } },
      'ci-static': { result: 'success' },
      'unit-tests': { result: 'success' },
      'storybook-tests': { result: 'success' },
    }
    expect(conditionDecision(workflow.jobs.build.if, event, needs)).toBe(false)
    expect(conditionDecision(previewWorkflow.jobs['deploy-preview'].if, event, needs)).toBe(false)
    expect(conditionDecision(workflow.jobs['integration-tests'].if, event, needs)).toBe(true)
  })
})

describe('native integration selection routing', () => {
  it('allows only complete modified-existing-case evidence to reach native Vitest discovery', () => {
    const result = scopeOutputs(workflow, {
      INTEGRATION: 'true',
      MODIFIED_INTEGRATION: 'true',
      MODIFIED_INTEGRATION_COUNT: '1',
      MODIFIED_INTEGRATION_FILES: '["tests/integration/countries.lifecycle.test.ts"]',
    })
    expect(result.status).toBe(0)
    expect(result.output).toContain('integration_files=["tests/integration/countries.lifecycle.test.ts"]')
  })

  it.each([
    { MODIFIED_INTEGRATION: 'false' },
    { MODIFIED_INTEGRATION_COUNT: '0' },
    { MODIFIED_INTEGRATION_COUNT: '2' },
    { MODIFIED_INTEGRATION_COUNT: '' },
    { MODIFIED_INTEGRATION_FILES: '[]' },
    { MODIFIED_INTEGRATION_FILES: 'invalid' },
    { CHANGED_COUNT: '2', PR_CHANGED_COUNT: '2' },
    { CHANGED_COUNT: '2', PR_CHANGED_COUNT: '1' },
    { TEST_SUPPORT: 'true' },
    { EVENT_NAME: 'push' },
    { EVENT_NAME: 'workflow_dispatch' },
  ])('uses full integration when native selection evidence is unsafe %j', (outputs) => {
    const result = scopeOutputs(workflow, {
      INTEGRATION: 'true',
      MODIFIED_INTEGRATION: 'true',
      MODIFIED_INTEGRATION_COUNT: '1',
      MODIFIED_INTEGRATION_FILES: '["tests/integration/countries.lifecycle.test.ts"]',
      ...outputs,
    })
    expect(result.status).toBe(0)
    expect(result.output).toContain('integration_files=[]')
    expect(result.output).toContain('integration=true')
  })

  it.each([
    'src/styles.css',
    'unknown.txt',
    'unknown.md',
    'package.json',
    'pnpm-lock.yaml',
    'vitest.integration.config.ts',
    'tests/integration/contracts/collectionContractRegistry.ts',
    'tests/integration/README.md',
    'tests/setup/README.md',
  ])('runs full integration for shared or unknown input %s', (filename) => {
    const result = scopeOutputs(workflow, {
      INTEGRATION: String(matches('integration', filename)),
      NON_MARKDOWN: String(matches('non_markdown', filename)),
    })
    expect(result.output).toContain('integration=true')
    expect(result.output).toContain('integration_files=[]')
  })

  it('keeps Main integration required for Markdown inside full-suite inputs', () => {
    const result = scopeOutputs(workflow, { EVENT_NAME: 'push', INTEGRATION: 'true', NON_MARKDOWN: 'false' })
    expect(result.output).toContain('integration=true')
  })
})

describe('integration coverage when other Markdown lanes are omitted', () => {
  it.each([
    ['success', 'full', 0],
    ['success', 'partial', 0],
    ['success', '', 1],
    ['success', 'unknown', 1],
    ['failure', 'partial', 1],
    ['cancelled', 'full', 1],
    ['skipped', '', 1],
  ])(
    'requires integration result %s and mode %s independently of validation=false',
    (integrationResult, mode, expectedStatus) => {
      const directory = mkdtempSync(path.join(tmpdir(), 'ci-markdown-integration-coverage-'))
      const output = path.join(directory, 'output')
      try {
        const result = spawnSync(
          'bash',
          [
            '-c',
            workflow.jobs['coverage-merge'].steps.find((step: { id?: string }) => step.id === 'coverage_inputs').run,
          ],
          {
            env: {
              ...process.env,
              EVENT_NAME: 'pull_request',
              PATHS_RESULT: 'success',
              VALIDATION: 'false',
              INTEGRATION: 'true',
              UNIT_RESULT: 'skipped',
              STORYBOOK_RESULT: 'skipped',
              INTEGRATION_RESULT: integrationResult,
              INTEGRATION_MODE: mode,
              GITHUB_OUTPUT: output,
              GITHUB_STEP_SUMMARY: path.join(directory, 'summary'),
            },
            encoding: 'utf8',
          },
        )
        expect(result.status).toBe(expectedStatus)
        if (expectedStatus === 0) {
          expect(readFileSync(output, 'utf8')).toContain('sources=integration')
          expect(readFileSync(output, 'utf8')).toContain('required=true')
          expect(readFileSync(path.join(directory, 'summary'), 'utf8')).toContain(
            'Unit and Storybook reports intentionally absent',
          )
        }
      } finally {
        rmSync(directory, { recursive: true, force: true })
      }
    },
  )
})
