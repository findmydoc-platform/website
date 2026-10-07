import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const zeroOid = /^0+$/
const git = (args) => execFileSync('git', args, { encoding: 'utf8' })
const pathsFromDiff = (args) => git(args).split('\0').filter(Boolean)

function isRelevantPath(filePath) {
  if (/\.(md|mdx|rst|txt)$/i.test(filePath)) return false
  if (/^(src|apps|scripts|tests|config|public|patches|\.storybook|\.githooks)\//.test(filePath)) return true
  if (/\.(?:[cm]?[jt]sx?|jsonc?)$/.test(filePath)) return true
  return ['pnpm-lock.yaml', 'pnpm-workspace.yaml', '.npmrc', '.nvmrc', '.node-version'].includes(filePath)
}

const changedFiles = new Set()
try {
  for (const line of readFileSync(0, 'utf8').trim().split('\n').filter(Boolean)) {
    const [, localOid, , remoteOid] = line.trim().split(/\s+/)
    if (!localOid || !remoteOid) throw new Error('Invalid pre-push ref input.')
    if (zeroOid.test(localOid)) continue // Ref deletion does not push source changes.

    if (!zeroOid.test(remoteOid)) {
      for (const file of pathsFromDiff(['diff', '--name-only', '--no-renames', '-z', remoteOid, localOid])) {
        changedFiles.add(file)
      }
    } else {
      // A new ref has no remote base. Check every commit not already on that remote.
      const remoteName = process.argv[2]
      const knownRemote = remoteName && git(['remote']).trim().split('\n').includes(remoteName)
      const args = ['rev-list', localOid]
      if (knownRemote) args.push('--not', `--remotes=${remoteName}`)
      for (const commit of git(args).trim().split('\n').filter(Boolean)) {
        for (const file of pathsFromDiff([
          'diff-tree',
          '--root',
          '-m',
          '--no-commit-id',
          '--name-only',
          '--no-renames',
          '-r',
          '-z',
          commit,
        ])) {
          changedFiles.add(file)
        }
      }
    }
  }
} catch (error) {
  console.error(`[pre-push] cannot determine pushed changes: ${error.message}`)
  process.exit(1)
}

if (![...changedFiles].some(isRelevantPath)) {
  console.log('[pre-push] deadcode check skipped (no relevant pushed changes).')
  process.exit(0)
}

console.log('[pre-push] checking dead code across the pushed changes.')
const result = spawnSync('pnpm', ['deadcode:check'], { stdio: 'inherit' })
if (result.error) console.error(result.error.message)
process.exit(result.status ?? 1)
