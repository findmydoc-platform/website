import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium, request as playwrightRequest } from 'playwright'
import { createBrowserIssueCollector } from '../tests/e2e/helpers/browserIssues'
import {
  createJourneyCaptureHandler,
  executeAdminJourney,
  findAdminJourneyDefinition,
  getAdminJourneyOutputSlug,
} from '../tests/e2e/helpers/adminJourneys'
import { applyE2ERuntimeDefaults, loadLocalAndTestEnv } from './test-env.mjs'
import {
  getDefaultStateFile,
  getPlaywrightSessionCheckUrl,
  getPlaywrightSessionHelpText,
  isValidPlaywrightSessionForPersona,
  parsePlaywrightSessionArgs,
} from './playwright-session'

export type PlaywrightJourneyCaptureCliOptions = {
  baseUrl: string
  help: boolean
  journeyId: string
  outputDir: string
  persona: ReturnType<typeof parsePlaywrightSessionArgs>['persona']
  stateFile: string
}

const stripArgSeparators = (argv: string[]) => argv.filter((arg) => arg !== '--')

export function parsePlaywrightJourneyCaptureArgs(argv: string[]): PlaywrightJourneyCaptureCliOptions {
  const args = stripArgSeparators(argv)
  const sessionArgs: string[] = []
  let journeyId = ''
  let outputDir = path.join('output', 'playwright', 'journeys')

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]
    if (!arg) continue

    if (arg === '--journey') {
      const value = args[i + 1]
      if (!value) throw new Error('Missing value for --journey')
      journeyId = value
      i += 1
      continue
    }

    if (arg.startsWith('--journey=')) {
      journeyId = arg.slice('--journey='.length)
      continue
    }

    if (arg === '--output-dir') {
      const value = args[i + 1]
      if (!value) throw new Error('Missing value for --output-dir')
      outputDir = value
      i += 1
      continue
    }

    if (arg.startsWith('--output-dir=')) {
      outputDir = arg.slice('--output-dir='.length)
      continue
    }

    sessionArgs.push(arg)

    if (arg === '--persona' || arg === '--base-url' || arg === '--state-file') {
      const value = args[i + 1]
      if (!value) {
        throw new Error(`Missing value for ${arg}`)
      }

      sessionArgs.push(value)
      i += 1
    }
  }

  const sessionOptions = parsePlaywrightSessionArgs(sessionArgs)

  return {
    baseUrl: sessionOptions.baseUrl,
    help: sessionOptions.help,
    journeyId,
    outputDir,
    persona: sessionOptions.persona,
    stateFile: sessionOptions.stateFile,
  }
}

export const getPlaywrightJourneyCaptureHelpText = () => `${getPlaywrightSessionHelpText('check')}

Capture a registered admin journey with checkpoint screenshots.

Usage:
  pnpm playwright:journey:capture -- --journey admin.clinics.create-draft --persona admin

Additional options:
  --journey <id>         Registered journey id to execute
  --output-dir <path>    Root output directory (default: output/playwright/journeys)
`

export async function captureAdminJourneyFromCliArgs(argv: string[]) {
  loadLocalAndTestEnv()
  applyE2ERuntimeDefaults(process.env)

  const options = parsePlaywrightJourneyCaptureArgs(argv)

  if (options.help) {
    console.log(getPlaywrightJourneyCaptureHelpText())
    return
  }

  if (!options.journeyId) {
    throw new Error('Missing required --journey option.')
  }

  const journey = findAdminJourneyDefinition(options.journeyId)

  if (!journey) {
    throw new Error(`Unknown journey id: ${options.journeyId}`)
  }

  if (journey.persona !== options.persona) {
    throw new Error(`Journey ${options.journeyId} requires persona ${journey.persona}, not ${options.persona}.`)
  }

  const absoluteStateFile = path.resolve(process.cwd(), options.stateFile || getDefaultStateFile(options.persona))
  const absoluteOutputRoot = path.resolve(process.cwd(), options.outputDir)
  const absoluteJourneyOutputDir = path.join(absoluteOutputRoot, getAdminJourneyOutputSlug(options.journeyId))

  if (!existsSync(absoluteStateFile)) {
    throw new Error(
      `Session state file not found at ${absoluteStateFile}. Run pnpm playwright:session:record -- --persona ${options.persona} first.`,
    )
  }

  await mkdir(absoluteJourneyOutputDir, { recursive: true })

  const browser = await chromium.launch({ headless: true })
  const apiContext = await playwrightRequest.newContext({
    baseURL: options.baseUrl,
    storageState: absoluteStateFile,
  })

  try {
    const context = await browser.newContext({
      baseURL: options.baseUrl,
      storageState: absoluteStateFile,
    })
    const page = await context.newPage()
    const issues = createBrowserIssueCollector(page)
    const sessionCheckUrl = getPlaywrightSessionCheckUrl(options.persona, options.baseUrl)

    await page.goto(sessionCheckUrl, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined)

    if (!(await isValidPlaywrightSessionForPersona(page.url(), options.persona, options.baseUrl, apiContext))) {
      throw new Error(
        `Stored session is not valid for ${options.persona}. Final URL was ${page.url()}. Re-record it with pnpm playwright:session:record -- --persona ${options.persona}.`,
      )
    }

    const captureHandler = await createJourneyCaptureHandler({
      outputDir: absoluteJourneyOutputDir,
    })

    const result = await executeAdminJourney(journey, {
      captureHandler,
      mode: 'capture',
      page,
      persona: options.persona,
      request: apiContext,
    })

    const metadataPath = path.join(absoluteJourneyOutputDir, 'metadata.json')
    await writeFile(
      metadataPath,
      JSON.stringify(
        {
          ...result,
          issues,
        },
        null,
        2,
      ),
      'utf8',
    )

    console.log(`[playwright:journey:capture] captured ${options.journeyId} to ${absoluteJourneyOutputDir}`)
    console.log(`[playwright:journey:capture] metadata written to ${metadataPath}`)
  } finally {
    await apiContext.dispose()
    await browser.close()
  }
}

const isDirectExecution = () => {
  const entryPoint = process.argv[1]

  if (!entryPoint) {
    return false
  }

  return import.meta.url === pathToFileURL(entryPoint).href
}

if (isDirectExecution()) {
  captureAdminJourneyFromCliArgs(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error)
    process.exit(1)
  })
}
