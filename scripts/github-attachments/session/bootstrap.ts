import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'
import type { BrowserContext, BrowserContextOptions } from 'playwright'
import { info } from '../logger'
import { LOGIN_URL } from '../config'
import { readStorageState, resolveStateFile, stateFileExists, writeStorageState } from './storage'

const RECORD_TIMEOUT_MS = 15 * 60 * 1000
const SUPPORTED_BROWSER_CHANNELS = new Set(['chrome', 'msedge', 'chromium'])

const normalizeBrowserChannel = (browserChannel: string | undefined): 'chrome' | 'msedge' | undefined => {
  if (!browserChannel || browserChannel === 'chromium') {
    return undefined
  }

  if (!SUPPORTED_BROWSER_CHANNELS.has(browserChannel)) {
    throw new Error(`Unsupported browser channel: ${browserChannel}. Use chrome, msedge, or chromium.`)
  }

  return browserChannel as 'chrome' | 'msedge'
}

const buildGitHubLoginUrl = (returnToUrl: string | undefined): string => {
  const loginUrl = new URL(LOGIN_URL)

  if (!returnToUrl) {
    return loginUrl.toString()
  }

  const returnTo = new URL(returnToUrl)
  loginUrl.searchParams.set('return_to', `${returnTo.pathname}${returnTo.search}${returnTo.hash}`)

  return loginUrl.toString()
}

const activateMacBrowserWindow = async (browserChannel: string | undefined): Promise<void> => {
  if (process.platform !== 'darwin') {
    return
  }

  const appNames =
    browserChannel === 'chrome'
      ? ['Google Chrome']
      : browserChannel === 'msedge'
        ? ['Microsoft Edge']
        : ['Chromium', 'Google Chrome', 'Microsoft Edge']

  const { execFile } = await import('node:child_process')
  await Promise.all(
    appNames.map(
      (appName) =>
        new Promise<void>((resolve) => {
          execFile('osascript', ['-e', `tell application "${appName}" to activate`], () => resolve())
        }),
    ),
  )
}

const waitForGitHubUserSession = async (context: BrowserContext) => {
  const startedAt = Date.now()

  while (Date.now() - startedAt < RECORD_TIMEOUT_MS) {
    const cookies = await context.cookies('https://github.com')
    if (cookies.some((cookie) => cookie.name === 'user_session')) {
      return
    }

    await new Promise((resolve) => setTimeout(resolve, 1_000))
  }

  throw new Error('Timed out waiting for a GitHub user_session cookie')
}

export const bootstrapGitHubSession = async (options: {
  browserChannel?: string
  stateFile: string
  targetUrl?: string
}): Promise<void> => {
  const absoluteStateFile = resolveStateFile(options.stateFile)
  await mkdir(path.dirname(absoluteStateFile), { recursive: true })
  const profileDir = path.join(
    path.dirname(absoluteStateFile),
    `browser-profile-${options.browserChannel ?? 'chromium'}`,
  )
  await mkdir(profileDir, { recursive: true })

  const browserChannel = normalizeBrowserChannel(options.browserChannel)
  const launchOptions = {
    args: ['--start-maximized', '--window-position=80,80'],
    channel: browserChannel,
    headless: false,
    slowMo: 100,
  }
  const loginUrl = buildGitHubLoginUrl(options.targetUrl)
  info(`opening GitHub browser channel=${options.browserChannel ?? 'chromium'} login_url=${loginUrl}`)
  const contextOptions: BrowserContextOptions = { viewport: null }
  const context = await chromium.launchPersistentContext(profileDir, {
    ...launchOptions,
    ...contextOptions,
  })

  try {
    if (await stateFileExists(options.stateFile)) {
      const storageState = await readStorageState(options.stateFile)
      await context.addCookies(storageState.cookies ?? [])
    }

    const page = await context.newPage()

    await page.goto(loginUrl, { waitUntil: 'domcontentloaded' })
    await page.bringToFront()
    await activateMacBrowserWindow(options.browserChannel)
    info(`browser_ready=true current_url=${page.url()}`)
    info('complete GitHub login in the opened browser window; waiting for user_session cookie')
    await waitForGitHubUserSession(context)
    info('github_user_session_cookie=present')
    await page.waitForLoadState('domcontentloaded').catch(() => undefined)

    const storageState = await context.storageState()
    await writeStorageState(options.stateFile, JSON.stringify(storageState, null, 2))
  } finally {
    await context.close()
  }
}
