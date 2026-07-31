import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createLocalReq, getPayload, type Payload, type PayloadRequest } from 'payload'
import { revalidatePath, revalidateTag } from 'next/cache'

import config from '@payload-config'
import type { Clinic } from '@/payload-types'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { testSlug } from '../fixtures/testSlug'
import {
  ClinicProfileServiceError,
  createClinicProfileDraft,
  discardClinicProfileDraft,
  publishClinicProfileDraft,
  readClinicProfileSnapshot,
  saveClinicProfileDraft,
} from '@/features/clinicDashboard/profile/service'

vi.mock('@payloadcms/storage-s3', () => ({
  s3Storage: () => (incomingConfig: unknown) => incomingConfig,
}))

const openingHours = {
  monday: { isClosed: false, opensAt: '09:00', closesAt: '17:00' },
  tuesday: { isClosed: false, opensAt: '09:00', closesAt: '17:00' },
  wednesday: { isClosed: false, opensAt: '09:00', closesAt: '17:00' },
  thursday: { isClosed: false, opensAt: '09:00', closesAt: '17:00' },
  friday: { isClosed: false, opensAt: '09:00', closesAt: '17:00' },
  saturday: { isClosed: true, opensAt: '', closesAt: '' },
  sunday: { isClosed: true, opensAt: '', closesAt: '' },
} as const

const structuredDescription = {
  root: {
    type: 'root',
    children: [
      {
        type: 'paragraph',
        version: 1,
        children: [
          { type: 'text', text: 'Structured ' },
          {
            type: 'link',
            fields: { url: 'https://example.com' },
            children: [{ type: 'text', text: 'description' }],
          },
        ],
      },
    ],
    direction: 'ltr' as const,
    format: '' as const,
    indent: 0,
    version: 1,
  },
}

describe('clinic profile draft lifecycle', () => {
  let payload: Payload
  let req: PayloadRequest
  let clinic: Clinic
  let cityId: number
  let countryId: number
  const slug = `${testSlug('clinicProfileDrafts.lifecycle.test.ts')}-clinic`

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)

    const countryResult = await payload.find({
      collection: 'countries',
      depth: 0,
      limit: 1,
      overrideAccess: true,
      where: { isoCode: { equals: 'TR' } },
    })
    const country = countryResult.docs[0]
    if (!country) throw new Error('Expected Türkiye baseline country')
    countryId = country.id

    const cityResult = await payload.find({
      collection: 'cities',
      depth: 0,
      limit: 1,
      overrideAccess: true,
      where: { country: { equals: countryId } },
    })
    const city = cityResult.docs[0]
    if (!city) throw new Error('Expected Türkiye baseline city')
    cityId = city.id

    clinic = await payload.create({
      collection: 'clinics',
      data: {
        name: 'Published clinic',
        description: structuredDescription,
        coordinates: [29.1, 41.1],
        address: {
          country: countryId,
          city: cityId,
          street: 'Published street',
          houseNumber: '5',
          zipCode: '00123',
        },
        contact: {
          email: 'profile-draft@example.com',
          phoneNumber: '+905550000000',
        },
        internalPrimaryContact: {
          firstName: 'Profile',
          lastName: 'Owner',
          email: 'profile-owner@example.com',
          role: 'Clinic Management',
        },
        supportedLanguages: ['english'],
        openingHours,
        status: 'approved',
        slug,
      },
      depth: 0,
      overrideAccess: true,
    })
    req = await createLocalReq({}, payload)
  })

  afterAll(async () => {
    if (!payload || !clinic) return
    await payload.delete({
      collection: 'clinicProfileDrafts',
      overrideAccess: true,
      where: { clinic: { equals: clinic.id } },
    })
    await payload.delete({ collection: 'clinics', id: clinic.id, overrideAccess: true })
  })

  it('saves, conflicts, discards, and atomically publishes only the owned fields', async () => {
    const initial = await readClinicProfileSnapshot(req, clinic.id)
    expect(initial.published.revision).toBe(0)
    expect(initial.draft).toBeUndefined()

    vi.clearAllMocks()
    const created = await createClinicProfileDraft(req, clinic.id, {
      expectedPublishedRevision: 0,
    })
    expect(created.draft).toMatchObject({
      address: {
        city: { id: String(cityId) },
        country: { code: 'TR', name: 'Türkiye' },
        houseNumber: '5',
        street: 'Published street',
        zipCode: '00123',
      },
      basePublishedRevision: 0,
      descriptionText: 'Structured description',
      name: 'Published clinic',
      openingHours,
      revision: 1,
      supportedLanguages: ['english'],
    })
    expect(revalidatePath).not.toHaveBeenCalled()
    expect(revalidateTag).not.toHaveBeenCalled()

    const storedFirstDraft = await payload.find({
      collection: 'clinicProfileDrafts',
      depth: 0,
      limit: 1,
      overrideAccess: true,
      where: { clinic: { equals: clinic.id } },
    })
    expect(storedFirstDraft.docs[0]?.description).toEqual(clinic.description)
    expect(storedFirstDraft.docs[0]).not.toHaveProperty('coordinates')

    await expect(
      createClinicProfileDraft(req, clinic.id, {
        expectedPublishedRevision: 0,
      }),
    ).rejects.toMatchObject({ kind: 'conflict' } satisfies Partial<ClinicProfileServiceError>)

    await expect(
      payload.create({
        collection: 'clinicProfileDrafts',
        data: {
          clinic: clinic.id,
          basePublishedRevision: 0,
          revision: 1,
          address: { country: countryId },
        },
        overrideAccess: true,
      }),
    ).rejects.toThrow()

    vi.clearAllMocks()
    const afterIncompleteSave = await saveClinicProfileDraft(req, clinic.id, {
      draft: {
        address: { houseNumber: '', street: '', zipCode: '' },
        descriptionText: '',
        name: '',
        supportedLanguages: [],
      },
      expectedDraftRevision: 1,
      expectedPublishedRevision: 0,
    })
    expect(afterIncompleteSave.draft?.revision).toBe(2)

    await expect(
      saveClinicProfileDraft(req, clinic.id, {
        draft: {
          address: { houseNumber: '', street: '', zipCode: '' },
          descriptionText: '',
          name: '',
          supportedLanguages: [],
        },
        expectedDraftRevision: 1,
        expectedPublishedRevision: 0,
      }),
    ).rejects.toMatchObject({ kind: 'conflict' } satisfies Partial<ClinicProfileServiceError>)

    const discarded = await discardClinicProfileDraft(req, clinic.id, {
      expectedDraftRevision: 2,
    })
    expect(discarded.draft).toBeUndefined()
    expect(discarded.published.revision).toBe(0)
    expect(revalidatePath).not.toHaveBeenCalled()
    expect(revalidateTag).not.toHaveBeenCalled()

    const unchangedPublished = await payload.findByID({
      collection: 'clinics',
      id: clinic.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(unchangedPublished).toMatchObject({
      name: 'Published clinic',
      profileRevision: 0,
    })
    expect(unchangedPublished.coordinates).toEqual([29.1, 41.1])

    await expect(
      saveClinicProfileDraft(req, clinic.id, {
        draft: {
          address: { houseNumber: '', street: '', zipCode: '' },
          descriptionText: '',
          name: '',
          supportedLanguages: [],
        },
        expectedDraftRevision: 2,
        expectedPublishedRevision: 0,
      }),
    ).rejects.toMatchObject({ kind: 'not-found' } satisfies Partial<ClinicProfileServiceError>)

    const changedPublished = await payload.update({
      collection: 'clinics',
      id: clinic.id,
      data: { name: 'Concurrent published name' },
      depth: 0,
      overrideAccess: true,
    })
    expect(changedPublished.profileRevision).toBe(1)

    await expect(
      createClinicProfileDraft(req, clinic.id, {
        expectedPublishedRevision: 0,
      }),
    ).rejects.toMatchObject({ kind: 'conflict' } satisfies Partial<ClinicProfileServiceError>)

    const recreated = await createClinicProfileDraft(req, clinic.id, {
      expectedPublishedRevision: 1,
    })
    expect(recreated.draft?.revision).toBe(1)
    expect(recreated.draft?.name).toBe('Concurrent published name')

    const invalidPostalCodeDraft = await saveClinicProfileDraft(req, clinic.id, {
      draft: {
        address: {
          cityId: String(cityId),
          houseNumber: '8A',
          street: 'Draft street',
          zipCode: '@@@',
        },
        descriptionText: 'First paragraph\n\nSecond paragraph',
        name: 'Published from draft',
        openingHours,
        supportedLanguages: ['english', 'turkish'],
      },
      expectedDraftRevision: 1,
      expectedPublishedRevision: 1,
    })
    expect(invalidPostalCodeDraft.draft?.revision).toBe(2)

    await expect(
      publishClinicProfileDraft(req, clinic.id, {
        expectedDraftRevision: 2,
        expectedPublishedRevision: 1,
      }),
    ).rejects.toMatchObject({ kind: 'invalid-input' } satisfies Partial<ClinicProfileServiceError>)

    await saveClinicProfileDraft(req, clinic.id, {
      draft: {
        address: {
          cityId: String(cityId),
          houseNumber: '8A',
          street: 'Draft street',
          zipCode: '00999',
        },
        descriptionText: 'First paragraph\n\nSecond paragraph',
        name: 'Published from draft',
        openingHours,
        supportedLanguages: ['english', 'turkish'],
      },
      expectedDraftRevision: 2,
      expectedPublishedRevision: 1,
    })

    await expect(
      publishClinicProfileDraft(req, clinic.id, {
        expectedDraftRevision: 3,
        expectedPublishedRevision: 0,
      }),
    ).rejects.toMatchObject({ kind: 'conflict' } satisfies Partial<ClinicProfileServiceError>)

    vi.clearAllMocks()
    const published = await publishClinicProfileDraft(req, clinic.id, {
      expectedDraftRevision: 3,
      expectedPublishedRevision: 1,
    })

    expect(published.draft).toBeUndefined()
    expect(published.published).toMatchObject({
      descriptionText: 'First paragraph\n\nSecond paragraph',
      name: 'Published from draft',
      revision: 2,
      supportedLanguages: ['english', 'turkish'],
    })
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith(`/clinics/${slug}`)
    expect(vi.mocked(revalidateTag)).toHaveBeenCalledWith('collection:clinics', { expire: 0 })

    const persisted = await payload.findByID({
      collection: 'clinics',
      id: clinic.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(persisted.coordinates).toEqual([29.1, 41.1])
    expect(persisted.contact).toMatchObject({
      email: 'profile-draft@example.com',
      phoneNumber: '+905550000000',
    })
    expect(persisted.description?.root.children).toHaveLength(2)

    const remainingDrafts = await payload.find({
      collection: 'clinicProfileDrafts',
      depth: 0,
      limit: 1,
      overrideAccess: true,
      where: { clinic: { equals: clinic.id } },
    })
    expect(remainingDrafts.docs).toHaveLength(0)
  })
})
