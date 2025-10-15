import type { Payload } from 'payload'
import type {
  PlatformStaff,
  PlatformContentMedia,
  City,
  Clinic,
  Doctor,
  Treatment,
  MedicalSpecialty,
  BasicUser,
} from '@/payload-types'

import { seedClinics } from '../clinics/clinics-seed'
import { seedDoctors } from '../clinics/doctors-seed'
import { seedTreatments } from '../clinics/treatments-seed'
import { seedPosts } from '../posts/posts-seed'
import { seedReviews } from '../reviews/reviews-seed'
import { createMediaFromURL } from '../seed-helpers'
import { image1 } from '../image-1'
import { image2 } from '../image-2'
import { image3 } from '../image-3'

// Types -------------------------------------------------------------------------------------------------

export interface SeedResult {
  created: number
  updated: number
}
export interface DemoSeedUnit {
  name: string
  run: (payload: Payload) => Promise<SeedResult>
}

/**
 * Ordered list of demo collections for reset operations.
 * Children / join collections first to avoid FK or dangling reference issues.
 */
export const DEMO_COLLECTIONS = ['reviews', 'clinictreatments', 'treatments', 'doctors', 'clinics', 'posts']

// Logging -----------------------------------------------------------------------------------------------

/** Log a seed unit result with consistent format. */
export function logSeedUnitResult(payload: Payload, scope: 'baseline' | 'demo', name: string, res: SeedResult) {
  payload.logger.info(`Finished ${scope} seed: ${name} (created=${res.created}, updated=${res.updated})`)
}

// Internal helpers
async function ensureDemoAuthor(payload: Payload): Promise<PlatformStaff> {
  const existing = await payload.find({
    collection: 'platformStaff',
    where: { 'user.email': { equals: 'demo-author@example.com' } },
    limit: 1,
  })
  if (existing.docs[0]) return existing.docs[0] as PlatformStaff

  let basicUser = await payload.find({
    collection: 'basicUsers',
    where: { email: { equals: 'demo-author@example.com' } },
    limit: 1,
  })

  if (!basicUser.docs[0]) {
    // Include a demo password so server-side validation (virtual required password field)
    // passes when creating BasicUsers during seeding. This value is only used in demo
    // environments and not persisted (field is virtual).
    basicUser = (await payload.create({
      collection: 'basicUsers',
      data: {
        email: 'demo-author@example.com',
        supabaseUserId: 'demo-supabase-user-id',
        userType: 'platform',
        firstName: 'Demo',
        lastName: 'Author',
        password: 'demo-password',
      },
    })) as any
  } else {
    // ensure names are set on existing basic user
    const bu = basicUser.docs[0] as BasicUser
    if (bu.firstName !== 'Demo' || bu.lastName !== 'Author') {
      await payload.update({
        collection: 'basicUsers',
        id: bu.id,
        data: { firstName: 'Demo', lastName: 'Author' },
      })
    }
  }

  const basicUserId = (basicUser as any).docs ? (basicUser as any).docs[0].id : (basicUser as any).id

  const maxAttempts = 5
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const profile = await payload.find({
      collection: 'platformStaff',
      where: { user: { equals: basicUserId } },
      limit: 1,
    })
    if (profile.docs[0]) {
      const staff = profile.docs[0] as PlatformStaff
      // ensure role is admin; names are centralized so only adjust role here
      if (staff.role !== 'admin') {
        try {
          const updated = (await payload.update({
            collection: 'platformStaff',
            id: staff.id,
            data: { role: 'admin' },
          })) as PlatformStaff
          return updated
        } catch (_err) {
          return staff
        }
      }
      return staff
    }
    await new Promise((r) => setTimeout(r, 100))
  }

  throw new Error('Failed to create demo author platformStaff profile via hook')
}

function getBasicUserIdFromPlatformStaff(staff: PlatformStaff): string {
  const user = staff.user
  if (!user) {
    throw new Error('Platform staff record is missing its associated basic user')
  }

  if (typeof user === 'object') {
    return String(user.id)
  }

  return String(user)
}

async function ensureMedia(payload: Payload, uploaderId: number): Promise<PlatformContentMedia[]> {
  const targets = [
    {
      label: 'image-post1.webp',
      data: image1,
      url: 'https://raw.githubusercontent.com/findmydoc-platform/website/main/src/endpoints/seed/image-post1.webp',
    },
    {
      label: 'image-post2.webp',
      data: image2,
      url: 'https://raw.githubusercontent.com/findmydoc-platform/website/main/src/endpoints/seed/image-post2.webp',
    },
    {
      label: 'image-post3.webp',
      data: image3,
      url: 'https://raw.githubusercontent.com/findmydoc-platform/website/main/src/endpoints/seed/image-post3.webp',
    },
  ] as const

  const out: PlatformContentMedia[] = []
  for (const t of targets) {
    const existing = await payload.find({
      collection: 'platformContentMedia',
      // Query by explicit field 'alt' to avoid relying on implicit upload field values
      where: { alt: { equals: t.label } },
      limit: 1,
    })
    if (existing.docs[0]) {
      out.push(existing.docs[0] as PlatformContentMedia)
      continue
    }
    const created = (await createMediaFromURL(payload, {
      collection: 'platformContentMedia',
      url: t.url,
      data: {
        ...t.data,
        alt: t.label,
        storagePath: 'auto-generated',
        createdBy: uploaderId,
      },
    })) as PlatformContentMedia
    out.push(created)
  }
  return out
}

// Demo seed unit implementations

const seedPostsDemo: DemoSeedUnit = {
  name: 'posts',
  run: async (payload) => {
    const existingPosts = await payload.count({ collection: 'posts' })
    if (existingPosts.totalDocs >= 3) return { created: 0, updated: 0 }

    const author = await ensureDemoAuthor(payload)
    const uploaderId = Number(getBasicUserIdFromPlatformStaff(author))
    const media = await ensureMedia(payload, uploaderId)
    // Disable revalidation to avoid Next.js invariant during CLI seeding
    await seedPosts(payload, media, author)
    return { created: 3, updated: 0 }
  },
}

const seedClinicsDemo: DemoSeedUnit = {
  name: 'clinics',
  run: async (payload) => {
    const existing = await payload.count({ collection: 'clinics' })
    if (existing.totalDocs > 0) return { created: 0, updated: 0 }
    const author = await ensureDemoAuthor(payload)
    const uploaderId = getBasicUserIdFromPlatformStaff(author)
    const cities = await payload.find({ collection: 'cities', limit: 10 })
    const created = await seedClinics(payload, cities.docs as City[], uploaderId)
    return { created: created.length, updated: 0 }
  },
}

const seedDoctorsDemo: DemoSeedUnit = {
  name: 'doctors',
  run: async (payload) => {
    const existing = await payload.count({ collection: 'doctors' })
    if (existing.totalDocs > 0) return { created: 0, updated: 0 }
    const clinics = await payload.find({ collection: 'clinics', limit: 50 })
    const created = await seedDoctors(payload, clinics.docs as Clinic[])
    return { created: created.length, updated: 0 }
  },
}

const seedTreatmentsDemo: DemoSeedUnit = {
  name: 'treatments',
  run: async (payload) => {
    const existing = await payload.count({ collection: 'treatments' })
    if (existing.totalDocs > 0) return { created: 0, updated: 0 }
    const [clinics, doctors, specialties] = await Promise.all([
      payload.find({ collection: 'clinics', limit: 50 }),
      payload.find({ collection: 'doctors', limit: 50 }),
      payload.find({ collection: 'medical-specialties', limit: 200 }),
    ])
    const created = await seedTreatments(payload, {
      clinics: clinics.docs as Clinic[],
      doctors: doctors.docs as Doctor[],
      specialties: specialties.docs as MedicalSpecialty[],
    })
    return { created: created.length, updated: 0 }
  },
}

const seedReviewsDemo: DemoSeedUnit = {
  name: 'reviews',
  run: async (payload) => {
    const existing = await payload.count({ collection: 'reviews' })
    if (existing.totalDocs > 0) return { created: 0, updated: 0 }
    const [patients, clinics, doctors, treatments] = await Promise.all([
      payload.find({ collection: 'platformStaff', limit: 10 }),
      payload.find({ collection: 'clinics', limit: 50 }),
      payload.find({ collection: 'doctors', limit: 50 }),
      payload.find({ collection: 'treatments', limit: 50 }),
    ])
    const created = await seedReviews(payload, {
      patients: patients.docs as PlatformStaff[],
      clinics: clinics.docs as Clinic[],
      doctors: doctors.docs as Doctor[],
      treatments: treatments.docs as Treatment[],
    })
    return { created: created.length, updated: 0 }
  },
}

// TODO: add pages + forms demo seed (home/contact) & categories if required.

export const demoSeeds: DemoSeedUnit[] = [
  seedPostsDemo,
  seedClinicsDemo,
  seedDoctorsDemo,
  seedTreatmentsDemo,
  seedReviewsDemo,
]
export interface RunDemoOptions {
  reset?: boolean
}

export interface DemoSeedFailure {
  name: string
  error: string
}
export interface DemoSeedSuccess extends SeedResult {
  name: string
}
export interface DemoRunOutcome {
  units: DemoSeedSuccess[]
  partialFailures: DemoSeedFailure[]
  beforeCounts?: Record<string, number>
  afterCounts?: Record<string, number>
  reset?: boolean
}

/**
 * Run demo seeds with optional reset. Aggregates errors (tiered policy):
 * - Collects partialFailures instead of failing fast.
 * - Optionally captures before/after counts for observability when resetting.
 */
export async function runDemoSeeds(payload: Payload, opts: RunDemoOptions = {}): Promise<DemoRunOutcome> {
  let beforeCounts: Record<string, number> | undefined

  if (opts.reset) {
    beforeCounts = {}
    for (const c of DEMO_COLLECTIONS) {
      try {
        const cRes = await payload.count({ collection: c as any })
        beforeCounts[c] = cRes.totalDocs
      } catch (err: any) {
        payload.logger.warn(`Could not count collection ${c} before reset: ${err.message}`)
        beforeCounts[c] = -1
      }
    }
    const { clearCollections } = await import('../seed-helpers')
    await clearCollections(payload, DEMO_COLLECTIONS, { disableRevalidate: true })
  }

  const units: DemoSeedSuccess[] = []
  const partialFailures: DemoSeedFailure[] = []

  for (const unit of demoSeeds) {
    payload.logger.info(`Running demo seed: ${unit.name}`)
    try {
      const res = await unit.run(payload)
      logSeedUnitResult(payload, 'demo', unit.name, res)
      units.push({ name: unit.name, ...res })
    } catch (e: any) {
      payload.logger.error(`Demo seed unit failed (continuing): ${unit.name}: ${e.message}`)
      partialFailures.push({ name: unit.name, error: e.message })
    }
  }

  let afterCounts: Record<string, number> | undefined
  if (opts.reset) {
    afterCounts = {}
    for (const c of DEMO_COLLECTIONS) {
      try {
        const cRes = await payload.count({ collection: c as any })
        afterCounts[c] = cRes.totalDocs
      } catch (_err: any) {
        afterCounts[c] = -1
      }
    }
  }

  return { units, partialFailures, beforeCounts, afterCounts, reset: opts.reset }
}
