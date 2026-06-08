#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const DEFAULT_ROOT_DIR = process.cwd()
const TEST_FILE_PATTERN = /\.(?:test|spec)\.[cm]?[jt]sx?$/u
const IGNORED_DIRS = new Set(['.git', '.next', 'coverage', 'node_modules', 'output', 'storybook-static', 'tmp'])

function toRelative(rootDir, filePath) {
  return path.relative(rootDir, filePath).replace(/\\/g, '/')
}

function walkFiles(dirPath) {
  if (!fs.existsSync(dirPath)) return []

  const entries = fs.readdirSync(dirPath, { withFileTypes: true })
  /** @type {string[]} */
  const files = []

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name)

    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) {
        files.push(...walkFiles(fullPath))
      }
      continue
    }

    if (entry.isFile() && TEST_FILE_PATTERN.test(entry.name)) {
      files.push(fullPath)
    }
  }

  return files
}

function parseArgs(argv = process.argv.slice(2)) {
  const args = argv.filter((arg) => arg !== '--')
  const changedFiles = []

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === '--changed-files') {
      const value = args[index + 1] ?? ''
      changedFiles.push(
        ...value
          .split(',')
          .map((entry) => entry.trim())
          .filter(Boolean),
      )
      index += 1
      continue
    }

    const inlineMatch = arg.match(/^--changed-files=(.+)$/u)
    if (inlineMatch) {
      changedFiles.push(
        ...inlineMatch[1]
          .split(',')
          .map((entry) => entry.trim())
          .filter(Boolean),
      )
    }
  }

  return { changedFiles }
}

function hasProductionRuntimeSignal(source) {
  const runtimeSource = source.replace(/^import\s+type\s+.+$/gmu, '')

  return [
    /(?:from\s+|import\s*\(|require\s*\(|vi\.mock\s*\()\s*['"]@\//u,
    /(?:from\s+|import\s*\(|require\s*\(|vi\.mock\s*\()\s*['"]@payload-config/u,
    /(?:from\s+|import\s*\(|require\s*\(|vi\.mock\s*\()\s*['"][^'"]*\/src\//u,
    /(?:next|next-sitemap)\.config\.(?:js|cjs|mjs|ts)/u,
    /redirects\.js/u,
  ].some((pattern) => pattern.test(runtimeSource))
}

function hasToolingSignal(source) {
  return [
    /(?:from\s+|import\s*\(|require\s*\()\s*['"][^'"]*(?:\/scripts\/|scripts\/)/u,
    /(?:from\s+|import\s*\(|require\s*\()\s*['"][^'"]*\.github\/scripts\//u,
    /(?:from\s+|import\s*\(|require\s*\()\s*['"][^'"]*\.codex\/skills\/[^'"]*\/scripts\//u,
    /(?:from\s+|import\s*\(|require\s*\()\s*['"][^'"]*tests\/e2e\/helpers\//u,
    /(?:from\s+|import\s*\(|require\s*\()\s*['"][.]{2}\/[.]{2}\/e2e\/helpers\//u,
  ].some((pattern) => pattern.test(source))
}

function hasDataIntegritySignal(source) {
  return [
    /@\/endpoints\/seed\/data\//u,
    /src\/endpoints\/seed\/data\//u,
    /readFileSync\([^)]*seed/u,
    /medicalSpecialt(?:y|ies).*\.json/u,
  ].some((pattern) => pattern.test(source))
}

function hasOnlyTypeImportSignal(source) {
  const runtimeImportPattern = /import\s+(?!type\b)[^'"]*\s+from\s+['"]@\//u
  return /import\s+type\s+[^'"]*\s+from\s+['"]@\//u.test(source) && !runtimeImportPattern.test(source)
}

function isLocalValidatorOnly(source) {
  return (
    hasOnlyTypeImportSignal(source) &&
    /function\s+is[A-Z]\w+\s*\(/u.test(source) &&
    /expect\(\s*is[A-Z]\w+\s*\(/u.test(source)
  )
}

function countMatches(source, pattern) {
  return [...source.matchAll(pattern)].length
}

function analyzeTestFile(rootDir, filePath) {
  const relativePath = toRelative(rootDir, filePath)
  const source = fs.readFileSync(filePath, 'utf8')
  const failures = []
  const warnings = []

  if (/^tests\/unit\/scripts\//u.test(relativePath)) {
    failures.push('Tooling scripts must live under tests/tooling/**, not tests/unit/scripts/**.')
  }

  if (/^tests\/unit\/helpers\//u.test(relativePath) && /(?:\/|\.\.\/)e2e\/helpers\//u.test(source)) {
    failures.push('E2E helper tests must live under tests/tooling/**, not tests/unit/helpers/**.')
  }

  if (/^tests\/unit\//u.test(relativePath) && hasDataIntegritySignal(source)) {
    failures.push('Seed fixture and data-integrity checks must live under tests/data-integrity/**.')
  }

  if (/^tests\/unit\//u.test(relativePath) && !hasProductionRuntimeSignal(source)) {
    failures.push('Unit tests must exercise production runtime code or production configuration.')
  }

  if (isLocalValidatorOnly(source)) {
    failures.push('Local validator-only tests must be replaced by tests for production validators.')
  }

  if (/^tests\/tooling\//u.test(relativePath) && !hasToolingSignal(source)) {
    failures.push('Tooling tests must exercise repository automation, delivery scripts, or E2E support logic.')
  }

  if (/^tests\/data-integrity\//u.test(relativePath) && !hasDataIntegritySignal(source)) {
    failures.push('Data-integrity tests must exercise seed fixtures or repository data contracts.')
  }

  if (/(?:toHaveClass|className|(?:^|\s)(?:bg|text|grid|flex|gap|px|py|mt|mb|rounded)-)/u.test(source)) {
    warnings.push(
      'Contains styling/class assertions; prefer behavior or visual coverage unless the class is a contract.',
    )
  }

  if (countMatches(source, /\.toContain\(/gu) >= 4) {
    warnings.push('Contains many substring assertions; verify this is not only string smoke coverage.')
  }

  if (/\b(?:VALID_|CONFIG|POLICY|REGISTRY|TTL|TIMEOUT)[A-Z0-9_]*\b[\s\S]{0,240}\.to(?:Be|Equal)\(/u.test(source)) {
    warnings.push('May mirror static constants; keep only when this is an explicit config or policy contract.')
  }

  return { failures, relativePath, warnings }
}

function collectTestFiles(rootDir, changedFiles = []) {
  if (changedFiles.length > 0) {
    return changedFiles
      .filter((relativePath) => TEST_FILE_PATTERN.test(relativePath))
      .map((relativePath) => path.join(rootDir, relativePath))
      .filter((filePath) => fs.existsSync(filePath))
  }

  return walkFiles(path.join(rootDir, 'tests'))
}

function runTestSenseCheck({ rootDir = DEFAULT_ROOT_DIR, changedFiles = [] } = {}) {
  const files = collectTestFiles(rootDir, changedFiles)
  const results = files.map((filePath) => analyzeTestFile(rootDir, filePath))
  const failures = results.flatMap((result) => result.failures.map((message) => `${result.relativePath}: ${message}`))
  const warnings = results.flatMap((result) => result.warnings.map((message) => `${result.relativePath}: ${message}`))

  return {
    ok: failures.length === 0,
    failures,
    warnings,
    scannedPaths: results.map((result) => result.relativePath),
  }
}

function printResult(result) {
  if (result.failures.length > 0) {
    console.error('Test sense check failed:')
    for (const failure of result.failures) {
      console.error(`- ${failure}`)
    }
  }

  if (result.warnings.length > 0) {
    console.warn('Test sense check warnings:')
    for (const warning of result.warnings) {
      console.warn(`- ${warning}`)
    }
  }

  if (result.ok) {
    console.log(`Test sense check passed (${result.scannedPaths.length} test files scanned).`)
  }
}

function main() {
  const args = parseArgs()
  const result = runTestSenseCheck({ changedFiles: args.changedFiles })
  printResult(result)
  process.exitCode = result.ok ? 0 : 1
}

const isDirectExecution = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectExecution) {
  main()
}

export { analyzeTestFile, parseArgs, runTestSenseCheck }
