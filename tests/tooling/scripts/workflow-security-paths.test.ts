import { afterEach, describe, expect, it } from 'vitest'
import { execFileSync, spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parse } from 'yaml'

const require = createRequire(import.meta.url)
const picomatch = require('../../../node_modules/.pnpm/picomatch@2.3.2/node_modules/picomatch')
const workflow = parse(readFileSync('.github/workflows/workflow-security.yml', 'utf8'))
const job = workflow.jobs['workflow-security']
const step = (name: string) => job.steps.find((candidate: { name?: string }) => candidate.name === name)
const filters = parse(step('Select changed security files').with.filters)
const directories: string[] = []

function selects(filter: string, file: string, status = 'modified') {
  return filters[filter].some((rule: Record<string, string>) =>
    Object.entries(rule).some(
      ([statuses, pattern]) => statuses.split('|').includes(status) && picomatch(pattern, { dot: true })(file),
    ),
  )
}

function sandbox() {
  const directory = mkdtempSync(join(tmpdir(), 'workflow-security-'))
  directories.push(directory)
  mkdirSync(join(directory, '.github/workflows'), { recursive: true })
  return directory
}

function runStep(name: string, cwd: string, event: string, files: string[], extraEnv = {}) {
  return spawnSync('bash', ['-c', step(name).run], {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      EVENT_NAME: event,
      CHANGED_FILES: JSON.stringify(files),
      GITHUB_OUTPUT: join(cwd, 'outputs'),
      ...extraEnv,
    },
  })
}

afterEach(() => directories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true })))

describe('Workflow Security path selection', () => {
  it.each(['added', 'modified', 'copied'])('selects existing workflow/action files with status %s', (status) => {
    expect(selects('workflows', '.github/workflows/check.yaml', status)).toBe(true)
    expect(selects('workflows', '.github/actions/.hidden/action.yml', status)).toBe(true)
    expect(selects('secrets', 'src/config.ts', status)).toBe(true)
  })

  it('excludes removed paths and includes the new path of normalized renames', () => {
    expect(selects('workflows', '.github/workflows/old.yml', 'deleted')).toBe(false)
    expect(selects('workflows', '.github/workflows/new.yml', 'added')).toBe(true)
    expect(selects('secrets', 'src/deleted.ts', 'deleted')).toBe(false)
  })

  it.each(['pnpm-lock.yaml', 'nested/pnpm-lock.yaml', '.hidden/pnpm-lock.yaml'])('excludes lockfile %s', (file) => {
    expect(selects('secrets', file)).toBe(false)
  })

  it.each(['README.md', '.hidden/config', 'nested/file with spaces', 'nested/$(touch marker);file'])(
    'retains changed file %s for secrets',
    (file) => {
      expect(selects('secrets', file)).toBe(true)
    },
  )

  it('limits Zizmor to action files and workflow YAML', () => {
    expect(selects('workflows', 'README.md')).toBe(false)
    expect(selects('workflows', '.github/workflows/README.md')).toBe(false)
    expect(selects('workflows', '.github/actions/nested/script.sh')).toBe(true)
  })

  it('passes ordinary selected files to the pinned Zizmor action', () => {
    const cwd = sandbox()
    expect(runStep('Determine zizmor inputs', cwd, 'pull_request', ['.github/workflows/check.yml']).status).toBe(0)
    expect(readFileSync(join(cwd, 'outputs'), 'utf8')).toBe('inputs=.github/workflows/check.yml\n')
  })

  it.each(['with spaces', '$(touch marker)', 'glob*', 'line\nbreak'])(
    'uses safe directory inputs for names containing %s',
    (name) => {
      const cwd = sandbox()
      expect(runStep('Determine zizmor inputs', cwd, 'pull_request', [`.github/workflows/${name}.yml`]).status).toBe(0)
      expect(readFileSync(join(cwd, 'outputs'), 'utf8')).toBe('inputs=.github/workflows\n')
      expect(existsSync(join(cwd, 'marker'))).toBe(false)
    },
  )

  it.each(['pull_request', 'push', 'schedule', 'workflow_dispatch'])(
    'retains full Zizmor enumeration for %s without selected files',
    (event) => {
      const cwd = sandbox()
      execFileSync('git', ['init', '--quiet'], { cwd })
      writeFileSync(join(cwd, '.github/workflows/full.yml'), '')
      execFileSync('git', ['add', '.'], { cwd })
      expect(runStep('Determine zizmor inputs', cwd, event, []).status).toBe(0)
      expect(readFileSync(join(cwd, 'outputs'), 'utf8')).toBe('inputs=.github/workflows/full.yml\n')
    },
  )

  it('passes exact JSON filenames as scanner arguments without shell interpretation', () => {
    const cwd = sandbox()
    const files = ['file with spaces', '$(touch marker)', 'glob*', "quote'file", 'line\nbreak', '--exclude-files']
    writeFileSync(
      join(cwd, 'detect-secrets-hook'),
      '#!/usr/bin/env python3\nimport json,sys\nopen("arguments", "w").write(json.dumps(sys.argv[1:]))\n',
      { mode: 0o755 },
    )
    expect(runStep('Detect secrets', cwd, 'pull_request', files, { PATH: `${cwd}:${process.env.PATH}` }).status).toBe(0)
    expect(JSON.parse(readFileSync(join(cwd, 'arguments'), 'utf8'))).toEqual([
      '--baseline',
      '.secrets.baseline',
      '--',
      ...files,
    ])
    expect(existsSync(join(cwd, 'marker'))).toBe(false)
  })

  it.each(['push', 'schedule', 'workflow_dispatch'])('runs full secret scanning for %s', (event) => {
    const cwd = sandbox()
    writeFileSync(
      join(cwd, 'detect-secrets'),
      '#!/usr/bin/env python3\nimport json,sys\nopen("arguments", "w").write(json.dumps(sys.argv[1:]))\n',
      { mode: 0o755 },
    )
    expect(runStep('Detect secrets', cwd, event, [], { PATH: `${cwd}:${process.env.PATH}` }).status).toBe(0)
    expect(JSON.parse(readFileSync(join(cwd, 'arguments'), 'utf8'))).toEqual([
      'scan',
      '--baseline',
      '.secrets.baseline',
    ])
  })

  it('skips empty PR secret selections and fails closed on malformed selection', () => {
    const cwd = sandbox()
    expect(runStep('Detect secrets', cwd, 'pull_request', []).status).toBe(0)
    expect(runStep('Detect secrets', cwd, 'pull_request', [], { CHANGED_FILES: 'invalid' }).status).not.toBe(0)
    expect(runStep('Determine zizmor inputs', cwd, 'pull_request', [], { CHANGED_FILES: 'invalid' }).status).not.toBe(0)
    expect(step('Select changed security files')['continue-on-error']).toBeUndefined()
    expect(step('Detect secrets').if).toBeUndefined()
    expect(job.permissions).toEqual({ contents: 'read', 'pull-requests': 'read' })
  })
})
