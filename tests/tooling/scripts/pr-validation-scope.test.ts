import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { runInNewContext } from 'node:vm'

import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

const repositoryRoot = path.resolve(import.meta.dirname, '../../..')
const workflow = parse(readFileSync(path.join(repositoryRoot, '.github/workflows/deploy.yml'), 'utf8'))
const previewWorkflow = parse(readFileSync(path.join(repositoryRoot, '.github/workflows/deploy-preview.yml'), 'utf8'))

const conditionDecision = (
  expression: string,
  event: string,
  needs: Record<string, unknown>,
  headRepository = 'findmydoc-platform/website',
  authorLogin = 'human-contributor',
) =>
  runInNewContext(expression.replace(/needs\.([\w-]+)/g, 'needs["$1"]'), {
    always: () => true,
    github: {
      event_name: event,
      ref: 'refs/heads/main',
      ref_name: 'main',
      repository: 'findmydoc-platform/website',
      event: {
        pull_request: {
          head: { repo: { full_name: headRepository } },
          user: { login: authorLogin },
        },
      },
    },
    needs,
  }) as boolean

describe('PR application validation job gates', () => {
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
            cwd: repositoryRoot,
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
        cwd: repositoryRoot,
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
  it.each(['success', 'failure'])('preserves Preview trust when classification is %s', (result) => {
    const needs = { paths: { result, outputs: { deployable: 'true' } } }
    expect(conditionDecision(previewWorkflow.jobs['deploy-preview'].if, 'pull_request', needs)).toBe(true)
    expect(
      conditionDecision(previewWorkflow.jobs['deploy-preview'].if, 'pull_request', needs, 'contributor/website'),
    ).toBe(false)
  })

  it('skips Preview deployment for Dependabot-authored PRs', () => {
    const needs = { paths: { result: 'success', outputs: { deployable: 'true' } } }
    expect(
      conditionDecision(previewWorkflow.jobs['deploy-preview'].if, 'pull_request', needs, undefined, 'dependabot[bot]'),
    ).toBe(false)
  })

  it.each(['push', 'workflow_dispatch'])('preserves Preview deployment for %s events', (event) => {
    const needs = { paths: { result: 'success', outputs: { deployable: 'true' } } }
    expect(conditionDecision(previewWorkflow.jobs['deploy-preview'].if, event, needs)).toBe(true)
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
              INTEGRATION_FILES: mode === 'partial' ? '["tests/integration/countries.lifecycle.test.ts"]' : '[]',
              FULL_INTEGRATION_RESULT: 'success',
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

describe('complete integration aggregation result', () => {
  it.each([
    ['[]', 'failure', 1],
    ['[]', 'cancelled', 1],
    ['[]', 'skipped', 1],
    ['[]', '', 1],
    ['[]', 'success', 0],
    ['["tests/integration/countries.lifecycle.test.ts"]', 'skipped', 0],
  ])('requires the expected full aggregation for files=%s and collector=%s', (files, collectorResult, status) => {
    const directory = mkdtempSync(path.join(tmpdir(), 'ci-full-integration-result-'))
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
            VALIDATION: 'true',
            INTEGRATION: 'true',
            UNIT_RESULT: 'success',
            STORYBOOK_RESULT: 'success',
            INTEGRATION_RESULT: 'success',
            INTEGRATION_MODE: 'full',
            INTEGRATION_FILES: files,
            FULL_INTEGRATION_RESULT: collectorResult,
            GITHUB_OUTPUT: path.join(directory, 'output'),
            GITHUB_STEP_SUMMARY: path.join(directory, 'summary'),
          },
          encoding: 'utf8',
        },
      )
      expect(result.status).toBe(status)
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })
})
