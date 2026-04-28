import { existsSync } from 'node:fs'
import path from 'node:path'
import { chromium, request as playwrightRequest } from 'playwright'
import {
  getPlaywrightSessionCheckUrl,
  getPlaywrightSessionHelpText,
  isValidPlaywrightSessionForPersona,
  parsePlaywrightSessionArgs,
} from './playwright-session'

export async function checkPlaywrightSessionFromCliArgs(argv: string[]) {
  const options = parsePlaywrightSessionArgs(argv)

  if (options.help) {
    console.log(getPlaywrightSessionHelpText('check'))
    return
  }

  const checkUrl = getPlaywrightSessionCheckUrl(options.persona, options.baseUrl)
  const absoluteStateFile = path.resolve(process.cwd(), options.stateFile)
  const relativeStateFile = path.relative(process.cwd(), absoluteStateFile) || options.stateFile

  if (!existsSync(absoluteStateFile)) {
    throw new Error(
      `Session state file not found at ${relativeStateFile}. Run pnpm playwright:session:record -- --persona ${options.persona} first.`,
    )
  }

  const browser = await chromium.launch({ headless: true })

  try {
    const context = await browser.newContext({ storageState: absoluteStateFile })
    const page = await context.newPage()
    const apiContext = await playwrightRequest.newContext({
      baseURL: options.baseUrl,
      storageState: absoluteStateFile,
    })

    try {
      await page.goto(checkUrl, { waitUntil: 'domcontentloaded' })
      await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined)

      const finalUrl = page.url()

      if (!(await isValidPlaywrightSessionForPersona(finalUrl, options.persona, options.baseUrl, apiContext))) {
        throw new Error(
          `Stored session is not valid for ${options.persona}. Final URL was ${finalUrl}. Re-record it with pnpm playwright:session:record -- --persona ${options.persona}.`,
        )
      }

      console.log(`[playwright:session:check] session valid for persona=${options.persona} at ${relativeStateFile}`)
    } finally {
      await apiContext.dispose()
    }
  } finally {
    await browser.close()
  }
}

checkPlaywrightSessionFromCliArgs(process.argv.slice(2)).catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
