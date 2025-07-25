import type { CollectionSlug, GlobalSlug, Payload, PayloadRequest } from 'payload'

import { contactForm as contactFormData } from './contact-form'
import { contact as contactPageData } from './contact-page'
import { home } from './home'
import { image1 } from './image-1'
import { image2 } from './image-2'
import { imageHero1 } from './image-hero-1'
import { seedClinics } from './clinics/clinics-seed'
import { seedDoctors } from './clinics/doctors-seed'
import { seedMedicalSpecialties } from './medical/medical-specialties-seed'
import { seedTreatments } from './clinics/treatments-seed'
import { seedReviews } from './reviews/reviews-seed'
import { seedCountriesAndCities } from './locations/countries-cities-seed'
import { seedPosts } from './posts/posts-seed'
import { seedGlobal } from './globals/globals-seed'
import { fetchFileByURL } from './seed-helpers'

const globals: GlobalSlug[] = ['header', 'footer']

// Next.js revalidation errors are normal when seeding the database without a server running
// i.e. running `yarn seed` locally instead of using the admin UI within an active app
// The app is not running to revalidate the pages and so the API routes are not available
// These error messages can be ignored: `Error hitting revalidate route for...`
export const seed = async ({
  payload,
  req,
}: {
  payload: Payload
  req: PayloadRequest
}): Promise<void> => {
  payload.logger.info('Seeding database...')

  // we need to clear the media directory before seeding
  // as well as the collections and globals
  // this is because while `yarn seed` drops the database
  // the custom `/api/seed` endpoint does not
  payload.logger.info(`— Clearing collections and globals...`)

  // clear the database
  await Promise.all(
    globals.map((global) =>
      payload.updateGlobal({
        slug: global,
        data: {
          navItems: [],
        },
        depth: 0,
        context: {
          disableRevalidate: true,
        },
      }),
    ),
  )

  // Adjust the order of deletion to avoid foreign key constraint issues
  const collectionsToDelete: CollectionSlug[] = [
    'form-submissions', // Delete dependent collections first
    'forms',
    'reviews',
    'doctors',
    'clinics',
    'cities',
    'countries',
    'categories',
    'media',
    'pages',
    'posts',
    'search',
    'platformStaff',
    'basicUsers',
    'patients',
    'clinicStaff',
    'accreditation',
    'treatments',
    'medical-specialties',
  ]

  // Delete collections with logging
  for (const collection of collectionsToDelete) {
    payload.logger.info(`— Deleting all documents from collection: ${collection}...`)
    await payload.db.deleteMany({ collection, req, where: {} })
  }

  await Promise.all(
    collectionsToDelete
      .filter((collection) => Boolean(payload.collections[collection]?.config.versions))
      .map((collection) => payload.db.deleteVersions({ collection, req, where: {} })),
  )

  payload.logger.info(`— Seeding demo author and user...`)

  await payload.delete({
    collection: 'platformStaff',
    depth: 0,
    where: {
      email: {
        equals: 'demo-author@example.com',
      },
    },
  })

  await payload.delete({
    collection: 'basicUsers',
    depth: 0,
    where: {
      email: {
        equals: 'demo-author@example.com',
      },
    },
  })

  payload.logger.info(`— Seeding media...`)

  const [image1Buffer, image2Buffer, image3Buffer, hero1Buffer] = await Promise.all([
    fetchFileByURL(
      'https://raw.githubusercontent.com/payloadcms/payload/refs/heads/main/templates/website/src/endpoints/seed/image-post1.webp',
    ),
    fetchFileByURL(
      'https://raw.githubusercontent.com/payloadcms/payload/refs/heads/main/templates/website/src/endpoints/seed/image-post2.webp',
    ),
    fetchFileByURL(
      'https://raw.githubusercontent.com/payloadcms/payload/refs/heads/main/templates/website/src/endpoints/seed/image-post3.webp',
    ),
    fetchFileByURL(
      'https://raw.githubusercontent.com/payloadcms/payload/refs/heads/main/templates/website/src/endpoints/seed/image-hero1.webp',
    ),
  ])

  const [demoAuthor, image1Doc, image2Doc, image3Doc, imageHomeDoc] = await Promise.all([
    (async () => {
      // First create the basic user
      const demoUser = await payload.create({
        collection: 'basicUsers',
        data: {
          email: 'demo-author@example.com',
          supabaseUserId: 'demo-supabase-user-id',
          userType: 'platform',
        },
      })

      // Then create the platform staff record that references the user
      return payload.create({
        collection: 'platformStaff',
        data: {
          user: demoUser.id,
          role: 'admin',
          firstName: 'Demo',
          lastName: 'Author',
        },
      })
    })(),
    payload.create({
      collection: 'media',
      data: image1,
      file: image1Buffer,
    }),
    payload.create({
      collection: 'media',
      data: image2,
      file: image2Buffer,
    }),
    payload.create({
      collection: 'media',
      data: image2,
      file: image3Buffer,
    }),
    payload.create({
      collection: 'media',
      data: imageHero1,
      file: hero1Buffer,
    }),
  ])

  payload.logger.info(`— Seeding categories...`)

  const categories = ['Technology', 'News', 'Finance', 'Design', 'Software', 'Engineering']
  await Promise.all(
    categories.map((title) =>
      payload.create({
        collection: 'categories',
        data: {
          title,
          breadcrumbs: [{ label: title, url: `/${title.toLowerCase()}` }],
        },
      }),
    ),
  )

  payload.logger.info(`— Seeding posts...`)

  await seedPosts(payload, [image1Doc, image2Doc, image3Doc], demoAuthor)

  payload.logger.info(`— Seeding contact form...`)

  const contactForm = await payload.create({
    collection: 'forms',
    depth: 0,
    data: contactFormData,
  })

  payload.logger.info(`— Seeding medical specialties...`)
  const specialties = await seedMedicalSpecialties(payload)

  payload.logger.info(`— Seeding countries and cities...`)
  const cityDocs = await seedCountriesAndCities(payload)

  payload.logger.info(`— Seeding clinics...`)
  const clinicDocs = await seedClinics(payload, cityDocs)

  payload.logger.info(`— Seeding doctors...`)
  const doctorDocs = await seedDoctors(payload, clinicDocs)

  payload.logger.info(`— Seeding treatments...`)
  const treatmentDocs = await seedTreatments(payload, {
    clinics: clinicDocs,
    doctors: doctorDocs,
    specialties: specialties || [],
  })

  // Fetch demo patients (platformStaff)
  const patients = await payload.find({ collection: 'platformStaff', limit: 10 })

  payload.logger.info('— Seeding reviews...')
  await seedReviews(payload, {
    patients: patients.docs,
    clinics: clinicDocs,
    doctors: doctorDocs,
    treatments: treatmentDocs,
  })

  payload.logger.info(`— Seeding pages...`)

  const [_, contactPage] = await Promise.all([
    payload.create({
      collection: 'pages',
      depth: 0,
      data: home({ heroImage: imageHomeDoc, metaImage: image2Doc }),
    }),
    payload.create({
      collection: 'pages',
      depth: 0,
      data: contactPageData({ contactForm: contactForm }),
    }),
  ])

  payload.logger.info(`— Seeding globals...`)

  await seedGlobal(payload, contactPage)

  payload.logger.info('Seeded database successfully!')
}
