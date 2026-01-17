import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { testSlug } from '../fixtures/testSlug'
import type { BasicUser } from '@/payload-types'

describe('ClinicApplications validation and access', () => {
  let payload: Payload
  const slugPrefix = testSlug('clinicApplications.validation.test.ts')
  const createdBasicUserIds: Array<number | string> = []

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
  })

  afterEach(async () => {
    while (createdBasicUserIds.length) {
      const id = createdBasicUserIds.pop()
      if (!id) continue
      await payload.delete({ collection: 'basicUsers', id, overrideAccess: true })
    }

    const { docs } = await payload.find({
      collection: 'clinicApplications',
      where: { clinicName: { like: `${slugPrefix}%` } },
      limit: 100,
      overrideAccess: true,
    })
    for (const doc of docs) {
      await payload.delete({ collection: 'clinicApplications', id: doc.id, overrideAccess: true })
    }
  })

  it('allows public creation and enforces required fields', async () => {
    await expect(
      payload.create({
        collection: 'clinicApplications',
        data: { clinicName: `${slugPrefix}-invalid` },
        overrideAccess: false,
      }),
    ).rejects.toThrow()

    const app = await payload.create({
      collection: 'clinicApplications',
      data: {
        clinicName: `${slugPrefix}-clinic`,
        contactFirstName: 'Public',
        contactLastName: 'Applicant',
        contactEmail: `${slugPrefix}@example.com`,
        address: {
          street: 'Main',
          houseNumber: '1',
          zipCode: 34000,
          city: 'Istanbul',
          country: 'Turkey',
        },
      },
      overrideAccess: false,
    })

    expect(app.status).toBe('submitted')
  })

  it('blocks non-platform read access', async () => {
    const app = await payload.create({
      collection: 'clinicApplications',
      data: {
        clinicName: `${slugPrefix}-access`,
        contactFirstName: 'Access',
        contactLastName: 'Tester',
        contactEmail: `${slugPrefix}-access@example.com`,
        address: {
          street: 'Main',
          houseNumber: '2',
          zipCode: 34000,
          city: 'Istanbul',
          country: 'Turkey',
        },
      },
      overrideAccess: false,
    })

    await expect(
      payload.findByID({
        collection: 'clinicApplications',
        id: app.id,
        overrideAccess: false,
      }),
    ).rejects.toThrow()
  })

  it('allows platform staff to update review notes and linked records', async () => {
    const app = await payload.create({
      collection: 'clinicApplications',
      data: {
        clinicName: `${slugPrefix}-review`,
        contactFirstName: 'Review',
        contactLastName: 'Notes',
        contactEmail: `${slugPrefix}-review@example.com`,
        address: {
          street: 'Main',
          houseNumber: '3',
          zipCode: 34000,
          city: 'Istanbul',
          country: 'Turkey',
        },
      },
      overrideAccess: false,
    })

    const basicUser = (await payload.create({
      collection: 'basicUsers',
      data: {
        email: `${slugPrefix}-platform@example.com`,
        userType: 'platform',
        firstName: 'Platform',
        lastName: 'Reviewer',
        supabaseUserId: `sb-${slugPrefix}-reviewer`,
      },
      overrideAccess: true,
    })) as BasicUser
    createdBasicUserIds.push(basicUser.id)

    const updated = await payload.update({
      collection: 'clinicApplications',
      id: app.id,
      data: {
        status: 'approved',
        reviewNotes: 'Approved for onboarding.',
        linkedRecords: {
          processedAt: new Date().toISOString(),
        },
      },
      overrideAccess: false,
      user: { ...basicUser, collection: 'basicUsers' },
    })

    expect(updated.status).toBe('approved')
    expect(updated.reviewNotes).toBe('Approved for onboarding.')
    expect(updated.linkedRecords?.processedAt).toBeTruthy()
  })
})
