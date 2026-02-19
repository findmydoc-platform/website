#!/usr/bin/env node

/**
 * AI Slop Policy Check
 *
 * This script enforces anti-slop guardrails for AI instruction files.
 * It validates:
 * - required anti-slop policy file structure
 * - banned filler phrases across instruction/prompt files
 * - basic policy conflict signals
 */
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const POLICY_RELATIVE_PATH = '.github/instructions/ai-anti-slop.instructions.md'
const ROUTER_RELATIVE_PATH = 'AGENTS.md'

const SCAN_DIR_RELATIVE_PATHS = ['.github/instructions', '.github/prompts', '.github/agents']

const SCAN_FILE_RELATIVE_PATHS = ['.github/copilot-instructions.md', 'AGENTS.md']

const REQUIRED_POLICY_HEADINGS = ['## Tone', '## Evidence', '## Uncertainty', '## Forbidden Patterns', '## Workflow']

const REQUIRED_POLICY_TOKENS = ['Assumption:', 'Confidence:']

const BANNED_PHRASES = [
  'great question',
  'awesome question',
  'happy to help',
  'i hope this helps',
  'let me know if you need anything else',
  'you got this',
  'no worries',
]

const CONFLICT_RULES = [
  {
    description: 'Conflicting chat language policies (German and English) detected.',
    positive: /chat and explanations.*(?:english|englisch)/i,
    negative: /chat and explanations.*(?:german|deutsch)/i,
  },
  {
    description: 'Conflicting tone policies (forbid filler vs allow filler) detected.',
    positive: /(?:no filler|no fluff|no cheerleading|avoid .*filler)/i,
    negative: /(?:allow .*filler|use .*filler)/i,
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
  return path.relative(rootDir, filePath)
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

  const normalizedRelativePath = toRelative(rootDir, filePath).replace(/\\/g, '/')
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
    failures.push(`${toRelative(rootDir, policyPath)} -> policy must require direct and factual tone.`)
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
  }
}

function checkConflicts(rootDir, files, failures) {
  /** @type {Array<{path: string, content: string}>} */
  const contents = files
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

function parseArgs(argv) {
  /** @type {{ changedFilesFile?: string, changedFiles?: string[] }} */
  const parsed = {}

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
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

    throw new Error(`Unknown argument: ${arg}`)
  }

  return parsed
}

/**
 * Runs the AI slop check.
 * @param {{ rootDir?: string, changedFiles?: string[] | null }} [options]
 * @returns {{ ok: boolean, failures: string[], scannedFiles: number, changedFilesMode: boolean }}
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
  checkConflicts(rootDir, filesToScan, failures)

  return {
    ok: failures.length === 0,
    failures,
    scannedFiles: filesToScan.length,
    changedFilesMode: options.changedFiles !== undefined && options.changedFiles !== null,
  }
}

function main() {
  const parsed = parseArgs(process.argv.slice(2))
  let changedFiles = parsed.changedFiles ?? null

  if (parsed.changedFilesFile) {
    const changedFilesFromFile = readChangedFilesFile(process.cwd(), parsed.changedFilesFile)
    changedFiles = changedFiles ? [...changedFiles, ...changedFilesFromFile] : changedFilesFromFile
  }

  const result = runAiSlopPolicyCheck({ changedFiles })

  if (!result.ok) {
    console.error('AI slop policy check failed:')
    for (const failure of result.failures) {
      console.error(`- ${failure}`)
    }
    process.exit(1)
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
