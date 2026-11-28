import payload from 'payload'

import config from '../src/payload.config'
import type { Clinic } from '../src/payload-types'
import { canonicalizeDescriptionText } from '../src/features/clinicDashboard/profile/richText'
import { createTinyPngFile } from '../tests/fixtures/mediaFile'
import { cleanupTestEntities } from '../tests/fixtures/cleanupTestEntities'
import { createClinicFixture } from '../tests/fixtures/createClinicFixture'

type OverviewFixture = 'complete' | 'sparse' | 'unpublished'

function parseArgs(argv: string[]) {
  const [command, ...rest] = argv

  if (command !== 'create' && command !== 'cleanup' && command !== 'read-inquiry') {
    throw new Error('Expected command to be "create", "cleanup", or "read-inquiry".')
  }

  let prefix = ''
  let email = ''
  let overview: OverviewFixture | undefined

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

    if (arg === '--overview') {
      const variant = rest[index + 1]
      if (variant !== 'complete' && variant !== 'sparse' && variant !== 'unpublished') {
        throw new Error('Expected --overview to be complete, sparse, or unpublished.')
      }
      overview = variant
      index += 1
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
    overview,
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

async function createFixture(prefix: string, overview?: OverviewFixture) {
  const countryId = await ensureCountryId(prefix)

  const city = await payload.create({
    collection: 'cities',
    data: {
      name: `${prefix}-city`,
      airportcode: 'E2E',
      coordinates: [13.405, 52.52],
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
      status: overview === 'unpublished' ? 'pending' : 'approved',
      ...(overview ? { description: null } : {}),
      coordinates: [13.405, 52.52],
    },
    overrideAccess: true,
    depth: 0,
  })

  if (overview === 'complete') {
    const image = await payload.create({
      collection: 'clinicMedia',
      file: createTinyPngFile(`${prefix}-gallery.png`),
      data: { clinic: clinic.id, alt: 'Profile test original image', status: 'published', storagePath: '' },
      overrideAccess: true,
      context: { disableRevalidate: true },
    })
    for (const locale of ['de', 'en'] as const) {
      const lexical = (text: string) => canonicalizeDescriptionText(text) as NonNullable<Clinic['description']>
      await payload.update({
        collection: 'cities',
        id: city.id,
        locale,
        data: { displayName: locale === 'de' ? 'Profilteststadt' : 'Profile Test City' },
        overrideAccess: true,
        context: { disableRevalidate: true },
      })
      await payload.update({
        collection: 'clinicMedia',
        id: image.id,
        locale,
        data: {
          localizedAlt: locale === 'de' ? 'Eingang zur Profiltestklinik' : 'Entrance to the profile test clinic',
          localizedCaption: lexical(locale === 'de' ? 'Profiltest Bildtitel' : 'Profile test caption'),
        },
        overrideAccess: true,
        context: { disableRevalidate: true },
      })
      await payload.update({
        collection: 'clinics',
        id: clinic.id,
        locale,
        data: {
          profileGallery: [image.id],
          localizedDescription: lexical(
            locale === 'de' ? 'Profiltest Klinikbeschreibung' : 'Profile test clinic description',
          ),
        },
        overrideAccess: true,
        context: { disableRevalidate: true },
      })
    }
  }

  process.stdout.write(
    `${JSON.stringify({ id: updatedClinic.id, slug: updatedClinic.slug, status: updatedClinic.status })}\n`,
  )
}

async function cleanupFixture(prefix: string) {
  await cleanupTestEntities(payload, 'patientClinicInquiries', prefix)
  await cleanupTestEntities(payload, 'doctors', prefix)
  const clinics = await payload.find({
    collection: 'clinics',
    depth: 0,
    overrideAccess: true,
    where: { slug: { like: `${prefix}%` } },
  })
  for (const clinic of clinics.docs) {
    if (!clinic.profileGallery?.length) continue
    await payload.update({
      collection: 'clinics',
      id: clinic.id,
      data: { profileGallery: [] },
      overrideAccess: true,
      context: { disableRevalidate: true },
    })
    for (const mediaId of clinic.profileGallery) {
      const id = extractRelationId(mediaId)
      if (id !== null) await payload.delete({ collection: 'clinicMedia', id, overrideAccess: true })
    }
  }
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
    limit: 100,
    overrideAccess: true,
    depth: 0,
  })

  const allClinicInquiries = await payload.find({
    collection: 'patientClinicInquiries',
    where: { clinic: { in: clinicIds } },
    limit: 100,
    overrideAccess: true,
    depth: 0,
  })

  const inquiry = inquiries.docs[0]
  process.stdout.write(
    `${JSON.stringify({
      found: Boolean(inquiry),
      id: inquiry?.id,
      clinic: extractRelationId(inquiry?.clinic),
      doctor: extractRelationId(inquiry?.doctor),
      treatment: extractRelationId(inquiry?.treatment),
      status: inquiry?.status,
      email: inquiry?.email,
      createdAt: inquiry?.createdAt,
      count: inquiries.docs.length,
      totalClinicCount: allClinicInquiries.docs.length,
    })}\n`,
  )
}

async function main() {
  const { command, email, overview, prefix } = parseArgs(process.argv.slice(2))

  await payload.init({ config })

  if (command === 'create') {
    await createFixture(prefix, overview)
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
