import payload from 'payload'

import config from '../src/payload.config'
import { cleanupTestEntities } from '../tests/fixtures/cleanupTestEntities'
import { createClinicFixture } from '../tests/fixtures/createClinicFixture'

function parseArgs(argv: string[]) {
  const [command, ...rest] = argv

  if (command !== 'create' && command !== 'cleanup' && command !== 'read-inquiry') {
    throw new Error('Expected command to be "create", "cleanup", or "read-inquiry".')
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
    command,
    email,
    prefix,
  }
}

async function ensureCountryId(prefix: string) {
  const countries = await payload.find({
    collection: 'countries',
    limit: 1,
    overrideAccess: true,
    depth: 0,
  })

  const existingCountry = countries.docs[0]
  if (existingCountry) {
    return existingCountry.id
  }

  const country = await payload.create({
    collection: 'countries',
    data: {
      name: `${prefix}-country`,
      isoCode: 'TR',
      language: 'turkish',
      currency: 'TRY',
    },
    overrideAccess: true,
    depth: 0,
  })

  return country.id
}

async function createFixture(prefix: string) {
  const countryId = await ensureCountryId(prefix)

  const city = await payload.create({
    collection: 'cities',
    data: {
      name: `${prefix}-city`,
      airportcode: 'E2E',
      coordinates: [52.52, 13.405],
      country: countryId,
    },
    overrideAccess: true,
    depth: 0,
  })

  const { clinic } = await createClinicFixture(payload, city.id, {
    slugPrefix: prefix,
  })

  const updatedClinic = await payload.update({
    collection: 'clinics',
    id: clinic.id,
    data: {
      status: 'approved',
      coordinates: [52.52, 13.405],
    },
    overrideAccess: true,
    depth: 0,
  })

  process.stdout.write(
    `${JSON.stringify({ id: updatedClinic.id, slug: updatedClinic.slug, status: updatedClinic.status })}\n`,
  )
}

async function cleanupFixture(prefix: string) {
  await cleanupTestEntities(payload, 'patientClinicInquiries', prefix)
  await cleanupTestEntities(payload, 'doctors', prefix)
  await cleanupTestEntities(payload, 'clinics', prefix)
  await cleanupTestEntities(payload, 'cities', prefix)
  await cleanupTestEntities(payload, 'countries', prefix)
}

async function readInquiry(prefix: string, email: string) {
  if (!email) {
    throw new Error('Missing required --email argument for read-inquiry.')
  }

  const clinics = await payload.find({
    collection: 'clinics',
    where: { slug: { like: `${prefix}%` } },
    limit: 100,
    overrideAccess: true,
    depth: 0,
  })

  const clinicIds = clinics.docs.map((doc) => doc.id)
  if (!clinicIds.length) {
    process.stdout.write(`${JSON.stringify({ found: false })}\n`)
    return
  }

  const inquiries = await payload.find({
    collection: 'patientClinicInquiries',
    where: {
      and: [{ clinic: { in: clinicIds } }, { email: { equals: email.toLowerCase() } }],
    },
    sort: '-createdAt',
    limit: 1,
    overrideAccess: true,
    depth: 0,
  })

  const inquiry = inquiries.docs[0]
  process.stdout.write(
    `${JSON.stringify({
      found: Boolean(inquiry),
      id: inquiry?.id,
      status: inquiry?.status,
      email: inquiry?.email,
    })}\n`,
  )
}

async function main() {
  const { command, email, prefix } = parseArgs(process.argv.slice(2))

  await payload.init({ config })

  if (command === 'create') {
    await createFixture(prefix)
    return
  }

  if (command === 'read-inquiry') {
    await readInquiry(prefix, email)
    return
  }

  await cleanupFixture(prefix)
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
