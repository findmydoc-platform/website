import type { Payload } from 'payload'
import type { PlatformStaff, Media, City, Clinic, Doctor, Treatment, MedicalSpecialty } from '@/payload-types'

import { seedClinics } from '../clinics/clinics-seed'
import { seedDoctors } from '../clinics/doctors-seed'
import { seedTreatments } from '../clinics/treatments-seed'
import { seedPosts } from '../posts/posts-seed'
import { seedReviews } from '../reviews/reviews-seed'
import { fetchFileByURL } from '../seed-helpers'
import { image1 } from '../image-1'
import { image2 } from '../image-2'
import { image3 } from '../image-3'

export interface SeedResult {
  created: number
  updated: number
}
export interface DemoSeedUnit {
  name: string
  run: (payload: Payload) => Promise<SeedResult>
}

// --- Internal helpers (demo scope) -----------------------------------------------------------

async function ensureDemoAuthor(payload: Payload): Promise<PlatformStaff> {
  // 1. Try to find existing demo author (by related user email)
  const existing = await payload.find({
    collection: 'platformStaff',
    where: { 'user.email': { equals: 'demo-author@example.com' } },
    limit: 1,
  })
  if (existing.docs[0]) return existing.docs[0] as PlatformStaff

  // 2. Ensure BasicUser exists (auto profile hook will create platformStaff)
  let basicUser = await payload.find({
    collection: 'basicUsers',
    where: { email: { equals: 'demo-author@example.com' } },
    limit: 1,
  })

  if (!basicUser.docs[0]) {
    basicUser = (await payload.create({
      collection: 'basicUsers',
      data: {
        email: 'demo-author@example.com',
        supabaseUserId: 'demo-supabase-user-id', // deterministic seed value
        userType: 'platform',
      },
      // overrideAccess not required if seeding runs with internal context, add if needed:
      // overrideAccess: true,
    })) as any
  }

  const basicUserId = (basicUser as any).docs ? (basicUser as any).docs[0].id : (basicUser as any).id

  // 3. Poll briefly for the platformStaff profile created by afterChange hook (should be immediate)
  const maxAttempts = 5
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const profile = await payload.find({
      collection: 'platformStaff',
      where: { user: { equals: basicUserId } },
      limit: 1,
    })
    if (profile.docs[0]) {
      const staff = profile.docs[0] as PlatformStaff
      // 4. Update name fields if still defaults
      if (staff.firstName !== 'Demo' || staff.lastName !== 'Author') {
        try {
          const updated = (await payload.update({
            collection: 'platformStaff',
            id: staff.id,
            data: {
              firstName: 'Demo',
              lastName: 'Author',
              role: 'admin', // ensure role is admin for content seeding
            },
          })) as PlatformStaff
          return updated
        } catch (_err) {
          // If update fails for any reason just return existing to avoid seed abort
          return staff
        }
      }
      return staff
    }
    // tiny delay before retry (100ms)
    await new Promise((r) => setTimeout(r, 100))
  }

  throw new Error('Failed to create demo author platformStaff profile via hook')
}

async function ensureMedia(payload: Payload): Promise<Media[]> {
  const targets = [
    {
      filename: 'image-post1.webp',
      data: image1,
      url: 'https://raw.githubusercontent.com/payloadcms/payload/refs/heads/main/templates/website/src/endpoints/seed/image-post1.webp',
    },
    {
      filename: 'image-post2.webp',
      data: image2,
      url: 'https://raw.githubusercontent.com/payloadcms/payload/refs/heads/main/templates/website/src/endpoints/seed/image-post2.webp',
    },
    {
      filename: 'image-post3.webp',
      data: image3,
      url: 'https://raw.githubusercontent.com/payloadcms/payload/refs/heads/main/templates/website/src/endpoints/seed/image-post3.webp',
    },
  ] as const

  const out: Media[] = []
  for (const t of targets) {
    const existing = await payload.find({
      collection: 'media',
      where: { filename: { equals: t.filename } },
      limit: 1,
    })
    if (existing.docs[0]) {
      out.push(existing.docs[0] as Media)
      continue
    }
    const buf = await fetchFileByURL(t.url)
    const created = (await payload.create({
      collection: 'media',
      data: t.data,
      file: buf,
    })) as Media
    out.push(created)
  }
  return out
}

// --- Demo seed unit implementations ----------------------------------------------------------

const seedPostsDemo: DemoSeedUnit = {
  name: 'posts',
  run: async (payload) => {
    // If posts already exist, skip to keep counts stable until reset logic (Phase B) is added.
    const existingPosts = await payload.count({ collection: 'posts' })
    if (existingPosts.totalDocs >= 3) return { created: 0, updated: 0 }

    const author = await ensureDemoAuthor(payload)
    const media = await ensureMedia(payload)
    // Disable revalidation inside seed to avoid Next.js static generation invariant during CLI seeding
    await seedPosts(payload, media, author)
    return { created: 3, updated: 0 }
  },
}

const seedClinicsDemo: DemoSeedUnit = {
  name: 'clinics',
  run: async (payload) => {
    const existing = await payload.count({ collection: 'clinics' })
    if (existing.totalDocs > 0) return { created: 0, updated: 0 }
    const cities = await payload.find({ collection: 'cities', limit: 10 })
    const created = await seedClinics(payload, cities.docs as City[])
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

// TODO (Phase B): add pages + forms demo seed (home/contact) & categories if required.

export const demoSeeds: DemoSeedUnit[] = [
  seedPostsDemo,
  seedClinicsDemo,
  seedDoctorsDemo,
  seedTreatmentsDemo,
  seedReviewsDemo,
]

export async function runDemoSeeds(payload: Payload): Promise<SeedResult[]> {
  const results: SeedResult[] = []
  for (const unit of demoSeeds) {
    payload.logger.info(`Running demo seed: ${unit.name}`)
    const res = await unit.run(payload)
    payload.logger.info(`Finished demo seed: ${unit.name} (created=${res.created}, updated=${res.updated})`)
    results.push(res)
  }
  return results
}
