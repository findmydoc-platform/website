import { execFileSync, spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const repositoryRoot = path.resolve(import.meta.dirname, '../../..')
let directory: string

function git(...args: string[]) {
  return execFileSync('git', args, { cwd: directory, encoding: 'utf8' }).trim()
}

function write(file: string, content: string) {
  mkdirSync(path.dirname(path.join(directory, file)), { recursive: true })
  writeFileSync(path.join(directory, file), content)
}

function commit(file: string, content: string) {
  write(file, content)
  git('add', '--', file)
  git('-c', 'core.hooksPath=/dev/null', 'commit', '--quiet', '--message', 'fixture change')
  return git('rev-parse', 'HEAD')
}

function runHook(hook: 'pre-commit' | 'pre-push', input = '', env: Record<string, string> = {}) {
  return spawnSync(
    hook === 'pre-commit' ? process.execPath : 'bash',
    hook === 'pre-commit' ? ['scripts/pre-commit-check.mjs'] : [`.githooks/${hook}`, 'origin', 'unused'],
    {
      cwd: directory,
      input,
      encoding: 'utf8',
      env: { ...process.env, PATH: `${directory}/bin:${process.env.PATH}`, ...env },
    },
  )
}

const calls = () =>
  readFileSync(path.join(directory, 'calls.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as string[])
beforeEach(() => {
  directory = mkdtempSync(path.join(tmpdir(), 'local-quality-hooks-'))
  git('init', '--quiet')
  git('config', 'user.email', 'hooks@example.test')
  git('config', 'user.name', 'Hook test')
  for (const file of ['.githooks/pre-commit', '.githooks/pre-push', 'scripts/pre-commit-check.mjs']) {
    mkdirSync(path.dirname(path.join(directory, file)), { recursive: true })
    copyFileSync(path.join(repositoryRoot, file), path.join(directory, file))
  }
  write('package.json', '{"dependencies":{"example":"1.0.0"}}\n')
  write('pnpm-lock.yaml', "lockfileVersion: '9.0'\n# original\n")
  write('src/foreign.ts', 'export const foreignWork = false\n')
  git('add', '.')
  git('-c', 'core.hooksPath=/dev/null', 'commit', '--quiet', '--message', 'fixture base')
  write('calls.jsonl', '')
  write(
    'bin/pnpm',
    `#!${process.execPath}
const fs = require('node:fs')
const args = process.argv.slice(2)
fs.appendFileSync('calls.jsonl', JSON.stringify(args) + '\\n')
if (args[0] === 'deps:dedupe:check' && process.env.CHECK_ERROR) {
  console.error(process.env.CHECK_ERROR)
  process.exit(1)
}
if (args[0] === 'dedupe') {
  fs.writeFileSync('pnpm-lock.yaml', "lockfileVersion: '9.0'\\n# deduplicated\\n")
  if (process.env.REPAIR_FAIL) process.exit(1)
}
if (args[0] === 'deadcode:check') process.exit(Number(process.env.KNIP_STATUS || 0))
`,
  )
  execFileSync('chmod', ['+x', path.join(directory, 'bin/pnpm')])
})

afterEach(() => rmSync(directory, { recursive: true, force: true }))

describe('dependency commit hook', () => {
  it('formats documentation without invoking dedupe', () => {
    write('docs/read me.md', 'Documentation\n')
    git('add', '--', 'docs/read me.md')
    expect(runHook('pre-commit').status).toBe(0)
    expect(calls().map((args) => args[0])).toEqual(['exec'])
  })

  it('checks dependency changes and stages a successful repair in the same commit', () => {
    write('package.json', '{"dependencies":{"example":"1.1.0"}}\n')
    write('pnpm-lock.yaml', "lockfileVersion: '9.0'\n# dependency change\n")
    write('src/foreign.ts', 'Unstaged work\n')
    git('add', '--', 'package.json', 'pnpm-lock.yaml')
    expect(runHook('pre-commit', '', { CHECK_ERROR: 'ERR_PNPM_DEDUPE_CHECK_ISSUES' }).status).toBe(0)
    expect(calls().slice(0, 2)).toEqual([['deps:dedupe:check'], ['dedupe', '--lockfile-only', '--ignore-scripts']])
    expect(git('show', ':pnpm-lock.yaml')).toContain('# deduplicated')
    expect(git('diff', '--name-only', '--', 'pnpm-lock.yaml')).toBe('')
    expect(readFileSync(path.join(directory, 'src/foreign.ts'), 'utf8')).toBe('Unstaged work\n')
    expect(git('diff', '--cached', '--name-only')).not.toContain('src/foreign.ts')
  })

  it('leaves a clean dependency lockfile alone', () => {
    write('pnpm-lock.yaml', "lockfileVersion: '9.0'\n# dependency change\n")
    git('add', '--', 'pnpm-lock.yaml')
    const staged = git('show', ':pnpm-lock.yaml')
    expect(runHook('pre-commit').status).toBe(0)
    expect(calls().some((args) => args[0] === 'dedupe')).toBe(false)
    expect(git('show', ':pnpm-lock.yaml')).toBe(staged)
  })

  it.each([
    'ERR_PNPM_FETCH_401',
    'ERR_PNPM_FETCH_404',
    'ERR_PNPM_NO_OFFLINE_META',
    'ETIMEDOUT',
    'ERR_PNPM_DEDUPE_CHECK_ISSUES ERR_PNPM_FETCH_401',
  ])('does not repair on check failure %s', (failure) => {
    write('pnpm-lock.yaml', "lockfileVersion: '9.0'\n# dependency change\n")
    git('add', '--', 'pnpm-lock.yaml')
    const staged = git('show', ':pnpm-lock.yaml')
    const result = runHook('pre-commit', '', { CHECK_ERROR: failure })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('No repair attempted')
    expect(calls()).toEqual([['deps:dedupe:check']])
    expect(git('show', ':pnpm-lock.yaml')).toBe(staged)
    expect(git('diff', '--name-only')).toBe('')
  })

  it('restores the lockfile and preserves the index when repair fails', () => {
    write('pnpm-lock.yaml', "lockfileVersion: '9.0'\n# dependency change\n")
    git('add', '--', 'pnpm-lock.yaml')
    const staged = git('show', ':pnpm-lock.yaml')
    expect(runHook('pre-commit', '', { CHECK_ERROR: 'ERR_PNPM_DEDUPE_CHECK_ISSUES', REPAIR_FAIL: '1' }).status).toBe(1)
    expect(git('show', ':pnpm-lock.yaml')).toBe(staged)
    expect(git('diff', '--name-only')).toBe('')
  })

  it.each(['package.json', 'pnpm-lock.yaml', 'docs/partial.md'])(
    'rejects partially staged %s before running tools',
    (file) => {
      write(file, 'staged content\n')
      git('add', '--', file)
      write(file, 'staged content\nunstaged content\n')
      const result = runHook('pre-commit')
      expect(result.status).toBe(1)
      expect(result.stderr).toContain('partially staged')
      expect(calls()).toEqual([])
      expect(git('show', `:${file}`)).toBe('staged content')
      expect(readFileSync(path.join(directory, file), 'utf8')).toContain('unstaged content')
    },
  )

  it('rejects a lockfile commit with an unstaged manifest', () => {
    write('pnpm-lock.yaml', "lockfileVersion: '9.0'\n# dependency change\n")
    git('add', '--', 'pnpm-lock.yaml')
    write('package.json', '{"dependencies":{"example":"2.0.0"}}\n')
    expect(runHook('pre-commit').stderr).toContain('unstaged dependency changes')
    expect(calls()).toEqual([])
  })

  it('preserves the staged manifest-without-lockfile guard', () => {
    write('package.json', '{"dependencies":{"example":"2.0.0"}}\n')
    git('add', '--', 'package.json')
    expect(runHook('pre-commit').stderr).toContain('package.json is staged without pnpm-lock.yaml')
    expect(calls()).toEqual([])
  })
})

describe('dead-code push hook', () => {
  it.each(['docs/latest.md', 'src/feature.ts'])('runs Knip on every push, including %s', (file) => {
    commit(file, 'changed\n')
    expect(runHook('pre-push').status).toBe(0)
    expect(calls()).toEqual([['deadcode:check'], ['ai:slop-check:prepush']])
  })

  it.each([1, 2])('blocks the push when Knip exits with status %s', (status) => {
    expect(runHook('pre-push', '', { KNIP_STATUS: String(status) }).status).toBe(status)
    expect(calls()).toEqual([['deadcode:check']])
  })
})

describe('Knip production analysis', () => {
  it('analyzes Payload JSX imports statically and detects an unused source file', () => {
    copyFileSync(path.join(repositoryRoot, 'knip.jsonc'), path.join(directory, 'knip.jsonc'))
    write('package.json', '{"dependencies":{"payload":"3.88.0"}}\n')
    write(
      'src/payload.config.ts',
      "import { AdminView } from './view'\nimport { foreignWork } from './foreign'\nexport default { AdminView, foreignWork }\n",
    )
    write('src/view.tsx', 'export const AdminView = () => <div>Admin</div>\n')
    write('src/unused.ts', 'export const unused = true\n')
    const analyze = () =>
      spawnSync(
        process.execPath,
        [
          path.join(repositoryRoot, 'node_modules/knip/bin/knip.js'),
          '--production',
          '--strict',
          '--include',
          'files,exports',
          '--reporter',
          'json',
        ],
        { cwd: directory, encoding: 'utf8' },
      )

    const unusedResult = analyze()
    expect(unusedResult.status).toBe(1)
    expect(JSON.parse(unusedResult.stdout).issues).toEqual([
      { file: 'src/unused.ts', files: [{ name: 'src/unused.ts' }], exports: [] },
    ])
    rmSync(path.join(directory, 'src/unused.ts'))
    expect(analyze().status).toBe(0)
  })
})
