#!/usr/bin/env node

import { execFileSync } from 'node:child_process'

const formatExtensions = new Set([
  '.cjs',
  '.css',
  '.html',
  '.js',
  '.json',
  '.jsonc',
  '.jsx',
  '.md',
  '.mdx',
  '.mjs',
  '.scss',
  '.ts',
  '.tsx',
  '.yaml',
  '.yml',
])

const lintExtensions = new Set(['.cjs', '.js', '.jsx', '.mjs', '.ts', '.tsx'])

function run(command, args, { allowFailure = false } = {}) {
  try {
    return execFileSync(command, args, {
      encoding: 'utf8',
      stdio: ['inherit', 'pipe', 'pipe'],
    }).trim()
  } catch (error) {
    if (allowFailure) return null

    if (error.stdout) process.stdout.write(error.stdout)
    if (error.stderr) process.stderr.write(error.stderr)
    throw error
  }
}

function git(args, options) {
  return run('git', args, options)
}

function getExtension(filePath) {
  const lastDot = filePath.lastIndexOf('.')
  return lastDot === -1 ? '' : filePath.slice(lastDot)
}

const stagedFiles = git(['diff', '--cached', '--name-only', '--diff-filter=ACMR'])
  .split('\n')
  .map((filePath) => filePath.trim())
  .filter(Boolean)

if (stagedFiles.length === 0) {
  process.exit(0)
}

const unstagedFiles = new Set(
  git(['diff', '--name-only', '--diff-filter=ACMR'])
    .split('\n')
    .map((filePath) => filePath.trim())
    .filter(Boolean),
)

const hookManagedFiles = stagedFiles.filter((filePath) => {
  const extension = getExtension(filePath)
  return formatExtensions.has(extension) || lintExtensions.has(extension) || filePath === 'package.json'
})

const partiallyStagedFiles = hookManagedFiles.filter((filePath) => unstagedFiles.has(filePath))

if (partiallyStagedFiles.length > 0) {
  console.error(
    [
      'pre-commit aborted because the hook would rewrite partially staged files:',
      ...partiallyStagedFiles.map((filePath) => `- ${filePath}`),
      'Stage or stash the remaining hunks, then commit again.',
    ].join('\n'),
  )
  process.exit(1)
}

if (stagedFiles.includes('package.json') && !stagedFiles.includes('pnpm-lock.yaml')) {
  console.error('pre-commit aborted because package.json is staged without pnpm-lock.yaml.')
  process.exit(1)
}

const formatTargets = stagedFiles.filter((filePath) => formatExtensions.has(getExtension(filePath)))

if (formatTargets.length > 0) {
  console.log(`[pre-commit] formatting ${formatTargets.length} staged file(s) with Prettier.`)
  run('pnpm', ['exec', 'prettier', '--write', '--ignore-unknown', '--', ...formatTargets])
  git(['add', '--', ...formatTargets])
}

const lintTargets = stagedFiles.filter((filePath) => lintExtensions.has(getExtension(filePath)))

if (lintTargets.length > 0) {
  console.log(`[pre-commit] linting ${lintTargets.length} staged JS/TS file(s).`)
  run('pnpm', ['exec', 'eslint', '--cache', '--max-warnings=0', '--no-warn-ignored', '--', ...lintTargets])
}
