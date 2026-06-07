import payload from 'payload'

import config from '../src/payload.config'

type Command = 'cleanup' | 'read-application'

function parseArgs(argv: string[]) {
  const [command, ...rest] = argv

  if (command !== 'cleanup' && command !== 'read-application') {
    throw new Error('Expected command to be "cleanup" or "read-application".')
  }

  let prefix = ''
  let email = ''

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index]

    if (arg === '--prefix') {
      prefix = rest[index + 1] ?? ''
      index += 1
      continue
    }

    if (arg?.startsWith('--prefix=')) {
      prefix = arg.slice('--prefix='.length)
      continue
    }

    if (arg === '--email') {
      email = rest[index + 1] ?? ''
      index += 1
      continue
    }

    if (arg?.startsWith('--email=')) {
      email = arg.slice('--email='.length)
      continue
    }

    throw new Error(`Unknown argument: ${arg}`)
  }

  if (!prefix) {
    throw new Error('Missing required --prefix argument.')
  }

  return {
    command: command as Command,
    email,
    prefix,
  }
}

function extractRelationId(value: unknown): number | string | null {
  if (typeof value === 'number' || typeof value === 'string') return value

  if (value && typeof value === 'object' && 'id' in value) {
    return extractRelationId((value as { id?: unknown }).id)
  }

  return null
}

async function findApplicationsByPrefix(prefix: string) {
  return payload.find({
    collection: 'clinicApplications',
    where: { clinicName: { like: `${prefix}%` } },
    sort: '-createdAt',
    limit: 100,
    overrideAccess: true,
    depth: 0,
  })
}

async function cleanupApplications(prefix: string) {
  const applications = await findApplicationsByPrefix(prefix)

  for (const application of applications.docs) {
    await payload.delete({ collection: 'clinicApplications', id: application.id, overrideAccess: true })
  }
}

async function readApplication(prefix: string, email: string) {
  if (!email) {
    throw new Error('Missing required --email argument for read-application.')
  }

  const applications = await payload.find({
    collection: 'clinicApplications',
    where: {
      and: [{ clinicName: { like: `${prefix}%` } }, { contactEmail: { equals: email.toLowerCase() } }],
    },
    sort: '-createdAt',
    limit: 100,
    overrideAccess: true,
    depth: 0,
  })

  const application = applications.docs[0]
  const applicationRecord = application as Record<string, unknown> | undefined
  const privacyNotice =
    applicationRecord?.privacyNotice && typeof applicationRecord.privacyNotice === 'object'
      ? (applicationRecord.privacyNotice as Record<string, unknown>)
      : undefined
  const medicalSpecialties = Array.isArray(applicationRecord?.medicalSpecialties)
    ? applicationRecord.medicalSpecialties.map(extractRelationId).filter((id) => id !== null)
    : []

  process.stdout.write(
    `${JSON.stringify({
      found: Boolean(application),
      id: application?.id,
      clinicName: application?.clinicName,
      clinicWebsite: application?.clinicWebsite,
      contactFirstName: application?.contactFirstName,
      contactLastName: application?.contactLastName,
      contactEmail: application?.contactEmail,
      contactRole: application?.contactRole,
      medicalSpecialties,
      status: application?.status,
      createdAt: application?.createdAt,
      privacyNotice: {
        acknowledgedAt: privacyNotice?.acknowledgedAt,
        url: privacyNotice?.url,
      },
      hasAdditionalNotes: Boolean(
        applicationRecord && Object.prototype.hasOwnProperty.call(applicationRecord, 'additionalNotes'),
      ),
      count: applications.docs.length,
    })}\n`,
  )
}

async function main() {
  const { command, email, prefix } = parseArgs(process.argv.slice(2))

  await payload.init({ config })

  if (command === 'read-application') {
    await readApplication(prefix, email)
    return
  }

  await cleanupApplications(prefix)
}

void (async () => {
  try {
    await main()
    await payload.destroy().catch(() => undefined)
    process.exit(0)
  } catch (error) {
    console.error(error)
    await payload.destroy().catch(() => undefined)
    process.exit(1)
  }
})()
