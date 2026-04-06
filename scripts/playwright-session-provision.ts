import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { randomBytes } from 'node:crypto'
import { config as dotenvConfig } from 'dotenv'
import payload from 'payload'
import {
  getDefaultStateFile,
  getPlaywrightSessionHelpText,
  parsePlaywrightSessionProvisionArgs,
  type PlaywrightSessionPersona,
} from './playwright-session'

type ProvisionedPlaywrightUserMetadata = {
  createdAt: string
  email: string
  persona: PlaywrightSessionPersona
  sessionFile: string
  supabaseUserId: string
  userId: number | string
}

const buildDisposableAdminEmail = (persona: PlaywrightSessionPersona): string => {
  return `playwright.session.${persona}+${Date.now()}@example.com`
}

const buildDisposableAdminPassword = (): string => {
  return `Pw!${randomBytes(9).toString('base64url')}`
}

const loadLocalEnv = () => {
  dotenvConfig({ path: path.resolve(process.cwd(), '.env.local'), quiet: true })
  dotenvConfig({ path: path.resolve(process.cwd(), '.env'), quiet: true })

  if (!process.env.PAYLOAD_SECRET && process.env.PAYLOAD_SECRET_KEY) {
    process.env.PAYLOAD_SECRET = process.env.PAYLOAD_SECRET_KEY
  }
}

export async function provisionPlaywrightSessionUserFromCliArgs(argv: string[]) {
  const options = parsePlaywrightSessionProvisionArgs(argv)

  if (options.help) {
    console.log(getPlaywrightSessionHelpText('provision'))
    return
  }

  const absoluteMetadataFile = path.resolve(process.cwd(), options.metadataFile)
  const relativeMetadataFile = path.relative(process.cwd(), absoluteMetadataFile) || options.metadataFile

  if (existsSync(absoluteMetadataFile)) {
    throw new Error(
      `Disposable user metadata already exists at ${relativeMetadataFile}. Clean it up with pnpm playwright:session:cleanup -- --persona ${options.persona} before provisioning another disposable account.`,
    )
  }

  loadLocalEnv()

  const email = options.email ?? buildDisposableAdminEmail(options.persona)
  const password = options.password ?? buildDisposableAdminPassword()

  const { default: config } = await import('../src/payload.config')
  const { createSupabaseAccountWithPassword } = await import('../src/auth/utilities/supabaseProvision')

  await payload.init({ config })

  try {
    const supabaseUserId = await createSupabaseAccountWithPassword({
      email,
      password,
      userType: 'platform',
      userMetadata: {
        firstName: options.firstName,
        lastName: options.lastName,
      },
    })

    const user = await payload.create({
      collection: 'basicUsers',
      data: {
        email,
        firstName: options.firstName,
        lastName: options.lastName,
        supabaseUserId,
        userType: 'platform',
      },
      overrideAccess: true,
      context: {
        skipSupabaseUserCreation: true,
        userMetadata: {
          firstName: options.firstName,
          lastName: options.lastName,
        },
      },
    })

    const metadata: ProvisionedPlaywrightUserMetadata = {
      createdAt: new Date().toISOString(),
      email,
      persona: options.persona,
      sessionFile: getDefaultStateFile(options.persona),
      supabaseUserId,
      userId: user.id,
    }

    await mkdir(path.dirname(absoluteMetadataFile), { recursive: true })
    await writeFile(absoluteMetadataFile, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8')

    console.log(
      JSON.stringify(
        {
          email,
          metadataFile: relativeMetadataFile,
          password,
          supabaseUserId,
          userId: user.id,
        },
        null,
        2,
      ),
    )
  } finally {
    await payload.destroy().catch(() => undefined)
  }
}

provisionPlaywrightSessionUserFromCliArgs(process.argv.slice(2)).catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
