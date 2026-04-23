import payload from 'payload'

import config from '../src/payload.config'
import { cleanupTestEntities } from '../tests/fixtures/cleanupTestEntities'
import { createClinicFixture } from '../tests/fixtures/createClinicFixture'

function parseArgs(argv: string[]) {
  const [command, ...rest] = argv

  if (command !== 'create' && command !== 'cleanup') {
    throw new Error('Expected command to be "create" or "cleanup".')
  }

  let prefix = ''

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

    throw new Error(`Unknown argument: ${arg}`)
  }

  if (!prefix) {
    throw new Error('Missing required --prefix argument.')
  }

  return {
    command,
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
  await cleanupTestEntities(payload, 'doctors', prefix)
  await cleanupTestEntities(payload, 'clinics', prefix)
  await cleanupTestEntities(payload, 'cities', prefix)
  await cleanupTestEntities(payload, 'countries', prefix)
}

async function main() {
  const { command, prefix } = parseArgs(process.argv.slice(2))

  await payload.init({ config })

  if (command === 'create') {
    await createFixture(prefix)
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
