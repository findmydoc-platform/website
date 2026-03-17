import { describe, expect, it, beforeAll, afterEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'

import { ensureBaseline } from '../../fixtures/ensureBaseline'
import { cleanupTestEntities } from '../../fixtures/cleanupTestEntities'
import { cleanupTrackedUsers } from '../../fixtures/testUsers'
import { createClinicTestUser, createPatientTestUser, createPlatformTestUser, asPayloadBasicUser, asPayloadPatientUser } from '../../fixtures/testUsers'
import { testSlug } from '../../fixtures/testSlug'
import { buildRichText } from '../../fixtures/richText'
import { slugify } from '@/utilities/slugify'
import type { ContentBlock } from '@/payload-types'

const buildPageLayout = (): ContentBlock[] => [
  {
    blockType: 'content',
    columns: [],
  },
]

const buildPostData = (opts: { title: string; status: 'draft' | 'published' }) => ({
  title: opts.title,
  excerpt: 'Integration access test excerpt',
  content: buildRichText('Access control tests for posts.'),
  _status: opts.status,
  slug: slugify(opts.title),
})

describe('Posts & Pages integration access', () => {
  let payload: Payload
  const slugPrefix = testSlug('pages-posts-access.test.ts')
  const createdBasicUserIds: Array<number | string> = []
  const createdPatientIds: Array<number | string> = []

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
  })

  afterEach(async () => {
    await cleanupTestEntities(payload, 'posts', slugPrefix)
    await cleanupTestEntities(payload, 'pages', slugPrefix)
    await cleanupTrackedUsers(payload, { basicUserIds: createdBasicUserIds, patientIds: createdPatientIds })
  })

  it('enforces draft visibility and platform-only mutations for posts', async () => {
    const draftSlug = slugify(`${slugPrefix}-draft-post`)
    const publishedSlug = slugify(`${slugPrefix}-published-post`)

    await payload.create({
      collection: 'posts',
      data: {
        ...buildPostData({ title: `${slugPrefix}-draft-post`, status: 'draft' }),
        slug: draftSlug,
      },
      overrideAccess: true,
      draft: true,
    })

    const publishedPost = await payload.create({
      collection: 'posts',
      data: {
        ...buildPostData({ title: `${slugPrefix}-published-post`, status: 'published' }),
        slug: publishedSlug,
      },
      overrideAccess: true,
    })

    const publicRead = await payload.find({
      collection: 'posts',
      where: { slug: { in: [draftSlug, publishedSlug] } },
      overrideAccess: false,
    })

    expect(publicRead.docs).toHaveLength(1)
    expect(publicRead.docs[0]?._status).toBe('published')

    const platformUser = await createPlatformTestUser(payload, {
      emailPrefix: `${slugPrefix}-platform-posts`,
      createdBasicUserIds,
    })
    const platformRead = await payload.find({
      collection: 'posts',
      where: { slug: { in: [draftSlug, publishedSlug] } },
      user: asPayloadBasicUser(platformUser),
      overrideAccess: false,
    })

    expect(platformRead.docs.length).toBeGreaterThanOrEqual(2)

    const platformPost = await payload.create({
      collection: 'posts',
      data: buildPostData({ title: `${slugPrefix}-platform-write`, status: 'draft' }),
      user: asPayloadBasicUser(platformUser),
      overrideAccess: false,
      draft: true,
    })

    const updated = await payload.update({
      collection: 'posts',
      id: platformPost.id,
      data: { _status: 'published', title: `${slugPrefix}-platform-write-updated` },
      user: asPayloadBasicUser(platformUser),
      overrideAccess: false,
    })

    expect(updated._status).toBe('published')

    await payload.delete({
      collection: 'posts',
      id: platformPost.id,
      user: asPayloadBasicUser(platformUser),
      overrideAccess: false,
    })

    const clinicUser = await createClinicTestUser(payload, {
      emailPrefix: `${slugPrefix}-clinic-posts`,
      createdBasicUserIds,
    })

    const clinicRead = await payload.find({
      collection: 'posts',
      where: { slug: { in: [draftSlug, publishedSlug] } },
      user: asPayloadBasicUser(clinicUser),
      overrideAccess: false,
    })

    expect(clinicRead.docs).toHaveLength(1)
    expect(clinicRead.docs[0]?._status).toBe('published')

    await expect(
      payload.create({
        collection: 'posts',
        data: buildPostData({ title: `${slugPrefix}-clinic-fail`, status: 'draft' }),
        user: asPayloadBasicUser(clinicUser),
        overrideAccess: false,
        draft: true,
      }),
    ).rejects.toThrow()

    const patientUser = await createPatientTestUser(payload, {
      emailPrefix: `${slugPrefix}-patient-posts`,
      createdPatientIds,
    })

    const patientRead = await payload.find({
      collection: 'posts',
      where: { slug: { in: [draftSlug, publishedSlug] } },
      user: asPayloadPatientUser(patientUser),
      overrideAccess: false,
    })

    expect(patientRead.docs).toHaveLength(1)
    expect(patientRead.docs[0]?._status).toBe('published')

    await expect(
      payload.update({
        collection: 'posts',
        id: publishedPost.id,
        data: { title: 'Attempted Update' },
        user: asPayloadPatientUser(patientUser),
        overrideAccess: false,
      }),
    ).rejects.toThrow()

    await expect(
      payload.delete({
        collection: 'posts',
        id: publishedPost.id,
        user: asPayloadBasicUser(clinicUser),
        overrideAccess: false,
      }),
    ).rejects.toThrow()
  })

  it('enforces draft visibility and platform-only mutations for pages', async () => {
    const draftSlug = slugify(`${slugPrefix}-draft-page`)
    const publishedSlug = slugify(`${slugPrefix}-published-page`)

    await payload.create({
      collection: 'pages',
      data: {
        title: `${slugPrefix}-draft-page`,
        layout: buildPageLayout(),
        _status: 'draft',
        slug: draftSlug,
      },
      draft: true,
      overrideAccess: true,
    })

    const publishedPage = await payload.create({
      collection: 'pages',
      data: {
        title: `${slugPrefix}-published-page`,
        layout: buildPageLayout(),
        _status: 'published',
        slug: publishedSlug,
      },
      overrideAccess: true,
    })

    const publicRead = await payload.find({
      collection: 'pages',
      where: { slug: { in: [draftSlug, publishedSlug] } },
      overrideAccess: false,
    })

    expect(publicRead.docs).toHaveLength(1)
    expect(publicRead.docs[0]?._status).toBe('published')

    const platformUser = await createPlatformTestUser(payload, {
      emailPrefix: `${slugPrefix}-platform-pages`,
      createdBasicUserIds,
    })

    const platformRead = await payload.find({
      collection: 'pages',
      where: { slug: { in: [draftSlug, publishedSlug] } },
      user: asPayloadBasicUser(platformUser),
      overrideAccess: false,
    })

    expect(platformRead.docs.length).toBeGreaterThanOrEqual(2)

    const platformPage = await payload.create({
      collection: 'pages',
      data: {
        title: `${slugPrefix}-platform-page`,
        layout: buildPageLayout(),
        _status: 'draft',
        slug: slugify(`${slugPrefix}-platform-page`),
      },
      draft: true,
      user: asPayloadBasicUser(platformUser),
      overrideAccess: false,
    })

    const updated = await payload.update({
      collection: 'pages',
      id: platformPage.id,
      data: { _status: 'published' },
      user: asPayloadBasicUser(platformUser),
      overrideAccess: false,
    })

    expect(updated._status).toBe('published')

    await payload.delete({
      collection: 'pages',
      id: platformPage.id,
      user: asPayloadBasicUser(platformUser),
      overrideAccess: false,
    })

    const clinicUser = await createClinicTestUser(payload, {
      emailPrefix: `${slugPrefix}-clinic-pages`,
      createdBasicUserIds,
    })

    const clinicRead = await payload.find({
      collection: 'pages',
      where: { slug: { in: [draftSlug, publishedSlug] } },
      user: asPayloadBasicUser(clinicUser),
      overrideAccess: false,
    })

    expect(clinicRead.docs).toHaveLength(1)
    expect(clinicRead.docs[0]?._status).toBe('published')

    await expect(
      payload.create({
        collection: 'pages',
        data: {
          title: `${slugPrefix}-clinic-page`,
          layout: buildPageLayout(),
          _status: 'draft',
        },
        draft: true,
        user: asPayloadBasicUser(clinicUser),
        overrideAccess: false,
      }),
    ).rejects.toThrow()

    const patientUser = await createPatientTestUser(payload, {
      emailPrefix: `${slugPrefix}-patient-pages`,
      createdPatientIds,
    })

    const patientRead = await payload.find({
      collection: 'pages',
      where: { slug: { in: [draftSlug, publishedSlug] } },
      user: asPayloadPatientUser(patientUser),
      overrideAccess: false,
    })

    expect(patientRead.docs).toHaveLength(1)
    expect(patientRead.docs[0]?._status).toBe('published')

    await expect(
      payload.update({
        collection: 'pages',
        id: publishedPage.id,
        data: { title: 'Patient Attempt' },
        user: asPayloadPatientUser(patientUser),
        overrideAccess: false,
      }),
    ).rejects.toThrow()

    await expect(
      payload.delete({
        collection: 'pages',
        id: publishedPage.id,
        user: asPayloadBasicUser(clinicUser),
        overrideAccess: false,
      }),
    ).rejects.toThrow()
  })
})
