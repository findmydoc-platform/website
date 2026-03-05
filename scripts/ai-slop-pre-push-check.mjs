import { execFileSync, spawnSync } from 'node:child_process'
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const AI_SLOP_RELEVANT_FILE_PATTERNS = [
  /^AGENTS\.md$/,
  /^\.github\/copilot-instructions\.md$/,
  /^\.github\/instructions\/.*\.md$/,
  /^\.github\/prompts\/.*\.md$/,
  /^\.github\/agents\/.*\.md$/,
]

const runGit = (args) => {
  try {
    return execFileSync('git', args, { encoding: 'utf8' }).trim()
  } catch {
    return null
  }
}

const collectChangedFiles = () => {
  const ranges = []
  const upstreamBranch = runGit(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'])

  if (upstreamBranch) {
    ranges.push(`${upstreamBranch}...HEAD`)
  }

  if (runGit(['rev-parse', '--verify', '--quiet', 'origin/main'])) {
    ranges.push('origin/main...HEAD')
  }

  if (runGit(['rev-parse', '--verify', '--quiet', 'HEAD~1'])) {
    ranges.push('HEAD~1..HEAD')
  }

  for (const range of ranges) {
    const output = runGit(['diff', '--name-only', '--diff-filter=ACMR', range])
    if (output !== null) {
      return output ? output.split('\n').filter(Boolean) : []
    }
  }

  return []
}

const changedFiles = collectChangedFiles()
const aiSlopRelevantFiles = changedFiles.filter((file) =>
  AI_SLOP_RELEVANT_FILE_PATTERNS.some((pattern) => pattern.test(file)),
)

if (aiSlopRelevantFiles.length === 0) {
  console.log('ai:slop pre-push check skipped (no AI instruction files changed).')
  process.exit(0)
}

const tempDirectory = mkdtempSync(join(tmpdir(), 'ai-slop-pre-push-'))
const changedFilesListPath = join(tempDirectory, 'changed-ai-slop-files.txt')

writeFileSync(changedFilesListPath, `${aiSlopRelevantFiles.join('\n')}\n`, 'utf8')
console.log(`ai:slop pre-push check running for ${aiSlopRelevantFiles.length} file(s).`)

const checkResult = spawnSync(
  'pnpm',
  ['ai:slop-check', '--mode', 'strict', '--changed-files-file', changedFilesListPath],
  {
    stdio: 'inherit',
  },
)

rmSync(tempDirectory, { recursive: true, force: true })

if (checkResult.status !== 0) {
  process.exit(checkResult.status ?? 1)
}
