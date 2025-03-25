import type { CollectionSlug, GlobalSlug, Payload, PayloadRequest, File } from 'payload'

import { contactForm as contactFormData } from './contact-form'
import { contact as contactPageData } from './contact-page'
import { home } from './home'
import { image1 } from './image-1'
import { image2 } from './image-2'
import { imageHero1 } from './image-hero-1'
import { post1 } from './post-1'
import { post2 } from './post-2'
import { post3 } from './post-3'
import { plasticSurgeryClinics } from './plastic-surgery-clinics'
import { plasticSurgeons } from './plastic-surgeons'

const collections: CollectionSlug[] = [
  'categories',
  'media',
  'pages',
  'posts',
  'forms',
  'form-submissions',
  'clinics',
  'doctors',
  'search',
]
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

  await Promise.all(
    collections.map((collection) => payload.db.deleteMany({ collection, req, where: {} })),
  )

  await Promise.all(
    collections
      .filter((collection) => Boolean(payload.collections[collection].config.versions))
      .map((collection) => payload.db.deleteVersions({ collection, req, where: {} })),
  )

  payload.logger.info(`— Seeding demo author and user...`)

  await payload.delete({
    collection: 'staff',
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
    payload.create({
      collection: 'staff',
      data: {
        roles: ['admin'],
        name: 'Demo Author',
        email: 'demo-author@example.com',
        supabaseId: 'demo-supabase-id',
      },
    }),
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

    payload.create({
      collection: 'categories',
      data: {
        title: 'Technology',
        breadcrumbs: [
          {
            label: 'Technology',
            url: '/technology',
          },
        ],
      },
    }),

    payload.create({
      collection: 'categories',
      data: {
        title: 'News',
        breadcrumbs: [
          {
            label: 'News',
            url: '/news',
          },
        ],
      },
    }),

    payload.create({
      collection: 'categories',
      data: {
        title: 'Finance',
        breadcrumbs: [
          {
            label: 'Finance',
            url: '/finance',
          },
        ],
      },
    }),
    payload.create({
      collection: 'categories',
      data: {
        title: 'Design',
        breadcrumbs: [
          {
            label: 'Design',
            url: '/design',
          },
        ],
      },
    }),

    payload.create({
      collection: 'categories',
      data: {
        title: 'Software',
        breadcrumbs: [
          {
            label: 'Software',
            url: '/software',
          },
        ],
      },
    }),

    payload.create({
      collection: 'categories',
      data: {
        title: 'Engineering',
        breadcrumbs: [
          {
            label: 'Engineering',
            url: '/engineering',
          },
        ],
      },
    }),
  ])

  payload.logger.info(`— Seeding posts...`)

  // Do not create posts with `Promise.all` because we want the posts to be created in order
  // This way we can sort them by `createdAt` or `publishedAt` and they will be in the expected order
  const post1Doc = await payload.create({
    collection: 'posts',
    depth: 0,
    context: {
      disableRevalidate: true,
    },
    data: post1({ heroImage: image1Doc, blockImage: image2Doc, author: demoAuthor }),
  })

  const post2Doc = await payload.create({
    collection: 'posts',
    depth: 0,
    context: {
      disableRevalidate: true,
    },
    data: post2({ heroImage: image2Doc, blockImage: image3Doc, author: demoAuthor }),
  })

  const post3Doc = await payload.create({
    collection: 'posts',
    depth: 0,
    context: {
      disableRevalidate: true,
    },
    data: post3({ heroImage: image3Doc, blockImage: image1Doc, author: demoAuthor }),
  })

  // update each post with related posts
  await payload.update({
    id: post1Doc.id,
    collection: 'posts',
    data: {
      relatedPosts: [post2Doc.id, post3Doc.id],
    },
  })
  await payload.update({
    id: post2Doc.id,
    collection: 'posts',
    data: {
      relatedPosts: [post1Doc.id, post3Doc.id],
    },
  })
  await payload.update({
    id: post3Doc.id,
    collection: 'posts',
    data: {
      relatedPosts: [post1Doc.id, post2Doc.id],
    },
  })

  payload.logger.info(`— Seeding contact form...`)

  const contactForm = await payload.create({
    collection: 'forms',
    depth: 0,
    data: contactFormData,
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

  await Promise.all([
    payload.updateGlobal({
      slug: 'header',
      data: {
        navItems: [
          {
            link: {
              type: 'custom',
              label: 'Posts',
              url: '/posts',
            },
          },
          {
            link: {
              type: 'reference',
              label: 'Contact',
              reference: {
                relationTo: 'pages',
                value: contactPage.id,
              },
            },
          },
        ],
      },
    }),
    payload.updateGlobal({
      slug: 'footer',
      data: {
        navItems: [
          {
            link: {
              type: 'custom',
              label: 'Admin',
              url: '/admin',
            },
          },
          {
            link: {
              type: 'custom',
              label: 'Login',
              newTab: true,
              url: 'login/',
            },
          },
        ],
      },
    }),
  ])

  // Seed plastic surgery clinics and doctors
  payload.logger.info(`— Seeding plastic surgery clinics...`)

  // Create clinic images
  const clinicImages = await Promise.all(
    plasticSurgeryClinics.map((clinic) => fetchFileByURL(clinic.imageUrl)),
  )

  // Create doctor images
  const doctorImages = await Promise.all(
    plasticSurgeons.map((doctor) => fetchFileByURL(doctor.imageUrl)),
  )

  // Create clinics and store in object to reference them by name later
  const createdClinics = {}

  for (let i = 0; i < plasticSurgeryClinics.length; i++) {
    const clinic = plasticSurgeryClinics[i]

    // Create clinic image document
    const clinicImageDoc = await payload.create({
      collection: 'media',
      data: {
        alt: `${clinic.name} building`,
      },
      file: clinicImages[i],
    })

    // Create the clinic
    const createdClinic = await payload.create({
      collection: 'clinics',
      data: {
        name: clinic.name,
        foundingYear: clinic.foundingYear,
        country: clinic.country,
        city: clinic.city,
        street: clinic.street,
        zipCode: clinic.zipCode,
        contact: clinic.contact,
        thumbnail: clinicImageDoc.id,
        active: clinic.active,
        slug: `clinic-${i + 1}`,
      },
    })

    // Store by name for easy reference when creating doctors
    createdClinics[clinic.name] = createdClinic.id
  }

  payload.logger.info(`— Seeding plastic surgeons...`)

  // Create doctors with references to their clinics
  for (let i = 0; i < plasticSurgeons.length; i++) {
    const doctor = plasticSurgeons[i]

    // Create doctor image document
    const doctorImageDoc = await payload.create({
      collection: 'media',
      data: {
        alt: `${doctor.fullName} headshot`,
      },
      file: doctorImages[i],
    })

    // Create the doctor with reference to clinic
    await payload.create({
      collection: 'doctors',
      data: {
        fullName: doctor.fullName,
        title: doctor.title,
        clinic: createdClinics[doctor.clinicName],
        specialization: doctor.specialization,
        contact: doctor.contact,
        image: doctorImageDoc.id,
        biography: doctor.biography,
        active: doctor.active,
      },
    })
  }

  // Update clinics with assigned doctors (this would happen after doctors are created)
  for (const doctor of plasticSurgeons) {
    const createdDoctor = await payload.find({
      collection: 'doctors',
      where: {
        fullName: { equals: doctor.fullName },
      },
    })

    if (createdDoctor.docs && createdDoctor.docs.length > 0) {
      const clinicId = createdClinics[doctor.clinicName]
      const clinic = await payload.findByID({
        collection: 'clinics',
        id: clinicId,
      })

      let assignedDoctors = clinic.assignedDoctors || []
      assignedDoctors = [...assignedDoctors, createdDoctor.docs[0].id]

      await payload.update({
        collection: 'clinics',
        id: clinicId,
        data: {
          assignedDoctors,
        },
      })
    }
  }

  payload.logger.info('Seeded database successfully!')
}

async function fetchFileByURL(url: string): Promise<File> {
  const res = await fetch(url, {
    credentials: 'include',
    method: 'GET',
  })

  if (!res.ok) {
    throw new Error(`Failed to fetch file from ${url}, status: ${res.status}`)
  }

  const data = await res.arrayBuffer()

  return {
    name: url.split('/').pop() || `file-${Date.now()}`,
    data: Buffer.from(data),
    mimetype: `image/${url.split('.').pop()}`,
    size: data.byteLength,
  }
}
