import { chmod, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { PlaywrightStorageStateLike, SessionCookie } from '../types'

const isGitHubCookie = (cookie: SessionCookie): boolean => {
  const domain = cookie.domain ?? ''
  return domain === 'github.com' || domain.endsWith('.github.com')
}

const isExpired = (cookie: SessionCookie, nowSeconds: number): boolean => {
  if (cookie.expires === undefined || cookie.expires < 0) {
    return false
  }

  return cookie.expires <= nowSeconds
}

export const resolveStateFile = (stateFile: string): string => path.resolve(process.cwd(), stateFile)

export const readStorageState = async (stateFile: string): Promise<PlaywrightStorageStateLike> => {
  const absoluteStateFile = resolveStateFile(stateFile)
  const content = await readFile(absoluteStateFile, 'utf8')
  return JSON.parse(content) as PlaywrightStorageStateLike
}

export const stateFileExists = async (stateFile: string): Promise<boolean> => {
  try {
    await stat(resolveStateFile(stateFile))
    return true
  } catch {
    return false
  }
}

export const writeStorageState = async (stateFile: string, content: string): Promise<void> => {
  const absoluteStateFile = resolveStateFile(stateFile)
  await writeFile(absoluteStateFile, content, { mode: 0o600 })
  await chmod(absoluteStateFile, 0o600).catch(() => undefined)
}

export const buildGitHubCookieHeader = (storageState: PlaywrightStorageStateLike): string => {
  const nowSeconds = Math.floor(Date.now() / 1000)
  const cookies = storageState.cookies ?? []
  const activeGitHubCookies = cookies.filter((cookie) => isGitHubCookie(cookie) && !isExpired(cookie, nowSeconds))

  if (activeGitHubCookies.length === 0) {
    throw new Error('No active github.com cookies found in stored session state')
  }

  const hasUserSession = activeGitHubCookies.some((cookie) => cookie.name === 'user_session')
  const hasSession = activeGitHubCookies.some((cookie) => cookie.name === '_gh_sess')

  if (!hasUserSession || !hasSession) {
    throw new Error('Stored GitHub session is missing user_session or _gh_sess cookies')
  }

  return activeGitHubCookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ')
}

export const readGitHubCookieHeaderFromStateFile = async (stateFile: string): Promise<string> => {
  return buildGitHubCookieHeader(await readStorageState(stateFile))
}
