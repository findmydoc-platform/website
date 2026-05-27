import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { GitHubTarget } from '../types'

const execFileAsync = promisify(execFile)

export const parseGitHubTarget = (value: string): GitHubTarget => {
  const url = new URL(value)

  if (url.hostname !== 'github.com') {
    throw new Error(`Expected a github.com URL, got ${value}`)
  }

  const segments = url.pathname.split('/').filter(Boolean)
  const [owner, repo, kindSegment, numberSegment] = segments

  if (!owner || !repo || !kindSegment || !numberSegment) {
    throw new Error(`Expected GitHub issue or pull request URL, got ${value}`)
  }

  if (kindSegment !== 'issues' && kindSegment !== 'pull') {
    throw new Error(`Expected /issues/:number or /pull/:number URL, got ${value}`)
  }

  const number = Number.parseInt(numberSegment, 10)
  if (!Number.isInteger(number) || number < 1) {
    throw new Error(`Invalid GitHub target number in ${value}`)
  }

  return {
    kind: kindSegment === 'pull' ? 'pull' : 'issue',
    number,
    owner,
    repo,
    url: `https://github.com/${owner}/${repo}/${kindSegment}/${number}`,
  }
}

export const resolveRepositoryIdWithGh = async (target: GitHubTarget): Promise<string> => {
  const { stdout } = await execFileAsync('gh', [
    'repo',
    'view',
    `${target.owner}/${target.repo}`,
    '--json',
    'databaseId',
    '--jq',
    '.databaseId',
  ])

  const repositoryId = stdout.trim()
  if (!/^\d+$/.test(repositoryId)) {
    throw new Error(`Could not resolve repository databaseId for ${target.owner}/${target.repo}`)
  }

  return repositoryId
}
