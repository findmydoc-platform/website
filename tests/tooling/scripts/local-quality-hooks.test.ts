import { execFileSync, spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { parse } from 'yaml'

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

function analyzeDeadCode(production = true, report = false) {
  const manifest = JSON.parse(readFileSync(path.join(repositoryRoot, 'package.json'), 'utf8'))
  const command = manifest.scripts[production ? 'deadcode:report:production' : 'deadcode:check'] as string
  const argumentsString = command.split(' knip ')[1]
  if (!argumentsString) throw new Error('Dead-code script must invoke knip')
  const flags = argumentsString.split(' ').filter((flag) => report || flag !== '--no-exit-code')
  return spawnSync(
    process.execPath,
    [path.join(repositoryRoot, 'node_modules/knip/bin/knip.js'), ...flags, '--reporter', 'json'],
    { cwd: directory, encoding: 'utf8' },
  )
}

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
if (args[0] === 'deadcode:report:production') process.exit(Number(process.env.REPORT_STATUS || 0))
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
    expect(calls()).toEqual([['deadcode:report:production'], ['deadcode:check'], ['ai:slop-check:prepush']])
  })

  it.each([1, 2])('blocks the push when Knip exits with status %s', (status) => {
    expect(runHook('pre-push', '', { KNIP_STATUS: String(status) }).status).toBe(status)
    expect(calls()).toEqual([['deadcode:report:production'], ['deadcode:check']])
  })
})

describe('Deep Quality dead-code steps', () => {
  it.each([0, 1, 2])('runs the production report before the full gate and propagates gate status %s', (status) => {
    const workflow = parse(readFileSync(path.join(repositoryRoot, '.github/workflows/deep-quality-lane.yml'), 'utf8'))
    const commands = workflow.jobs['deep-quality'].steps
      .map((step: { run?: string }) => step.run)
      .filter((run?: string): run is string => Boolean(run?.includes('pnpm deadcode:')))
    const result = spawnSync('bash', ['-e', '-c', commands.join('\n')], {
      cwd: directory,
      encoding: 'utf8',
      env: { ...process.env, PATH: `${directory}/bin:${process.env.PATH}`, KNIP_STATUS: String(status) },
    })
    expect(result.status).toBe(status)
    expect(calls()).toEqual([['deadcode:report:production'], ['deadcode:check']])
  })
})

describe('dead-code report failures', () => {
  it('blocks the push on a production analysis error before running subsequent checks', () => {
    expect(runHook('pre-push', '', { REPORT_STATUS: '2' }).status).toBe(2)
    expect(calls()).toEqual([['deadcode:report:production']])
  })
})

describe('Knip analysis', () => {
  it('analyzes Payload JSX imports statically and detects an unused source file', () => {
    copyFileSync(path.join(repositoryRoot, 'knip.jsonc'), path.join(directory, 'knip.jsonc'))
    write('package.json', '{"dependencies":{"payload":"3.88.0"}}\n')
    write(
      'src/payload.config.ts',
      "import { AdminView } from './view'\nimport { foreignWork } from './foreign'\nexport default { AdminView, foreignWork }\n",
    )
    write('src/view.tsx', 'export const AdminView = () => <div>Admin</div>\n')
    write('src/unused.ts', 'export const unused = true\n')
    const unusedResult = analyzeDeadCode()
    expect(unusedResult.status).toBe(1)
    expect(JSON.parse(unusedResult.stdout).issues).toEqual([
      { file: 'src/unused.ts', files: [{ name: 'src/unused.ts' }], exports: [] },
    ])
    rmSync(path.join(directory, 'src/unused.ts'))
    expect(analyzeDeadCode().status).toBe(0)
  })

  it('discovers Next and operational consumers without hiding orphaned application registrations', () => {
    copyFileSync(path.join(repositoryRoot, 'knip.jsonc'), path.join(directory, 'knip.jsonc'))
    write('package.json', '{"dependencies":{"next":"16.3.6","payload":"3.88.0"}}\n')
    write('next.config.js', "import { buildPolicy } from './src/buildPolicy'\nexport default { buildPolicy }\n")
    write('src/buildPolicy.ts', 'export const buildPolicy = {}\n')
    write('src/payload.config.ts', "import { foreignWork } from './foreign'\nexport default { foreignWork }\n")
    write('src/app/page.tsx', "import { runtime } from '../runtime'\nexport default () => <div>{runtime}</div>\n")
    write('src/proxy.ts', "import { validateSession } from './session'\nexport const proxy = validateSession\n")
    write('src/session.ts', 'export const validateSession = () => null\n')
    write(
      'src/runtime.ts',
      "import { resolveRuntimeClass } from './features/runtimePolicy/core'\nexport const runtime = resolveRuntimeClass()\n",
    )
    write('src/features/runtimePolicy/core.ts', "export const resolveRuntimeClass = () => 'typescript-runtime'\n")
    for (const file of ['next-sitemap.config.cjs', 'src/features/runtimePolicy/tooling.cjs']) {
      mkdirSync(path.dirname(path.join(directory, file)), { recursive: true })
      copyFileSync(path.join(repositoryRoot, file), path.join(directory, file))
    }
    write(
      'scripts/permission-matrix/derive-json.ts',
      "import { matrix } from '../../src/security/matrix'\nconsole.log(matrix)\n",
    )
    write('src/security/matrix.ts', 'export const matrix = []\n')
    write('scripts/lettermint-digest-key-retirement.ts', "import { retireKey } from '../src/retirement'\nretireKey()\n")
    write('src/retirement.ts', 'export const retireKey = () => null\n')
    for (const file of ['src/app/unreachable.ts', 'src/collections/orphaned.ts', 'src/endpoints/orphaned.ts']) {
      write(file, 'export const unused = true\n')
    }

    const result = analyzeDeadCode()
    expect(result.status).toBe(1)
    const issues = JSON.parse(result.stdout).issues as Array<{
      file: string
      files: Array<{ name: string }>
      exports: Array<{ name: string }>
    }>
    expect(issues.flatMap((issue) => issue.files.map((file) => file.name)).sort()).toEqual([
      'src/app/unreachable.ts',
      'src/collections/orphaned.ts',
      'src/endpoints/orphaned.ts',
    ])
    for (const file of [
      'src/features/runtimePolicy/core.ts',
      'src/security/matrix.ts',
      'src/retirement.ts',
      'src/buildPolicy.ts',
    ]) {
      expect(issues.find((issue) => issue.file === file)).toBeUndefined()
    }
    expect(
      issues
        .find((issue) => issue.file === 'src/features/runtimePolicy/tooling.cjs')
        ?.exports.map((entry) => entry.name) ?? [],
    ).not.toContain('isPreviewRuntime')
  })

  it('includes test and Storybook consumers only in the full analysis', () => {
    copyFileSync(path.join(repositoryRoot, 'knip.jsonc'), path.join(directory, 'knip.jsonc'))
    write('package.json', '{"dependencies":{"payload":"3.88.0"},"devDependencies":{"@storybook/react":"10.0.0"}}\n')
    write('src/payload.config.ts', "import { foreignWork } from './foreign'\nexport default { foreignWork }\n")
    write('.storybook/main.ts', "export default { stories: ['../src/**/*.stories.tsx'] }\n")
    write('src/storyView.tsx', 'export const StoryView = () => <div>Story</div>\n')
    write(
      'src/storyView.stories.tsx',
      "import { StoryView } from './storyView'\nexport default { component: StoryView }\n",
    )
    write('src/testHelper.ts', 'export const testHelper = () => true\n')
    write('tests/testHelper.test.ts', "import { testHelper } from '../src/testHelper'\nconsole.log(testHelper())\n")
    write(
      'vitest.integration.config.ts',
      "throw new Error('Must not execute the guarded integration config')\nexport default {}\n",
    )

    const production = analyzeDeadCode()
    expect(production.status).toBe(1)
    expect(
      JSON.parse(production.stdout)
        .issues.map((issue: { file: string }) => issue.file)
        .sort(),
    ).toEqual(['src/storyView.tsx', 'src/testHelper.ts'])
    expect(analyzeDeadCode(false).status).toBe(0)
    const report = analyzeDeadCode(true, true)
    expect(report.status).toBe(0)
    expect(
      JSON.parse(report.stdout)
        .issues.map((issue: { file: string }) => issue.file)
        .sort(),
    ).toEqual(['src/storyView.tsx', 'src/testHelper.ts'])
  })
})

describe('Knip analysis errors', () => {
  it('retains configuration errors when findings are nonblocking', () => {
    write('knip.jsonc', '{ invalid json')
    expect(analyzeDeadCode(true, true).status).toBe(2)
  })

  it('blocks full analysis for an unused export in a consumed module', () => {
    write('knip.jsonc', JSON.stringify({ entry: ['src/entry.ts'], project: ['src/**/*.ts'] }))
    write('src/entry.ts', "import { used } from './library'\nconsole.log(used)\n")
    write('src/library.ts', 'export const used = true\nexport const unused = false\n')
    expect(analyzeDeadCode(false).status).toBe(1)
  })
})
