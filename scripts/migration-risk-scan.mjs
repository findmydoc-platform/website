#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const defaultRootDir = path.resolve(scriptDir, '..')

const riskRules = [
  {
    id: 'drop-column',
    severity: 'warning',
    pattern: /\bDROP\s+COLUMN\b/i,
    message: 'DROP COLUMN should usually be a separate contract release after expand/backfill/switch.',
  },
  {
    id: 'drop-table',
    severity: 'warning',
    pattern: /\bDROP\s+TABLE\b/i,
    message: 'DROP TABLE is destructive and should have an explicit contract-stage plan.',
  },
  {
    id: 'truncate',
    severity: 'warning',
    pattern: /\bTRUNCATE\b/i,
    message: 'TRUNCATE is destructive; prefer documented, reversible cleanup steps.',
  },
  {
    id: 'delete-from',
    severity: 'warning',
    pattern: /\bDELETE\s+FROM\b/i,
    message: 'DELETE FROM can destroy production data; document counts, backup/PITR, and rollback.',
  },
  {
    id: 'set-not-null',
    severity: 'warning',
    pattern: /\bALTER\s+COLUMN\b[\s\S]*\bSET\s+NOT\s+NULL\b/i,
    message: 'SET NOT NULL should follow an idempotent backfill and null-count verification.',
  },
  {
    id: 'rename',
    severity: 'warning',
    pattern: /\bRENAME\s+(COLUMN|TO)\b/i,
    message: 'Renames should usually be modeled as add new field, backfill, switch, then drop old field.',
  },
  {
    id: 'type-conversion',
    severity: 'warning',
    pattern: /\bSET\s+DATA\s+TYPE\b|\bUSING\b/i,
    message: 'Type conversions need compatibility and data-loss checks before production rollout.',
  },
]

function runGit(args, rootDir) {
  return execFileSync('git', args, {
    cwd: rootDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

export function parseArgs(argv) {
  const options = {
    base: undefined,
    baseRef: undefined,
    changedFiles: [],
    eventName: undefined,
    head: 'HEAD',
    rootDir: defaultRootDir,
  }

  const args = argv.filter((arg) => arg !== '--')

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]
    if (!arg) continue

    if (arg === '--base') {
      options.base = args[i + 1]
      i += 1
      continue
    }

    if (arg.startsWith('--base=')) {
      options.base = arg.slice('--base='.length)
      continue
    }

    if (arg === '--base-ref') {
      options.baseRef = args[i + 1]
      i += 1
      continue
    }

    if (arg.startsWith('--base-ref=')) {
      options.baseRef = arg.slice('--base-ref='.length)
      continue
    }

    if (arg === '--changed-file') {
      const value = args[i + 1]
      if (value) options.changedFiles.push(value)
      i += 1
      continue
    }

    if (arg.startsWith('--changed-file=')) {
      const value = arg.slice('--changed-file='.length)
      if (value) options.changedFiles.push(value)
      continue
    }

    if (arg === '--event-name') {
      options.eventName = args[i + 1]
      i += 1
      continue
    }

    if (arg.startsWith('--event-name=')) {
      options.eventName = arg.slice('--event-name='.length)
      continue
    }

    if (arg === '--head') {
      options.head = args[i + 1] ?? 'HEAD'
      i += 1
      continue
    }

    if (arg.startsWith('--head=')) {
      options.head = arg.slice('--head='.length)
      continue
    }

    if (arg === '--root-dir') {
      options.rootDir = path.resolve(args[i + 1] ?? defaultRootDir)
      i += 1
      continue
    }

    if (arg.startsWith('--root-dir=')) {
      options.rootDir = path.resolve(arg.slice('--root-dir='.length))
      continue
    }

    throw new Error(`Unknown option: ${arg}`)
  }

  return options
}

function resolveChangedFiles(options) {
  if (options.changedFiles.length > 0) {
    return options.changedFiles
  }

  if (options.eventName === 'workflow_dispatch') {
    return []
  }

  let range
  if (options.base) {
    range = `${options.base}...${options.head}`
  } else if (options.eventName === 'pull_request' && options.baseRef) {
    runGit(['fetch', '--no-tags', '--depth=1', 'origin', options.baseRef], options.rootDir)
    range = `origin/${options.baseRef}...${options.head}`
  } else {
    try {
      runGit(['rev-parse', '--verify', `${options.head}~1`], options.rootDir)
      range = `${options.head}~1...${options.head}`
    } catch {
      range = options.head
    }
  }

  let output
  try {
    output = runGit(['diff', '--name-only', '--diff-filter=ACMR', range], options.rootDir)
  } catch (error) {
    if (!range.includes('...')) throw error

    const fallbackRange = range.replace('...', '..')
    console.warn(`Unable to diff ${range}; falling back to ${fallbackRange}.`)
    output = runGit(['diff', '--name-only', '--diff-filter=ACMR', fallbackRange], options.rootDir)
  }
  return output
    .split('\n')
    .map((filePath) => filePath.trim())
    .filter(Boolean)
}

function isMigrationFile(filePath) {
  return (
    /^src\/migrations\/.+\.ts$/.test(filePath) &&
    !filePath.endsWith('/index.ts') &&
    filePath !== 'src/migrations/index.ts'
  )
}

function lineNumberAt(source, index) {
  return source.slice(0, index).split('\n').length
}

function extractUpMigrationSource(source) {
  const upIndex = source.search(/export\s+async\s+function\s+up\b/)
  if (upIndex < 0) return { source, offset: 0 }

  const remaining = source.slice(upIndex)
  const downRelativeIndex = remaining.search(/export\s+async\s+function\s+down\b/)
  if (downRelativeIndex < 0) return { source: remaining, offset: upIndex }

  return {
    source: remaining.slice(0, downRelativeIndex),
    offset: upIndex,
  }
}

function splitSqlStatements(source, offset = 0) {
  const statements = []
  let start = 0

  for (let i = 0; i < source.length; i += 1) {
    if (source[i] !== ';') continue

    const statement = source.slice(start, i + 1)
    if (statement.trim().length > 0) {
      statements.push({
        text: statement,
        index: offset + start,
      })
    }
    start = i + 1
  }

  const trailing = source.slice(start)
  if (trailing.trim().length > 0) {
    statements.push({
      text: trailing,
      index: offset + start,
    })
  }

  return statements
}

function hasBroadUpdate(statement) {
  return /\bUPDATE\b[\s\S]*\bSET\b/i.test(statement) && !/\bWHERE\b/i.test(statement)
}

export function scanMigrationSource(source, filePath) {
  const findings = []
  const upBlock = extractUpMigrationSource(source)
  const statements = splitSqlStatements(upBlock.source, upBlock.offset)

  for (const statement of statements) {
    for (const rule of riskRules) {
      if (!rule.pattern.test(statement.text)) continue

      findings.push({
        filePath,
        line: lineNumberAt(source, statement.index),
        ruleId: rule.id,
        severity: rule.severity,
        message: rule.message,
      })
    }

    if (hasBroadUpdate(statement.text)) {
      findings.push({
        filePath,
        line: lineNumberAt(source, statement.index),
        ruleId: 'broad-update',
        severity: 'warning',
        message: 'Broad UPDATE without WHERE should be explicitly justified and verified with counts.',
      })
    }
  }

  return findings
}

export function runMigrationRiskScan(options) {
  const changedFiles = resolveChangedFiles(options)
  const migrationFiles = changedFiles.filter(isMigrationFile)
  const findings = []

  for (const filePath of migrationFiles) {
    const absolutePath = path.join(options.rootDir, filePath)
    if (!fs.existsSync(absolutePath)) continue

    const source = fs.readFileSync(absolutePath, 'utf8')
    findings.push(...scanMigrationSource(source, filePath))
  }

  return {
    changedFiles,
    findings,
    migrationFiles,
  }
}

function escapeGitHubAnnotationValue(value) {
  return value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A')
}

function printFinding(finding) {
  const text = `${finding.filePath}:${finding.line} [${finding.ruleId}] ${finding.message}`

  if (process.env.GITHUB_ACTIONS === 'true') {
    const file = escapeGitHubAnnotationValue(finding.filePath)
    const title = escapeGitHubAnnotationValue(`Migration risk: ${finding.ruleId}`)
    const message = escapeGitHubAnnotationValue(finding.message)
    console.log(`::warning file=${file},line=${finding.line},title=${title}::${message}`)
    return
  }

  console.warn(text)
}

function main() {
  const options = parseArgs(process.argv.slice(2))
  const result = runMigrationRiskScan(options)

  if (result.migrationFiles.length === 0) {
    console.log('No changed migration files found for risk scan.')
    return
  }

  console.log(`Scanned ${result.migrationFiles.length} changed migration file(s).`)

  if (result.findings.length === 0) {
    console.log('No advisory migration risks detected.')
    return
  }

  for (const finding of result.findings) {
    printFinding(finding)
  }

  console.log(`Advisory migration risk scan completed with ${result.findings.length} warning(s).`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}
