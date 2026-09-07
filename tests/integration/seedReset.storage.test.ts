import { loadSeedFile, loadSeedGlobals } from '@/endpoints/seed/utils/load-json'
import { prepareLandingPagesSeedData } from '@/endpoints/seed/utils/landing-pages'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { posix } from 'node:path'
import sharp from 'sharp'
import {
  commitTransaction,
  createLocalReq,
  getPayload,
  initTransaction,
  type Payload,
  type RequiredDataFromCollectionSlug,
} from 'payload'

import config from '@payload-config'
import { resetCollections } from '@/endpoints/seed/utils/reset'
import * as resetModule from '@/endpoints/seed/utils/reset'
import {
  addClinicInquiryNote,
  createAttachmentDraft,
  createVerifiedPatientInquiry,
  finalizeAttachmentDraft,
  sendClinicInquiryMessage,
} from '@/features/inquiryCommunication/service'
import { createS3InquiryAttachmentStorage } from '@/features/inquiryCommunication/storage'
import { createInquiryModerationReport } from '@/features/inquiryModeration/service'
import { placeInquiryLegalHold } from '@/features/inquiryRetention/service'
import { resolveS3StorageConfig } from '@/plugins/storageConfig'
import { runDemoSeeds } from '@/endpoints/seed/demo'
import { runBaselineSeeds } from '@/endpoints/seed/baseline'
import * as provisioning from '@/auth/utilities/supabaseProvision'
import { createTinyPngFile } from '../fixtures/mediaFile'
import { createClinicFixture } from '../fixtures/createClinicFixture'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import {
  asClinicScopedPayloadUser,
  asPayloadPatientUser,
  createClinicTestUser,
  createPatientTestUser,
  createPlatformTestUser,
} from '../fixtures/testUsers'

describe('complete seed reset with PostgreSQL and test storage', () => {
  let payload: Payload

  beforeAll(async () => {
    if (process.env.DEPLOYMENT_ENV !== 'test') throw new Error('Seed reset tests require the isolated test runtime.')
    const target = new URL(process.env.DATABASE_URI!)
    if (!['localhost', '127.0.0.1'].includes(target.hostname) || !target.pathname.startsWith('/findmydoc-test')) {
      throw new Error('Seed reset tests require a local test database.')
    }
    payload = await getPayload({ config })
    await ensureBaseline(payload)
  }, 120_000)

  it('removes complete demo aggregates and files, preserves accounts, and supports reseeding', async () => {
    const city = (await payload.find({ collection: 'cities', limit: 1, overrideAccess: true })).docs[0]!
    const { clinic, doctor } = await createClinicFixture(payload, city.id, { slugPrefix: 'seed-reset' })
    const patient = await createPatientTestUser(payload, { emailPrefix: 'seed-reset-patient' })
    const req = await createLocalReq({ user: asPayloadPatientUser(patient) }, payload)
    const created = await createVerifiedPatientInquiry(req, {
      clinicId: String(clinic.id),
      doctorId: String(doctor.id),
      consent: true,
      idempotencyKey: 'seed-reset-inquiry',
      message: 'Synthetic reset inquiry',
      phoneNumber: '+493000000001',
    })

    const clinicStaff = await createClinicTestUser(payload, { emailPrefix: 'seed-reset-clinic' })
    const clinicUser = await asClinicScopedPayloadUser(payload, clinicStaff, clinic.id)
    const clinicReq = await createLocalReq({ user: clinicUser }, payload)
    const operator = await createPlatformTestUser(payload, { emailPrefix: 'seed-reset-operator' })
    const moderator = await payload.update({
      collection: 'platformStaff',
      id: operator.id,
      data: { capabilities: ['conversation-moderation', 'inquiry-retention'] },
      context: { trustedPlatformStaffOps: true },
      overrideAccess: true,
    })
    const operatorReq = await createLocalReq({ user: { ...moderator, collection: 'platformStaff' } }, payload)
    const storage = createS3InquiryAttachmentStorage()
    const file = createTinyPngFile('seed-reset-attachment.png')
    const draft = await createAttachmentDraft(
      clinicReq,
      {
        inquiryId: created.inquiry.id,
        fileName: file.name,
        mimeType: 'image/png',
        sizeBytes: file.size,
      },
      storage,
    )
    expect(
      (await fetch(draft.upload.url, { method: 'PUT', headers: draft.upload.headers, body: new Uint8Array(file.data) }))
        .ok,
    ).toBe(true)
    await finalizeAttachmentDraft(clinicReq, { inquiryId: created.inquiry.id, draftId: draft.draftId }, storage)
    const sent = await sendClinicInquiryMessage(
      clinicReq,
      {
        inquiryId: created.inquiry.id,
        expectedRevision: created.inquiry.revision,
        idempotencyKey: 'seed-reset-message',
        text: 'Synthetic clinic reply',
        attachmentDraftId: draft.draftId,
      },
      storage,
    )
    await addClinicInquiryNote(clinicReq, {
      inquiryId: created.inquiry.id,
      idempotencyKey: 'seed-reset-note',
      text: 'Synthetic internal note',
    })
    const message = sent.inquiry.timeline.find((item) => item.kind === 'external-message')!
    const report = await createInquiryModerationReport(req, {
      inquiryId: created.inquiry.id,
      idempotencyKey: 'seed-reset-report',
      category: 'privacy-concern',
      description: 'Synthetic report',
      targetType: 'message',
      targetId: message.id,
    })
    await placeInquiryLegalHold(operatorReq, {
      targetType: 'moderation-case',
      targetId: report.reportId,
      reasonCategory: 'regulatory-review',
      responsibleFunction: 'data-protection',
      reviewAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    })
    await payload.create({
      collection: 'inquiryDeletionProofs',
      overrideAccess: true,
      context: { inquiryRetentionCommand: true },
      data: {
        inquiryId: created.inquiry.id,
        tombstoneKey: 'seed-reset-proof',
        operation: 'hard-deleted',
        reasonCategory: 'authorized-erasure',
        performedBy: operator.id,
        performedAt: new Date().toISOString(),
        policyVersion: '2026-08-24',
        deletedObjectCount: 0,
      },
    })

    const attachment = await payload.findByID({
      collection: 'inquiryAttachments',
      id: draft.draftId,
      overrideAccess: true,
      showHiddenFields: true,
      depth: 0,
    })
    const pendingDraft = await createAttachmentDraft(
      clinicReq,
      {
        inquiryId: created.inquiry.id,
        fileName: 'seed-reset-pending.png',
        mimeType: 'image/png',
        sizeBytes: file.size,
      },
      storage,
    )
    expect(
      (
        await fetch(pendingDraft.upload.url, {
          method: 'PUT',
          headers: pendingDraft.upload.headers,
          body: new Uint8Array(file.data),
        })
      ).ok,
    ).toBe(true)
    const pendingAttachment = await payload.findByID({
      collection: 'inquiryAttachments',
      id: pendingDraft.draftId,
      overrideAccess: true,
      showHiddenFields: true,
      depth: 0,
    })
    // Upload hooks populate required storage paths and gallery storage keys.
    const gallery = await payload.create({
      collection: 'clinicGalleryMedia',
      overrideAccess: true,
      user: clinicUser,
      file: createTinyPngFile('seed-reset-gallery.png'),
      data: {
        clinic: clinic.id,
        alt: 'Reset gallery',
        status: 'draft',
      } as RequiredDataFromCollectionSlug<'clinicGalleryMedia'>,
    })
    const entry = await payload.create({
      collection: 'clinicGalleryEntries',
      overrideAccess: true,
      user: clinicUser,
      data: {
        clinic: clinic.id,
        title: 'Reset story',
        beforeMedia: gallery.id,
        afterMedia: gallery.id,
        status: 'draft',
      },
    })
    await payload.update({
      collection: 'clinicGalleryEntries',
      id: entry.id,
      data: { deletedAt: new Date().toISOString() },
      overrideAccess: true,
    })
    const image = await payload.create({
      collection: 'clinicMedia',
      overrideAccess: true,
      user: clinicUser,
      file: createTinyPngFile('seed-reset-clinic.png'),
      data: {
        clinic: clinic.id,
        status: 'published',
        alt: 'Reset clinic',
      } as RequiredDataFromCollectionSlug<'clinicMedia'>,
    })
    await payload.update({
      collection: 'clinics',
      id: clinic.id,
      data: { thumbnail: image.id, profileGallery: [image.id] },
      overrideAccess: true,
    })
    const doctorImage = await payload.create({
      collection: 'doctorMedia',
      overrideAccess: true,
      user: clinicUser,
      file: createTinyPngFile('seed-reset-doctor.png'),
      data: {
        doctor: doctor.id,
        clinic: clinic.id,
        alt: 'Reset doctor',
      } as RequiredDataFromCollectionSlug<'doctorMedia'>,
    })
    await payload.update({
      collection: 'doctors',
      id: doctor.id,
      data: { profileImage: doctorImage.id },
      overrideAccess: true,
    })
    const specialty = (await payload.find({ collection: 'medical-specialties', limit: 1, overrideAccess: true }))
      .docs[0]!
    await payload.create({
      collection: 'clinicApplications',
      overrideAccess: true,
      data: {
        status: 'submitted',
        clinicName: 'Reset application',
        contactLastName: 'Tester',
        contactEmail: 'reset-application@example.com',
        contactRole: 'Clinic Management',
        clinicWebsite: 'https://example.com',
        medicalSpecialties: [specialty.id],
        linkedRecords: { clinic: clinic.id, clinicStaff: clinicStaff.id },
      },
    })
    const foreignMedia = await payload.create({
      collection: 'platformContentMedia',
      overrideAccess: true,
      user: operatorReq.user,
      file: createTinyPngFile('seed-reset-preserved.png'),
      data: { alt: 'Preserved non-seed media' } as RequiredDataFromCollectionSlug<'platformContentMedia'>,
    })
    await payload.update({
      collection: 'patients',
      id: patient.id,
      data: { country: city.country },
      overrideAccess: true,
    })
    const lockReq = await createLocalReq({ context: { inquiryCommandLock: true } }, payload)
    await initTransaction(lockReq)
    const lock = await payload.create({
      collection: 'inquiryCommandLocks',
      data: { key: 'seed-reset-preserved-lock' },
      overrideAccess: true,
      req: lockReq,
    })
    await commitTransaction(lockReq)
    const policies = (
      await payload.find({ collection: 'inquiryRetentionPolicies', pagination: false, overrideAccess: true })
    ).docs
    const accounts = await Promise.all(
      (['platformStaff', 'clinicStaff', 'patients'] as const).map(async (collection) => ({
        collection,
        docs: (await payload.find({ collection, pagination: false, depth: 0, overrideAccess: true })).docs.map(
          ({ id, email, supabaseUserId }) => ({ id, email, supabaseUserId }),
        ),
      })),
    )
    const s3 = resolveS3StorageConfig()
    const objectUrl = (key: string) => new URL(`${s3.bucket}/${key}`, `${s3.clientConfig.endpoint}/`).toString()
    const removedKeys = [
      pendingAttachment.draftObjectKey,
      attachment.readyObjectKey!,
      gallery.storagePath,
      image.storagePath,
      doctorImage.storagePath,
    ]
    for (const key of removedKeys) expect((await fetch(objectUrl(key))).status).toBe(200)
    vi.clearAllMocks()

    await resetCollections(payload, 'demo')

    for (const collection of [
      'inquiryLegalHolds',
      'inquiryDeletionProofs',
      'inquiryModerationEvents',
      'inquiryModerationCases',
      'inquiryAuditEvents',
      'inquiryReadPositions',
      'inquiryInternalNotes',
      'inquiryMessages',
      'inquiryAttachments',
      'inquiryConversations',
      'patientClinicInquiries',
      'clinicApplications',
      'clinicGalleryEntries',
      'clinicGalleryMedia',
      'clinics',
      'doctors',
      'doctorMedia',
      'clinicMedia',
    ] as const) {
      expect((await payload.count({ collection, overrideAccess: true, trash: true })).totalDocs, collection).toBe(0)
    }
    for (const key of removedKeys) expect((await fetch(objectUrl(key))).status).toBe(404)
    expect((await fetch(objectUrl(foreignMedia.storagePath))).status).toBe(200)
    for (const { collection, docs } of accounts) {
      expect(
        (await payload.find({ collection, pagination: false, overrideAccess: true, depth: 0 })).docs.map(
          ({ id, email, supabaseUserId }) => ({ id, email, supabaseUserId }),
        ),
      ).toEqual(docs)
    }
    for (const fn of Object.values(provisioning)) if (vi.isMockFunction(fn)) expect(fn).not.toHaveBeenCalled()
    expect(await payload.findByID({ collection: 'inquiryCommandLocks', id: lock.id, overrideAccess: true })).toEqual(
      lock,
    )
    expect(
      (await payload.find({ collection: 'inquiryRetentionPolicies', pagination: false, overrideAccess: true })).docs,
    ).toEqual(policies)
    expect(
      (await payload.findByID({ collection: 'clinicStaff', id: clinicStaff.id, depth: 0, overrideAccess: true }))
        .clinic,
    ).toBeNull()
    expect((await payload.count({ collection: 'countries', overrideAccess: true })).totalDocs).toBeGreaterThan(0)

    const seeded = await runDemoSeeds(payload)
    expect(seeded.failures).toEqual([])
    expect((await payload.count({ collection: 'clinics', overrideAccess: true })).totalDocs).toBeGreaterThan(0)
    await resetCollections(payload, 'demo')
    for (const collection of ['clinics', 'reviews', 'clinicMedia', 'doctorMedia'] as const) {
      expect((await payload.count({ collection, overrideAccess: true, trash: true })).totalDocs, collection).toBe(0)
    }
  }, 180_000)

  it('resets baseline references while preserving accounts and non-seed media', async () => {
    const country = (await payload.find({ collection: 'countries', limit: 1, overrideAccess: true })).docs[0]!
    const patient = await createPatientTestUser(payload, { emailPrefix: 'seed-reset-baseline-patient' })
    await payload.update({
      collection: 'patients',
      id: patient.id,
      data: { country: country.id },
      overrideAccess: true,
    })
    const operator = await createPlatformTestUser(payload, { emailPrefix: 'seed-reset-baseline-operator' })
    const foreignMedia = await payload.create({
      collection: 'platformContentMedia',
      overrideAccess: true,
      user: { ...operator, collection: 'platformStaff' },
      file: createTinyPngFile('seed-reset-baseline-preserved.png'),
      data: { alt: 'Preserved non-seed media' } as RequiredDataFromCollectionSlug<'platformContentMedia'>,
    })
    const s3 = resolveS3StorageConfig()
    const objectUrl = (key: string) => new URL(`${s3.bucket}/${key}`, `${s3.clientConfig.endpoint}/`).toString()
    const globals = await payload.findGlobal({ slug: 'landingPages', depth: 0, overrideAccess: true })
    const heroId = typeof globals.home.hero.image === 'object' ? globals.home.hero.image.id : globals.home.hero.image
    const originalMedia = await payload.findByID({
      collection: 'platformContentMedia',
      id: heroId,
      overrideAccess: true,
    })
    const originalResponse = await fetch(objectUrl(originalMedia.storagePath))
    expect(originalResponse.status, originalMedia.storagePath).toBe(200)
    const originalBytes = Buffer.from(await originalResponse.arrayBuffer())
    const seedMedia = (await loadSeedFile('baseline', 'platformContentMedia')).find(
      (record) => record.stableId === originalMedia.stableId,
    )!
    const outdatedImage = await sharp({
      create: { width: 1600, height: 1000, channels: 3, background: '#b51724' },
    })
      .png()
      .toBuffer()
    const changedMedia = await payload.update({
      collection: 'platformContentMedia',
      id: heroId,
      overrideAccess: true,
      file: {
        name: 'seed-reset-outdated-hero.png',
        data: outdatedImage,
        mimetype: 'image/png',
        size: outdatedImage.length,
      },
      // Existing media may omit the optional document prefix; S3 uses the collection prefix.
      data: { alt: 'Outdated hero', prefix: null },
    })
    expect(changedMedia.prefix).toBeNull()
    const storagePrefix = posix.dirname(changedMedia.storagePath)
    const obsoleteKeys = [
      changedMedia.storagePath,
      ...Object.values(changedMedia.sizes ?? {}).flatMap((size) =>
        size?.filename ? [`${storagePrefix}/${size.filename}`] : [],
      ),
    ]
    expect(obsoleteKeys.length).toBeGreaterThan(1)
    for (const key of obsoleteKeys) expect((await fetch(objectUrl(key))).status, key).toBe(200)
    await payload.updateGlobal({
      slug: 'landingPages',
      overrideAccess: true,
      data: {
        home: { hero: { title: 'Changed home title', image: foreignMedia.id } },
        about: { hero: { title: 'Changed about title', image: foreignMedia.id } },
        clinicPartners: { hero: { title: 'Changed partners title', image: foreignMedia.id } },
      },
    })

    const missingSeed = (await loadSeedFile('baseline', 'platformContentMedia'))[0]!
    const missingMedia = (
      await payload.find({
        collection: 'platformContentMedia',
        where: { stableId: { equals: missingSeed.stableId } },
        overrideAccess: true,
        limit: 1,
      })
    ).docs[0]!
    await payload.delete({ collection: 'platformContentMedia', id: missingMedia.id, trash: true, overrideAccess: true })

    const performReset = resetModule.resetCollections
    const reset = vi.spyOn(resetModule, 'resetCollections').mockImplementation(async (...args) => {
      const result = await performReset(...args)
      const duringReset = await payload.findGlobal({ slug: 'landingPages', depth: 1, overrideAccess: true })
      for (const page of ['home', 'about', 'clinicPartners'] as const) {
        expect(duringReset[page].hero.image).toMatchObject({ id: foreignMedia.id, filename: expect.any(String) })
      }
      expect(duringReset.home.hero.title).toBe('Changed home title')
      expect(duringReset.about.hero.title).toBe('Changed about title')
      expect(duringReset.clinicPartners.hero.title).toBe('Changed partners title')
      return result
    })
    try {
      expect((await runBaselineSeeds(payload, { reset: true })).failures).toEqual([])
      expect(reset).toHaveBeenCalledOnce()
    } finally {
      reset.mockRestore()
    }
    const recreatedMedia = (
      await payload.find({
        collection: 'platformContentMedia',
        where: { stableId: { equals: missingSeed.stableId } },
        overrideAccess: true,
        limit: 1,
      })
    ).docs[0]!
    expect(recreatedMedia.id).not.toBe(missingMedia.id)
    expect(recreatedMedia.alt).toBe(missingSeed.alt)
    expect((await fetch(objectUrl(recreatedMedia.storagePath))).status).toBe(200)
    const renewed = await payload.findByID({ collection: 'platformContentMedia', id: heroId, overrideAccess: true })
    expect(renewed.id).toBe(originalMedia.id)
    expect(renewed.alt).toBe(seedMedia.alt)
    expect(renewed).toMatchObject({
      stableId: originalMedia.stableId,
      width: originalMedia.width,
      height: originalMedia.height,
      mimeType: originalMedia.mimeType,
      filesize: originalMedia.filesize,
    })
    expect(Buffer.from(await (await fetch(objectUrl(renewed.storagePath))).arrayBuffer()).equals(originalBytes)).toBe(
      true,
    )
    expect(renewed.storagePath).not.toBe(changedMedia.storagePath)
    for (const key of obsoleteKeys) expect((await fetch(objectUrl(key))).status).toBe(404)
    const entry = (await loadSeedGlobals()).find((value) => (value as { slug: string }).slug === 'landingPages') as {
      data: Record<string, unknown>
    }
    const expected = await prepareLandingPagesSeedData(payload, entry.data)
    const refreshedGlobals = await payload.findGlobal({ slug: 'landingPages', depth: 0, overrideAccess: true })
    expect(refreshedGlobals).toMatchObject(expected)
    expect(refreshedGlobals.home.hero.image).toBe(heroId)
    for (const collection of ['countries', 'cities', 'treatments', 'medical-specialties'] as const) {
      expect((await payload.count({ collection, overrideAccess: true })).totalDocs).toBeGreaterThan(0)
    }
    expect(
      await payload.findByID({ collection: 'patients', id: patient.id, depth: 0, overrideAccess: true }),
    ).toMatchObject({ id: patient.id, supabaseUserId: patient.supabaseUserId, country: null })
    expect((await fetch(objectUrl(foreignMedia.storagePath))).status).toBe(200)
  }, 180_000)
})
