#!/usr/bin/env node

/**
 * AI Slop Policy Check (v2)
 *
 * Validates instruction quality using deterministic checks:
 * - required anti-slop policy structure
 * - banned filler language and contextual anti-patterns
 * - instruction budget checks (lines / hard rules / examples)
 * - policy-specific budget checks
 * - cross-file conflict checks
 */
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const ROUTER_RELATIVE_PATH = 'AGENTS.md'
const AGENT_FILE_NAMES = new Set(['AGENTS.md', 'AGENTS.override.md'])
const AGENT_SCAN_IGNORED_DIRS = new Set([
  '.git',
  '.next',
  '.vercel',
  'coverage',
  'node_modules',
  'output',
  'storybook-static',
  'tmp',
])

const POLICY_SECTION_HEADING = '## AI Anti-Slop Policy v2'

const REQUIRED_POLICY_HEADINGS = [
  '## Priorities',
  '## Required Output Quality',
  '## Uncertainty & Evidence',
  '## Forbidden Patterns',
  '## Scope & Brevity',
]

const REQUIRED_POLICY_TOKENS = ['Assumption:', 'Confidence:']

const POLICY_LINE_LIMIT = 120
const POLICY_HARD_RULE_LIMIT = 8

const INSTRUCTION_LINE_LIMIT = 180
const INSTRUCTION_HARD_RULE_LIMIT = 24
const INSTRUCTION_EXAMPLE_BLOCK_LIMIT = 1

const BANNED_PHRASES = [
  'great question',
  'awesome question',
  'happy to help',
  'i hope this helps',
  'let me know if you need anything else',
  'you got this',
  'no worries',
]

const CONTEXTUAL_BANNED_PATTERNS = [/as an ai language model/i, /i cannot guarantee/i, /i am just an ai/i]

const CONFLICT_RULES = [
  {
    description: 'Conflicting chat language policies (German and English) detected.',
    positive: /chat and explanations.*(?:english|englisch)|explanations in english/i,
    negative: /chat and explanations.*(?:german|deutsch)|explanations in german/i,
  },
  {
    description: 'Conflicting tone policies (forbid filler vs allow filler) detected.',
    positive: /(?:avoid .*filler|no filler|no fluff|no cheerleading|direct and factual)/i,
    negative: /(?:allow .*filler|(?:may|can)\s+use .*filler|use cheerleading)/i,
  },
  {
    description: 'Conflicting execution policies (always build vs skip build) detected.',
    positive: /always run.*pnpm build/i,
    negative: /(?:skip .*pnpm build|do not run.*pnpm build)/i,
  },
]

function walkAgentInstructionFiles(dirPath) {
  if (!fs.existsSync(dirPath)) return []

  const entries = fs.readdirSync(dirPath, { withFileTypes: true })
  /** @type {string[]} */
  const files = []

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name)
    if (entry.isDirectory()) {
      if (AGENT_SCAN_IGNORED_DIRS.has(entry.name)) {
        continue
      }

      files.push(...walkAgentInstructionFiles(fullPath))
      continue
    }

    if (entry.isFile() && AGENT_FILE_NAMES.has(entry.name)) {
      files.push(fullPath)
    }
  }

  return files
}

function toRelative(rootDir, filePath) {
  return path.relative(rootDir, filePath).replace(/\\/g, '/')
}

function loadFile(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null
}

function getRouterPath(rootDir) {
  return path.join(rootDir, ROUTER_RELATIVE_PATH)
}

function collectFilesToScan(rootDir) {
  return [...new Set(walkAgentInstructionFiles(rootDir))]
}

function isScopedMarkdownFile(rootDir, filePath) {
  if (!filePath.endsWith('.md')) return false

  const normalizedRelativePath = toRelative(rootDir, filePath)
  if (/(?:^|\/)AGENTS(?:\.override)?\.md$/u.test(normalizedRelativePath)) return true
  return false
}

function resolveChangedFiles(rootDir, changedFiles) {
  if (!changedFiles) return null

  const resolved = changedFiles
    .map((filePath) => path.resolve(rootDir, filePath))
    .filter((filePath) => fs.existsSync(filePath))
    .filter((filePath) => isScopedMarkdownFile(rootDir, filePath))

  return [...new Set(resolved)]
}

function readChangedFilesFile(rootDir, changedFilesFilePath) {
  const absolutePath = path.resolve(rootDir, changedFilesFilePath)
  const content = loadFile(absolutePath)

  if (content === null) {
    throw new Error(`Changed files list not found: ${toRelative(rootDir, absolutePath)}`)
  }

  return content
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

function countLines(content) {
  return content.split(/\r?\n/u).length
}

function countExampleBlocks(content) {
  const fenceCount = (content.match(/```/g) || []).length
  return Math.floor(fenceCount / 2)
}

function countHardRules(content) {
  const lines = content.split(/\r?\n/u)
  return lines.filter((line) => {
    const normalized = line.trim()
    if (!normalized.startsWith('-') && !/^\d+\./.test(normalized)) return false
    return /(?:\balways\b|\bnever\b|\bmust\b|do not|don't|\brule\s+\d+:)/i.test(normalized)
  }).length
}

function countPolicyHardRules(content) {
  const lines = content.split(/\r?\n/u)
  return lines.filter((line) => /^\s*-\s*Rule\s+\d+:/i.test(line)).length
}

function extractPolicySection(content) {
  const startIndex = content.indexOf(POLICY_SECTION_HEADING)
  if (startIndex === -1) return null

  const sectionFromStart = content.slice(startIndex)
  const followingTopLevelHeading = sectionFromStart.slice(POLICY_SECTION_HEADING.length).match(/\n#\s+/u)
  if (!followingTopLevelHeading) return sectionFromStart

  const nextTopLevelIndex = followingTopLevelHeading.index + POLICY_SECTION_HEADING.length
  if (nextTopLevelIndex <= 0) return sectionFromStart

  return sectionFromStart.slice(0, nextTopLevelIndex)
}

function checkPolicySection(rootDir, failures) {
  const routerPath = getRouterPath(rootDir)
  const content = loadFile(routerPath)
  if (content === null) {
    failures.push(`Missing required router file: ${toRelative(rootDir, routerPath)}`)
    return
  }

  const section = extractPolicySection(content)
  if (section === null) {
    failures.push(`${toRelative(rootDir, routerPath)} -> missing required heading: "${POLICY_SECTION_HEADING}"`)
    return
  }

  for (const heading of REQUIRED_POLICY_HEADINGS) {
    if (!section.includes(heading)) {
      failures.push(`${toRelative(rootDir, routerPath)} -> missing required heading: "${heading}"`)
    }
  }

  for (const token of REQUIRED_POLICY_TOKENS) {
    if (!section.includes(token)) {
      failures.push(`${toRelative(rootDir, routerPath)} -> missing required token: "${token}"`)
    }
  }

  if (!/direct/i.test(section) || !/factual/i.test(section)) {
    failures.push(`${toRelative(rootDir, routerPath)} -> policy must require direct and factual wording.`)
  }

  const lineCount = countLines(section)
  if (lineCount > POLICY_LINE_LIMIT) {
    failures.push(
      `${toRelative(rootDir, routerPath)} -> exceeds policy line budget (${lineCount} > ${POLICY_LINE_LIMIT}).`,
    )
  }

  const hardRuleCount = countPolicyHardRules(section)
  if (hardRuleCount > POLICY_HARD_RULE_LIMIT) {
    failures.push(
      `${toRelative(rootDir, routerPath)} -> exceeds policy hard-rule budget (${hardRuleCount} > ${POLICY_HARD_RULE_LIMIT}).`,
    )
  }
}

function checkBannedPhrases(rootDir, files, failures) {
  for (const filePath of files) {
    const content = loadFile(filePath)
    if (content === null) continue

    const lower = content.toLowerCase()
    for (const phrase of BANNED_PHRASES) {
      if (lower.includes(phrase)) {
        failures.push(`${toRelative(rootDir, filePath)} -> banned filler phrase found: "${phrase}"`)
      }
    }

    for (const pattern of CONTEXTUAL_BANNED_PATTERNS) {
      if (pattern.test(content)) {
        failures.push(`${toRelative(rootDir, filePath)} -> contextual banned pattern found: "${pattern}"`)
      }
    }
  }
}

function checkInstructionBudgets(rootDir, files, failures) {
  for (const filePath of files) {
    const content = loadFile(filePath)
    if (content === null) continue

    const relativePath = toRelative(rootDir, filePath)

    const lineCount = countLines(content)
    if (lineCount > INSTRUCTION_LINE_LIMIT) {
      failures.push(`${relativePath} -> exceeds instruction line budget (${lineCount} > ${INSTRUCTION_LINE_LIMIT}).`)
    }

    const hardRuleCount = countHardRules(content)
    if (hardRuleCount > INSTRUCTION_HARD_RULE_LIMIT) {
      failures.push(
        `${relativePath} -> exceeds hard-rule density budget (${hardRuleCount} > ${INSTRUCTION_HARD_RULE_LIMIT}).`,
      )
    }

    const exampleBlockCount = countExampleBlocks(content)
    if (exampleBlockCount > INSTRUCTION_EXAMPLE_BLOCK_LIMIT) {
      failures.push(
        `${relativePath} -> exceeds example block budget (${exampleBlockCount} > ${INSTRUCTION_EXAMPLE_BLOCK_LIMIT}).`,
      )
    }
  }
}

function collectConflictFiles(rootDir, scannedFiles) {
  const requiredPaths = [path.join(rootDir, ROUTER_RELATIVE_PATH)].filter((filePath) => fs.existsSync(filePath))

  return [...new Set([...scannedFiles, ...requiredPaths])]
}

function checkConflicts(rootDir, files, failures) {
  const conflictFiles = collectConflictFiles(rootDir, files)

  /** @type {Array<{path: string, content: string}>} */
  const contents = conflictFiles
    .map((filePath) => ({ path: filePath, content: loadFile(filePath) }))
    .filter((entry) => entry.content !== null)
    .map((entry) => ({ path: entry.path, content: entry.content }))

  for (const rule of CONFLICT_RULES) {
    const positives = contents.filter((entry) => rule.positive.test(entry.content))
    const negatives = contents.filter((entry) => rule.negative.test(entry.content))

    if (positives.length > 0 && negatives.length > 0) {
      const positiveFiles = positives.map((entry) => toRelative(rootDir, entry.path)).join(', ')
      const negativeFiles = negatives.map((entry) => toRelative(rootDir, entry.path)).join(', ')
      failures.push(`${rule.description} Positive files: [${positiveFiles}] Negative files: [${negativeFiles}]`)
    }
  }
}

/**
 * @param {string[]} argv
 * @returns {{ changedFilesFile?: string, changedFiles?: string[], mode: 'strict' | 'report', reportJson?: string }}
 */
export function parseArgs(argv) {
  /** @type {{ changedFilesFile?: string, changedFiles?: string[], mode: 'strict' | 'report', reportJson?: string }} */
  const parsed = { mode: 'strict' }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--') {
      continue
    }

    if (arg === '--changed-files-file') {
      const value = argv[index + 1]
      if (!value) {
        throw new Error('Missing value for --changed-files-file')
      }
      parsed.changedFilesFile = value
      index += 1
      continue
    }

    if (arg === '--changed-files') {
      const value = argv[index + 1]
      if (!value) {
        throw new Error('Missing value for --changed-files')
      }
      parsed.changedFiles = value
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
      index += 1
      continue
    }

    if (arg === '--mode') {
      const value = argv[index + 1]
      if (!value || (value !== 'strict' && value !== 'report')) {
        throw new Error('Invalid value for --mode. Expected strict or report.')
      }
      parsed.mode = value
      index += 1
      continue
    }

    if (arg === '--report-json') {
      const value = argv[index + 1]
      if (!value) {
        throw new Error('Missing value for --report-json')
      }
      parsed.reportJson = value
      index += 1
      continue
    }

    throw new Error(`Unknown argument: ${arg}`)
  }

  return parsed
}

/**
 * Runs the AI slop check.
 * @param {{ rootDir?: string, changedFiles?: string[] | null }} [options]
 * @returns {{ ok: boolean, failures: string[], scannedFiles: number, changedFilesMode: boolean, scannedPaths: string[] }}
 */
export function runAiSlopPolicyCheck(options = {}) {
  const rootDir = options.rootDir ?? process.cwd()
  const filesToScan = options.changedFiles
    ? resolveChangedFiles(rootDir, options.changedFiles)
    : collectFilesToScan(rootDir)

  /** @type {string[]} */
  const failures = []

  checkPolicySection(rootDir, failures)
  checkBannedPhrases(rootDir, filesToScan, failures)
  checkInstructionBudgets(rootDir, filesToScan, failures)
  checkConflicts(rootDir, filesToScan, failures)

  return {
    ok: failures.length === 0,
    failures,
    scannedFiles: filesToScan.length,
    changedFilesMode: options.changedFiles !== undefined && options.changedFiles !== null,
    scannedPaths: filesToScan.map((filePath) => toRelative(rootDir, filePath)),
  }
}

function writeJsonReport(reportPath, report) {
  const absolutePath = path.resolve(process.cwd(), reportPath)
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true })
  fs.writeFileSync(absolutePath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
}

function main() {
  const parsed = parseArgs(process.argv.slice(2))
  let changedFiles = parsed.changedFiles ?? null

  if (parsed.changedFilesFile) {
    const changedFilesFromFile = readChangedFilesFile(process.cwd(), parsed.changedFilesFile)
    changedFiles = changedFiles ? [...changedFiles, ...changedFilesFromFile] : changedFilesFromFile
  }

  const result = runAiSlopPolicyCheck({ changedFiles })

  const report = {
    mode: parsed.mode,
    generatedAt: new Date().toISOString(),
    ...result,
  }

  if (parsed.reportJson) {
    writeJsonReport(parsed.reportJson, report)
  }

  if (!result.ok) {
    console.error('AI slop policy check found issues:')
    for (const failure of result.failures) {
      console.error(`- ${failure}`)
    }

    if (parsed.mode === 'strict') {
      process.exit(1)
    }

    console.log('AI slop policy report completed (non-blocking mode).')
    return
  }

  if (result.changedFilesMode) {
    console.log(`AI slop policy check passed (changed-files mode, ${result.scannedFiles} files scanned).`)
  } else {
    console.log(`AI slop policy check passed (${result.scannedFiles} files scanned).`)
  }
}

const entrypointArg = process.argv[1]
if (entrypointArg && import.meta.url === pathToFileURL(entrypointArg).href) {
  main()
}
