import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'
import {
  getPlaywrightSessionHelpText,
  getPlaywrightSessionLoginUrl,
  isAuthenticatedPlaywrightSessionUrl,
  parsePlaywrightSessionArgs,
} from './playwright-session'

const RECORD_TIMEOUT_MS = 15 * 60 * 1000

const isPlaywrightTimeoutError = (error: unknown): boolean => {
  return error instanceof Error && error.name === 'TimeoutError'
}

export async function recordPlaywrightSessionFromCliArgs(argv: string[]) {
  const options = parsePlaywrightSessionArgs(argv)

  if (options.help) {
    console.log(getPlaywrightSessionHelpText('record'))
    return
  }

  const loginUrl = getPlaywrightSessionLoginUrl(options.persona, options.baseUrl)
  const absoluteStateFile = path.resolve(process.cwd(), options.stateFile)
  const relativeStateFile = path.relative(process.cwd(), absoluteStateFile) || options.stateFile

  await mkdir(path.dirname(absoluteStateFile), { recursive: true })

  const browser = await chromium.launch({ headless: false })

  try {
    const context = await browser.newContext()
    const page = await context.newPage()

    console.log(`[playwright:session:record] persona=${options.persona} baseUrl=${options.baseUrl}`)
    console.log(`[playwright:session:record] opened ${loginUrl}`)
    console.log(
      `[playwright:session:record] complete the login flow in the browser; session state will be written to ${relativeStateFile}`,
    )

    await page.goto(loginUrl, { waitUntil: 'domcontentloaded' })
    await page.waitForURL((url) => isAuthenticatedPlaywrightSessionUrl(url, options.persona, options.baseUrl), {
      timeout: RECORD_TIMEOUT_MS,
    })
    await page.waitForLoadState('domcontentloaded')

    await context.storageState({ path: absoluteStateFile })

    console.log(`[playwright:session:record] saved session state to ${relativeStateFile}`)
    console.log(
      `[playwright:session:record] reuse with storageState: '${relativeStateFile}' in local screenshots or ad-hoc Playwright flows`,
    )
  } catch (error) {
    if (isPlaywrightTimeoutError(error)) {
      throw new Error(
        `Timed out waiting for an authenticated ${options.persona} session. If the login flow was interrupted or the session expired, rerun pnpm playwright:session:record -- --persona ${options.persona}.`,
      )
    }

    throw error
  } finally {
    await browser.close()
  }
}

recordPlaywrightSessionFromCliArgs(process.argv.slice(2)).catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
