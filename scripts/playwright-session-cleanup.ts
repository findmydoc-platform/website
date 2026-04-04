import { existsSync } from 'node:fs'
import { readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { config as dotenvConfig } from 'dotenv'
import payload from 'payload'
import {
  getDefaultStateFile,
  getPlaywrightSessionHelpText,
  parsePlaywrightSessionCleanupArgs,
  type PlaywrightSessionPersona,
} from './playwright-session'

type ProvisionedPlaywrightUserMetadata = {
  email?: string
  persona?: PlaywrightSessionPersona
  sessionFile?: string
  supabaseUserId?: string
  userId?: number | string
}

const loadLocalEnv = () => {
  dotenvConfig({ path: path.resolve(process.cwd(), '.env.local'), quiet: true })
  dotenvConfig({ path: path.resolve(process.cwd(), '.env'), quiet: true })

  if (!process.env.PAYLOAD_SECRET && process.env.PAYLOAD_SECRET_KEY) {
    process.env.PAYLOAD_SECRET = process.env.PAYLOAD_SECRET_KEY
  }
}

const removeIfExists = async (filePath: string) => {
  if (!existsSync(filePath)) return
  await rm(filePath, { force: true })
}

export async function cleanupPlaywrightSessionUserFromCliArgs(argv: string[]) {
  const options = parsePlaywrightSessionCleanupArgs(argv)

  if (options.help) {
    console.log(getPlaywrightSessionHelpText('cleanup'))
    return
  }

  const absoluteMetadataFile = path.resolve(process.cwd(), options.metadataFile)
  const relativeMetadataFile = path.relative(process.cwd(), absoluteMetadataFile) || options.metadataFile

  let metadata: ProvisionedPlaywrightUserMetadata | undefined
  let usedMetadataFile = false

  if (!options.email && !options.userId) {
    if (!existsSync(absoluteMetadataFile)) {
      throw new Error(
        `No cleanup target provided and metadata file ${relativeMetadataFile} does not exist. Pass --email or --user-id, or provision a disposable admin first.`,
      )
    }

    metadata = JSON.parse(await readFile(absoluteMetadataFile, 'utf8')) as ProvisionedPlaywrightUserMetadata
    usedMetadataFile = true
  }

  const targetEmail = options.email ?? metadata?.email
  const targetUserId = options.userId ?? (metadata?.userId ? String(metadata.userId) : undefined)
  const shouldClearState = options.clearState || usedMetadataFile
  const absoluteStateFile = path.resolve(process.cwd(), metadata?.sessionFile ?? getDefaultStateFile(options.persona))

  loadLocalEnv()

  const { default: config } = await import('../src/payload.config')
  const { deleteSupabaseAccount } = await import('../src/auth/utilities/supabaseProvision')

  await payload.init({ config })

  try {
    let basicUserId = targetUserId
    const resolvedEmail = targetEmail
    let deletedSupabaseOnly = false

    if (!basicUserId) {
      if (!resolvedEmail) {
        throw new Error('Cleanup requires either a target email, a target user id, or a readable metadata file.')
      }

      const userQuery = await payload.find({
        collection: 'basicUsers',
        where: {
          email: { equals: resolvedEmail },
        },
        limit: 1,
        overrideAccess: true,
      })

      const user = userQuery.docs[0]
      if (user) {
        basicUserId = String(user.id)
      }
    }

    if (basicUserId) {
      await payload.delete({
        collection: 'basicUsers',
        id: basicUserId,
        overrideAccess: true,
      })
    } else if (metadata?.supabaseUserId) {
      const deleted = await deleteSupabaseAccount(metadata.supabaseUserId)
      if (!deleted) {
        throw new Error(
          `Could not delete Supabase user ${metadata.supabaseUserId} after no matching basicUsers record was found.`,
        )
      }
      deletedSupabaseOnly = true
    } else {
      throw new Error(
        'Could not find a matching basicUsers record and no Supabase user id was available for fallback cleanup.',
      )
    }

    await removeIfExists(absoluteMetadataFile)

    if (shouldClearState) {
      await removeIfExists(absoluteStateFile)
    }

    console.log(
      JSON.stringify(
        {
          clearedStateFile: shouldClearState
            ? path.relative(process.cwd(), absoluteStateFile) || absoluteStateFile
            : null,
          deletedSupabaseOnly,
          email: resolvedEmail ?? null,
          metadataFile: relativeMetadataFile,
          userId: basicUserId ?? null,
        },
        null,
        2,
      ),
    )
  } finally {
    await payload.destroy().catch(() => undefined)
  }
}

cleanupPlaywrightSessionUserFromCliArgs(process.argv.slice(2)).catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
