import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { DEFAULT_TMP_DIR } from '../config'
import type { GitHubTarget } from '../types'

const runGh = (args: string[]): Promise<void> =>
  new Promise((resolve, reject) => {
    const child = spawn('gh', args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stderr = ''

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8')
    })

    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(`gh exited with code ${code ?? 'unknown'}: ${stderr.trim()}`))
    })
  })

export const createGitHubComment = async (target: GitHubTarget, body: string): Promise<void> => {
  await mkdir(DEFAULT_TMP_DIR, { recursive: true })
  const bodyFile = path.join(DEFAULT_TMP_DIR, `comment-${Date.now()}.md`)
  await writeFile(bodyFile, body, { mode: 0o600 })

  const command = target.kind === 'pull' ? 'pr' : 'issue'
  await runGh([
    command,
    'comment',
    String(target.number),
    '-R',
    `${target.owner}/${target.repo}`,
    '--body-file',
    bodyFile,
  ])
}
