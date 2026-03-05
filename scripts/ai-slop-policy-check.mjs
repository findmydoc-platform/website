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
 * - scope checks for overly broad applyTo usage
 */
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const POLICY_RELATIVE_PATH = '.github/instructions/ai-anti-slop.instructions.md'
const ROUTER_RELATIVE_PATH = 'AGENTS.md'

const SCAN_DIR_RELATIVE_PATHS = ['.github/instructions', '.github/prompts', '.github/agents']
const SCAN_FILE_RELATIVE_PATHS = ['.github/copilot-instructions.md', 'AGENTS.md']

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
    negative: /(?:allow .*filler|use .*filler|use cheerleading)/i,
  },
  {
    description: 'Conflicting execution policies (always build vs skip build) detected.',
    positive: /always run.*pnpm build/i,
    negative: /(?:skip .*pnpm build|do not run.*pnpm build)/i,
  },
]

function walkMarkdownFiles(dirPath) {
  if (!fs.existsSync(dirPath)) return []

  const entries = fs.readdirSync(dirPath, { withFileTypes: true })
  /** @type {string[]} */
  const files = []

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name)
    if (entry.isDirectory()) {
      files.push(...walkMarkdownFiles(fullPath))
      continue
    }

    if (entry.isFile() && entry.name.endsWith('.md')) {
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

function getPolicyPath(rootDir) {
  return path.join(rootDir, POLICY_RELATIVE_PATH)
}

function getRouterPath(rootDir) {
  return path.join(rootDir, ROUTER_RELATIVE_PATH)
}

function collectFilesToScan(rootDir) {
  const scanDirs = SCAN_DIR_RELATIVE_PATHS.map((relativePath) => path.join(rootDir, relativePath))
  const scanFiles = SCAN_FILE_RELATIVE_PATHS.map((relativePath) => path.join(rootDir, relativePath))
  const fromDirs = scanDirs.flatMap((dirPath) => walkMarkdownFiles(dirPath))
  const allFiles = [...scanFiles, ...fromDirs].filter((filePath) => fs.existsSync(filePath))
  return [...new Set(allFiles)]
}

function isScopedMarkdownFile(rootDir, filePath) {
  if (!filePath.endsWith('.md')) return false

  const normalizedRelativePath = toRelative(rootDir, filePath)
  if (normalizedRelativePath === 'AGENTS.md') return true
  if (normalizedRelativePath === '.github/copilot-instructions.md') return true
  if (normalizedRelativePath.startsWith('.github/instructions/')) return true
  if (normalizedRelativePath.startsWith('.github/prompts/')) return true
  if (normalizedRelativePath.startsWith('.github/agents/')) return true
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

function parseApplyTo(content) {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/u)
  if (!frontmatterMatch) return null

  const applyToMatch = frontmatterMatch[1].match(/^\s*applyTo:\s*(.+)\s*$/mu)
  if (!applyToMatch) return null

  return applyToMatch[1].trim().replace(/^['"]|['"]$/g, '')
}

function isGlobalScope(applyTo) {
  return applyTo.replace(/\s+/g, '') === '**/*'
}

function checkPolicyFile(rootDir, failures) {
  const policyPath = getPolicyPath(rootDir)
  const content = loadFile(policyPath)
  if (content === null) {
    failures.push(`Missing required policy file: ${toRelative(rootDir, policyPath)}`)
    return
  }

  for (const heading of REQUIRED_POLICY_HEADINGS) {
    if (!content.includes(heading)) {
      failures.push(`${toRelative(rootDir, policyPath)} -> missing required heading: "${heading}"`)
    }
  }

  for (const token of REQUIRED_POLICY_TOKENS) {
    if (!content.includes(token)) {
      failures.push(`${toRelative(rootDir, policyPath)} -> missing required token: "${token}"`)
    }
  }

  if (!/direct/i.test(content) || !/factual/i.test(content)) {
    failures.push(`${toRelative(rootDir, policyPath)} -> policy must require direct and factual wording.`)
  }

  const lineCount = countLines(content)
  if (lineCount > POLICY_LINE_LIMIT) {
    failures.push(
      `${toRelative(rootDir, policyPath)} -> exceeds policy line budget (${lineCount} > ${POLICY_LINE_LIMIT}).`,
    )
  }

  const hardRuleCount = countPolicyHardRules(content)
  if (hardRuleCount > POLICY_HARD_RULE_LIMIT) {
    failures.push(
      `${toRelative(rootDir, policyPath)} -> exceeds policy hard-rule budget (${hardRuleCount} > ${POLICY_HARD_RULE_LIMIT}).`,
    )
  }
}

function checkRouterReference(rootDir, failures) {
  const routerPath = getRouterPath(rootDir)
  const router = loadFile(routerPath)
  if (router === null) {
    failures.push(`Missing router file: ${toRelative(rootDir, routerPath)}`)
    return
  }

  if (!router.includes('ai-anti-slop.instructions.md')) {
    failures.push(`${toRelative(rootDir, routerPath)} -> missing route entry for ai-anti-slop.instructions.md.`)
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

function checkScopeRules(rootDir, files, failures) {
  for (const filePath of files) {
    const content = loadFile(filePath)
    if (content === null) continue

    const relativePath = toRelative(rootDir, filePath)
    const applyTo = parseApplyTo(content)
    if (!applyTo) continue

    if (isGlobalScope(applyTo) && !/scope exception:/i.test(content)) {
      failures.push(`${relativePath} -> global applyTo requires "Scope exception:" rationale.`)
    }
  }
}

function collectConflictFiles(rootDir, scannedFiles) {
  const requiredPaths = [
    path.join(rootDir, POLICY_RELATIVE_PATH),
    path.join(rootDir, ROUTER_RELATIVE_PATH),
    path.join(rootDir, '.github/copilot-instructions.md'),
  ].filter((filePath) => fs.existsSync(filePath))

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

  checkPolicyFile(rootDir, failures)
  checkRouterReference(rootDir, failures)
  checkBannedPhrases(rootDir, filesToScan, failures)
  checkInstructionBudgets(rootDir, filesToScan, failures)
  checkScopeRules(rootDir, filesToScan, failures)
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
