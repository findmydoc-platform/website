#!/usr/bin/env node

/**
 * Docs Consistency Check
 *
 * Why this exists:
 * - Docs drift tends to happen in three places:
 *   1) internal markdown links
 *   2) inline code path references
 *   3) documented pnpm commands/scripts
 *
 * What this script validates for every markdown file under `docs/`:
 * - all internal markdown links resolve to an existing file
 * - inline backtick path references to repo files/folders exist
 * - inline backtick `pnpm ...` commands reference valid scripts/subcommands
 *
 * Design notes:
 * - It is intentionally lightweight and dependency-free (Node built-ins only).
 * - It tolerates placeholders such as `<slug>` and wildcard examples.
 * - It focuses on actionable, low-noise failures that can block CI safely.
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const DOCS_DIR = path.join(ROOT, 'docs')

const LINK_RE = /\[[^\]]*?\]\(([^)\s]+(?:\s+"[^"]*")?)\)/g
const INLINE_CODE_RE = /`([^`\n]+)`/g

const PATH_PREFIX_RE = /^(?:src|docs|tests|scripts|\.github)\//

const ALLOWED_PNPM_SUBCOMMANDS = new Set(['add', 'create', 'dlx', 'exec', 'help', 'i', 'install', 'payload'])

/**
 * Recursively collects markdown files from a directory.
 *
 * @param {string} dir
 * @returns {string[]}
 */
function collectMarkdownFiles(dir) {
  /** @type {string[]} */
  const result = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      result.push(...collectMarkdownFiles(fullPath))
      continue
    }

    if (entry.isFile() && entry.name.endsWith('.md')) {
      result.push(fullPath)
    }
  }

  return result
}

/**
 * Normalizes markdown link targets for filesystem checks.
 *
 * Example:
 * - "./foo.md#bar?x=1" -> "./foo.md"
 * - "./foo.md \"Title\"" -> "./foo.md"
 *
 * @param {string} rawTarget
 * @returns {string}
 */
function normalizeLinkTarget(rawTarget) {
  const withoutTitle = rawTarget.split(/\s+"/)[0] ?? rawTarget
  const withoutAnchor = withoutTitle.split('#')[0] ?? withoutTitle
  return withoutAnchor.split('?')[0] ?? withoutAnchor
}

/**
 * Determines if an inline path reference is a doc placeholder example.
 * Placeholders/wildcards are useful in docs and should not fail the check.
 *
 * @param {string} ref
 * @returns {boolean}
 */
function isIgnoredPathRef(ref) {
  return ref.includes('<') || ref.includes('>') || ref.includes('*')
}

/**
 * Validates markdown links in one file.
 *
 * Link resolution behavior:
 * - absolute-style repo links (`/src/...`) are resolved from repo root
 * - relative links are resolved from the markdown file directory
 *
 * External links and anchors are ignored.
 *
 * @param {string} filePath
 * @param {string} content
 * @param {string[]} failures
 */
function checkMarkdownLinks(filePath, content, failures) {
  for (const match of content.matchAll(LINK_RE)) {
    const rawTarget = match[1] ?? ''
    if (!rawTarget || rawTarget.startsWith('http://') || rawTarget.startsWith('https://')) continue
    if (rawTarget.startsWith('mailto:') || rawTarget.startsWith('#')) continue

    const target = normalizeLinkTarget(rawTarget.trim())
    if (!target || isIgnoredPathRef(target)) continue

    // Resolve absolute-style docs links against repository root.
    let resolved
    if (target.startsWith('/')) {
      resolved = path.join(ROOT, target)
    } else {
      // Resolve relative links against the current markdown file.
      resolved = path.resolve(path.dirname(filePath), target)
    }

    if (!fs.existsSync(resolved)) {
      failures.push(`${path.relative(ROOT, filePath)} -> broken link: ${rawTarget}`)
    }
  }
}

/**
 * Validates inline code references to repository paths.
 *
 * We only inspect inline code blocks that look like repo paths
 * (`src/...`, `tests/...`, `docs/...`, `scripts/...`, `.github/...`).
 *
 * @param {string} filePath
 * @param {string} content
 * @param {string[]} failures
 */
function checkInlinePathRefs(filePath, content, failures) {
  for (const match of content.matchAll(INLINE_CODE_RE)) {
    const value = (match[1] ?? '').trim()
    if (!value || isIgnoredPathRef(value)) continue
    if (!PATH_PREFIX_RE.test(value)) continue

    const clean = value.replace(/[),.;:]+$/, '')
    const resolved = path.join(ROOT, clean)
    if (!fs.existsSync(resolved)) {
      failures.push(`${path.relative(ROOT, filePath)} -> missing path reference: ${value}`)
    }
  }
}

/**
 * Validates inline `pnpm ...` command references.
 *
 * Rules:
 * - `pnpm run <script>` must reference a script in package.json
 * - `pnpm <script>` is allowed when `<script>` exists in package.json
 * - a curated allowlist covers official pnpm subcommands used in docs
 *
 * @param {string} filePath
 * @param {string} content
 * @param {Set<string>} scripts
 * @param {string[]} failures
 */
function checkPnpmCommandRefs(filePath, content, scripts, failures) {
  for (const match of content.matchAll(INLINE_CODE_RE)) {
    const value = (match[1] ?? '').trim()
    if (!value.startsWith('pnpm ')) continue

    const tokens = value.split(/\s+/)
    const subcommand = tokens[1]
    if (!subcommand) continue

    if (subcommand === 'run') {
      const scriptName = tokens[2]
      if (!scriptName || !scripts.has(scriptName)) {
        failures.push(`${path.relative(ROOT, filePath)} -> unknown pnpm script: ${value}`)
      }
      continue
    }

    if (scripts.has(subcommand) || ALLOWED_PNPM_SUBCOMMANDS.has(subcommand)) {
      continue
    }

    failures.push(`${path.relative(ROOT, filePath)} -> unknown pnpm command: ${value}`)
  }
}

/**
 * Entrypoint:
 * - read scripts from package.json
 * - run all checks for every docs markdown file
 * - fail with a compact report if mismatches are found
 */
function main() {
  const packageJsonPath = path.join(ROOT, 'package.json')
  if (!fs.existsSync(packageJsonPath)) {
    throw new Error('package.json not found at repository root')
  }

  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
  const scriptNames = new Set(Object.keys(pkg.scripts ?? {}))
  const markdownFiles = collectMarkdownFiles(DOCS_DIR)

  /** @type {string[]} */
  const failures = []

  for (const filePath of markdownFiles) {
    const content = fs.readFileSync(filePath, 'utf8')
    checkMarkdownLinks(filePath, content, failures)
    checkInlinePathRefs(filePath, content, failures)
    checkPnpmCommandRefs(filePath, content, scriptNames, failures)
  }

  if (failures.length > 0) {
    console.error('Docs consistency check failed:')
    for (const failure of failures) {
      console.error(`- ${failure}`)
    }
    process.exit(1)
  }

  console.log(`Docs consistency check passed (${markdownFiles.length} files).`)
}

main()
