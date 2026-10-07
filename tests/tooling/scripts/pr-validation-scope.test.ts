import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
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
const preview = parse(readFileSync(path.join(repositoryRoot, '.github/workflows/deploy-preview.yml'), 'utf8'))
const buildFilters = parse(readFileSync(path.join(repositoryRoot, '.github/filters/build.yml'), 'utf8'))
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

  it('preserves fail-closed detection and non-PR validation gates', () => {
    expect(workflow.jobs['ci-static'].if).toContain("(needs.paths.result != 'success'")
    expect(workflow.jobs['ci-static'].steps[0]).toMatchObject({
      if: "needs.paths.result != 'success'",
      run: 'exit 1',
    })
    for (const job of ['ci-static', 'unit-tests', 'storybook-tests']) {
      expect(workflow.jobs[job].if).toContain("github.event_name != 'pull_request'")
      expect(workflow.jobs[job].if).toContain("needs.paths.outputs.validation == 'true'")
    }
  })

  it.each([
    ['success', 'pull_request', 'false', 'true', true],
    ['success', 'pull_request', 'true', 'false', false],
    ['success', 'pull_request', 'true', 'true', true],
    ['success', 'push', 'false', 'false', false],
    ['success', 'push', 'true', 'true', true],
    ['success', 'workflow_dispatch', 'false', 'true', true],
    ['success', 'schedule', 'true', 'true', false],
    ['failure', 'schedule', '', '', false],
    ['failure', 'pull_request', '', '', true],
  ])('routes an independent build for %s / %s / %s / %s', (result, event, validation, deployable, expected) => {
    const build = workflow.jobs.build
    expect(build.needs).toBe('paths')
    const run = runInNewContext(build.if, {
      always: () => true,
      cancelled: () => false,
      needs: { paths: { result, outputs: { validation, deployable } } },
      github: { event_name: event },
    })
    expect(run).toBe(expected)
    expect(build.steps[0]).toMatchObject({ if: "needs.paths.result != 'success'", run: 'exit 1' })
  })

  it.each([
    [['tests/integration/access.test.ts'], false],
    [['.github/workflows/deploy.yml', 'docs/build.md'], false],
    [['.storybook/main.ts', 'src/stories/Button.stories.tsx'], false],
    [['src/components/Button.stories.tsx', 'config/coverage/vitest.thresholds.unit.js'], false],
    [['.codex/agents/test_reviewer.toml', 'AGENTS.md', 'eslint.config.mjs'], false],
    [['src/app/page.tsx'], true],
    [['src/collections/Clinics.ts', 'tests/integration/clinics.test.ts'], true],
    [['public/logo.svg'], true],
    [['package.json', 'pnpm-lock.yaml'], true],
    [['.npmrc', 'tsconfig.json', 'next.config.js', 'vercel.json'], true],
    [['patches/dependency.patch', 'pnpm-workspace.yaml'], true],
    [['.codex/scripts/payload-migration.sh'], true],
    [['scripts/validate-runtime-env.mjs', 'apps/preview-email-scheduler/api/index.ts'], true],
    [['unknown-runtime-config.json'], true],
    [['src/content/article.mdx'], true],
    [['docs/old.md', 'src/new.ts'], true],
    [['src/old.ts', 'docs/new.md'], true],
  ])('requires builds for relevant paths %j = %s', (filenames, expected) => {
    for (const target of [workflow, preview]) {
      const step = target.jobs.paths.steps.find(
        (candidate: { with?: { filters?: string } }) => candidate.with?.filters === '.github/filters/build.yml',
      )
      expect(step.with['predicate-quantifier']).toBe('every')
      const patterns = buildFilters.deployable as string[]
      expect(
        filenames.some((filename) => patterns.every((pattern) => picomatch(pattern, { dot: true })(filename))),
      ).toBe(expected)
    }
  })

  it.each([
    ['schedule', 'skipped', 'success', 'false', 'true', false, true],
    ['schedule', 'skipped', 'failure', '', '', false, false],
    ['schedule', 'skipped', 'success', 'false', 'true', true, false],
    ['pull_request', 'success', 'success', 'true', 'true', false, true],
    ['pull_request', 'success', 'success', 'true', 'false', false, false],
    ['pull_request', 'failure', 'success', 'true', 'true', false, false],
    ['push', 'success', 'success', 'true', 'false', false, true],
    ['push', 'success', 'success', 'false', 'true', false, false],
    ['workflow_dispatch', 'success', 'success', 'true', 'true', false, true],
  ])(
    'routes integration for %s / static %s / scope %s',
    (event, staticResult, result, deployable, integration, cancelled, expected) => {
      const context = {
        cancelled: () => cancelled,
        needs: {
          paths: { result, outputs: { deployable, integration } },
          'ci-static': { result: staticResult },
        },
        github: { event_name: event, ref: 'refs/heads/main' },
      }
      expect(
        runInNewContext(
          workflow.jobs['integration-shards'].if.replaceAll('needs.ci-static', "needs['ci-static']"),
          context,
        ),
      ).toBe(expected)
    },
  )

  it('runs only complete integration validation on the nightly event', () => {
    const context = {
      always: () => true,
      cancelled: () => false,
      github: { event_name: 'schedule' },
      needs: { paths: { result: 'success', outputs: { validation: 'true', deployable: 'true' } } },
    }
    expect(workflow.on.schedule).toHaveLength(1)
    for (const name of ['ci-static', 'unit-tests', 'storybook-tests', 'build', 'coverage-merge']) {
      expect(runInNewContext(workflow.jobs[name].if.replace(/^\$\{\{\s*|\s*\}\}$/g, ''), context)).toBe(false)
    }
    expect(
      workflow.jobs['integration-shards'].steps.find((step: { id?: string }) => step.id === 'integration').run,
    ).not.toContain('--changed')
  })

  it('keeps nightly integration runs outside Main push cancellation', () => {
    const group = (event: string) =>
      workflow.concurrency.group.replace(/\$\{\{\s*([\s\S]+?)\s*\}\}/g, (_match: string, expression: string) =>
        String(
          runInNewContext(expression, {
            github: { workflow: 'PR Validation', event_name: event, ref: 'refs/heads/main' },
          }),
        ),
      )
    expect(group('schedule')).not.toBe(group('push'))
  })

  it('does not start an independent build when the run is cancelled', () => {
    expect(
      runInNewContext(workflow.jobs.build.if, {
        always: () => true,
        cancelled: () => true,
        github: { event_name: 'pull_request' },
        needs: { paths: { result: 'failure', outputs: {} } },
      }),
    ).toBe(false)
  })

  it.each([
    ['schedule', 'false', 'false', 'false', 'true'],
    ['workflow_dispatch', '', '', 'true', 'true'],
    ['pull_request', 'false', 'true', 'false', 'true'],
    ['push', 'true', 'false', 'true', 'false'],
  ])('emits scope outputs for %s', (event, detectedBuild, detectedIntegration, deployable, integration) => {
    const directory = mkdtempSync(path.join(tmpdir(), 'ci-path-outputs-'))
    try {
      const outputFile = path.join(directory, 'outputs')
      const step = workflow.jobs.paths.steps.find((candidate: { id?: string }) => candidate.id === 'set-path-outputs')
      const script = step.run
        .replaceAll('${{ github.event_name }}', event)
        .replaceAll('${{ steps.build-filter.outputs.deployable }}', detectedBuild)
        .replaceAll('${{ steps.filter.outputs.integration }}', detectedIntegration)
      const result = spawnSync('bash', ['-c', script], { env: { ...process.env, GITHUB_OUTPUT: outputFile } })
      expect(result.status).toBe(0)
      expect(readFileSync(outputFile, 'utf8')).toBe(`deployable=${deployable}\nintegration=${integration}\n`)
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  it.each([
    ['pull_request', 'true', 'owner/website', true],
    ['pull_request', 'false', 'owner/website', false],
    ['pull_request', 'true', 'fork/website', false],
    ['push', 'true', 'owner/website', true],
    ['push', 'false', 'owner/website', false],
    ['workflow_dispatch', 'true', 'owner/website', true],
  ])('preserves Preview scope and trust for %s / %s / %s', (event, deployable, headRepository, expected) => {
    expect(preview.jobs['deploy-preview'].needs).toBe('paths')
    const context = {
      needs: { paths: { outputs: { deployable } } },
      github: {
        event_name: event,
        ref_name: 'main',
        repository: 'owner/website',
        event: { pull_request: { head: { repo: { full_name: headRepository } } } },
      },
    }
    expect(runInNewContext(preview.jobs['deploy-preview'].if, context)).toBe(expected)
  })

  it.each(['success', 'failure', 'cancelled', 'skipped'])('preserves the aggregate shard verdict for %s', (result) => {
    const job = workflow.jobs['integration-tests']
    const context = {
      always: () => true,
      cancelled: () => false,
      needs: { 'integration-shards': { result } },
    }
    // GitHub accepts hyphens in property names; JavaScript uses bracket access.
    const evaluate = (expression: string) =>
      runInNewContext(expression.replaceAll('needs.integration-shards', "needs['integration-shards']"), context)

    expect(job.name).toBe('Integration Tests')
    expect(job.needs).toBe('integration-shards')
    expect(evaluate(job.if)).toBe(result !== 'skipped')
    const guard = job.steps.find((step: { name?: string }) => step.name === 'Require successful integration shards')
    expect(evaluate(guard.if)).toBe(result !== 'success')
    expect(guard.run).toBe('exit 1')
  })

  it.each(['complete', 'missing', 'empty'])('rejects incomplete shard reports: %s', (scenario) => {
    const directory = mkdtempSync(path.join(tmpdir(), 'integration-reports-'))
    try {
      const reportDirectory = path.join(directory, 'coverage/integration-blobs')
      mkdirSync(reportDirectory, { recursive: true })
      const shardIndices = workflow.jobs['integration-shards'].strategy.matrix.shard as number[]
      for (const shard of shardIndices) {
        if (scenario === 'missing' && shard === shardIndices.at(-1)) continue
        const contents = scenario === 'empty' && shard === shardIndices.at(-1) ? '' : '{}'
        writeFileSync(path.join(reportDirectory, `blob-${shard}.json`), contents)
      }
      const guard = workflow.jobs['integration-tests'].steps.find(
        (step: { name?: string }) => step.name === 'Require every integration shard report',
      )
      const result = spawnSync('bash', ['-c', guard.run], { cwd: directory })
      expect(result.status === 0).toBe(scenario === 'complete')
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })
})
