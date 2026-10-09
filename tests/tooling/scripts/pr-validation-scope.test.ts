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
const filterStep = workflow.jobs.paths.steps.find((step: { id?: string }) => step.id === 'filter')
const filters = parse(filterStep.with.filters) as Record<'changed' | 'non_markdown', string[]>

const matches = (name: keyof typeof filters, filename: string) =>
  filters[name].some((pattern) => picomatch(pattern, { dot: true })(filename))

const validationDecision = (filenames: string[]) => {
  const outputs = {
    changed: String(filenames.some((filename) => matches('changed', filename))),
    non_markdown: String(filenames.some((filename) => matches('non_markdown', filename))),
  }
  const expression = workflow.jobs.paths.outputs.validation.replace(/^\$\{\{\s*|\s*\}\}$/g, '')
  // The workflow output is a boolean expression over action outputs, with no shell execution.
  return runInNewContext(expression, { steps: { filter: { outputs } } }) as boolean
}

const conditionDecision = (expression: string, event: string, needs: Record<string, unknown>) =>
  runInNewContext(expression.replace(/needs\.([\w-]+)/g, 'needs["$1"]'), {
    always: () => true,
    github: { event_name: event, ref: 'refs/heads/main' },
    needs,
  }) as boolean

describe('PR application validation workflow filters', () => {
  it('uses the pinned action and its default some predicate', () => {
    expect(filterStep.uses).toBe('dorny/paths-filter@fbd0ab8f3e69293af611ebaee6363fc25e6d187d')
    expect(filterStep.with['predicate-quantifier'] ?? 'some').toBe('some')
  })

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

  it('uses status-neutral patterns so added, modified and deleted files all participate', () => {
    expect([...filters.changed, ...filters.non_markdown].every((pattern) => typeof pattern === 'string')).toBe(true)
    expect(validationDecision(['src/deleted-or-added.ts'])).toBe(true)
    expect(validationDecision(['docs/deleted-or-added.md'])).toBe(false)
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
