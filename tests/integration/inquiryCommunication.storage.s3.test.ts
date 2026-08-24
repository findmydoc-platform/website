import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createLocalReq, getPayload, type Payload, type PayloadRequest } from 'payload'

import config from '@payload-config'
import {
  cleanupDiscardedAttachment,
  createAttachmentDraft,
  createVerifiedPatientInquiry,
  discardAttachmentDraft,
  finalizeAttachmentDraft,
  InquiryCommunicationServiceError,
  readAttachmentAccess,
  sendPatientInquiryMessage,
  sweepExpiredAttachmentDrafts,
} from '@/features/inquiryCommunication/service'
import {
  createS3InquiryAttachmentStorage,
  type InquiryAttachmentMimeType,
  type InquiryAttachmentStorageGateway,
} from '@/features/inquiryCommunication/storage'
import { resolveS3StorageConfig } from '@/plugins/storageConfig'
import type { InquiryAttachment } from '@/payload-types'
import { createClinicFixture } from '../fixtures/createClinicFixture'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { createTinyPngFile } from '../fixtures/mediaFile'
import { testSlug } from '../fixtures/testSlug'
import {
  asClinicScopedPayloadUser,
  asPayloadPatientUser,
  cleanupTrackedUsers,
  createClinicTestUser,
  createPatientTestUser,
} from '../fixtures/testUsers'

const storageConfig = resolveS3StorageConfig({ DEPLOYMENT_ENV: 'test' })
const slugPrefix = testSlug('inquiryCommunication.storage.s3.test.ts')

const storageObjectUrl = (objectKey: string): string =>
  new URL(`${storageConfig.bucket}/${objectKey}`, `${storageConfig.clientConfig.endpoint}/`).toString()

const putStorageObject = async (
  objectKey: string,
  bytes: Uint8Array,
  contentType: InquiryAttachmentMimeType,
): Promise<void> => {
  const response = await fetch(storageObjectUrl(objectKey), {
    body: new Uint8Array(bytes),
    headers: { 'content-type': contentType },
    method: 'PUT',
  })

  if (!response.ok) {
    throw new Error(`S3Mock rejected the synthetic object with status ${response.status}`)
  }
}

const fetchStorageObject = (objectKey: string, method: 'GET' | 'HEAD' = 'GET'): Promise<Response> =>
  fetch(storageObjectUrl(objectKey), { method })

type StoredAttachment = Pick<
  InquiryAttachment,
  'cleanupCompletedAt' | 'draftCleanupCompletedAt' | 'draftObjectKey' | 'id' | 'readyObjectKey' | 'state'
>

describe('inquiry communication storage with Payload and S3Mock', () => {
  let payload: Payload
  let clinicId: number
  let doctorId: number
  let patientReq: PayloadRequest
  let foreignPatientReq: PayloadRequest
  let clinicReq: PayloadRequest
  const createdInquiryIds: Array<number | string> = []
  const createdPatientIds: Array<number | string> = []
  const createdStaffIds: Array<number | string> = []
  let inquiryCounter = 0

  const readAttachment = async (attachmentId: string): Promise<StoredAttachment> =>
    (await payload.findByID({
      collection: 'inquiryAttachments',
      depth: 0,
      id: attachmentId,
      overrideAccess: true,
    })) as StoredAttachment

  const createInquiry = async (suffix: string) => {
    inquiryCounter += 1
    const result = await createVerifiedPatientInquiry(patientReq, {
      clinicId: String(clinicId),
      consent: true,
      doctorId: String(doctorId),
      email: `${slugPrefix}-patient@example.com`,
      fullName: 'Synthetic Storage Patient',
      idempotencyKey: `${slugPrefix}-${suffix}-${inquiryCounter}-create`,
      message: `Synthetic storage inquiry ${suffix}.`,
      phoneNumber: '+493000000003',
    })
    createdInquiryIds.push(result.inquiry.id)
    return result.inquiry
  }

  const uploadDraft = async (
    inquiryId: string,
    fileName: string,
    bytes: Uint8Array,
  ): Promise<{ attachment: StoredAttachment; draftId: string }> => {
    const draft = await createAttachmentDraft(patientReq, {
      fileName,
      inquiryId,
      mimeType: 'image/png',
      sizeBytes: bytes.byteLength,
    })
    const attachment = await readAttachment(draft.draftId)
    const response = await fetch(draft.upload.url, {
      body: new Uint8Array(bytes),
      headers: draft.upload.headers,
      method: draft.upload.method,
    })
    expect(response.ok).toBe(true)
    return { attachment, draftId: draft.draftId }
  }

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)

    const cities = await payload.find({ collection: 'cities', depth: 0, limit: 1, overrideAccess: true })
    const city = cities.docs[0]
    if (!city) throw new Error('Expected baseline city')

    const fixture = await createClinicFixture(payload, city.id, { slugPrefix })
    clinicId = fixture.clinic.id
    doctorId = fixture.doctor.id

    const patient = await createPatientTestUser(payload, {
      createdPatientIds,
      emailPrefix: `${slugPrefix}-patient`,
      firstName: 'Synthetic',
      lastName: 'Storage Patient',
    })
    const foreignPatient = await createPatientTestUser(payload, {
      createdPatientIds,
      emailPrefix: `${slugPrefix}-foreign-patient`,
      firstName: 'Foreign',
      lastName: 'Storage Patient',
    })
    const clinicStaff = await createClinicTestUser(payload, {
      createdStaffIds,
      emailPrefix: `${slugPrefix}-clinic`,
      firstName: 'Synthetic',
      lastName: 'Storage Clinic',
    })

    patientReq = await createLocalReq({}, payload)
    patientReq.user = asPayloadPatientUser(patient)
    foreignPatientReq = await createLocalReq({}, payload)
    foreignPatientReq.user = asPayloadPatientUser(foreignPatient)
    clinicReq = await createLocalReq({}, payload)
    clinicReq.user = await asClinicScopedPayloadUser(payload, clinicStaff, clinicId)
  }, 60_000)

  afterAll(async () => {
    if (!payload) return

    const attachments = (
      await payload.find({
        collection: 'inquiryAttachments',
        depth: 0,
        limit: 500,
        overrideAccess: true,
        where: { inquiry: { in: createdInquiryIds } },
      })
    ).docs as InquiryAttachment[]
    const remainingObjectKeys = attachments.flatMap(({ draftObjectKey, readyObjectKey }) =>
      [draftObjectKey, readyObjectKey].filter((key): key is string => Boolean(key)),
    )
    await createS3InquiryAttachmentStorage().deleteObjects(remainingObjectKeys)

    for (const collection of [
      'inquiryAuditEvents',
      'inquiryReadPositions',
      'inquiryMessages',
      'inquiryInternalNotes',
      'inquiryAttachments',
      'inquiryConversations',
    ] as const) {
      await payload.delete({
        collection,
        overrideAccess: true,
        where: { inquiry: { in: createdInquiryIds } },
      })
    }
    for (const id of createdInquiryIds) {
      await payload.delete({ collection: 'patientClinicInquiries', id, overrideAccess: true })
    }
    await cleanupTrackedUsers(payload, { patientIds: createdPatientIds, staffIds: createdStaffIds })
    await payload.delete({ collection: 'doctors', overrideAccess: true, where: { clinic: { equals: clinicId } } })
    await payload.delete({ collection: 'clinics', id: clinicId, overrideAccess: true })
  }, 60_000)

  it('uploads to a private draft key, seals once, binds, and grants only participant read access', async () => {
    const inquiry = await createInquiry('happy-path')
    const file = createTinyPngFile(`${slugPrefix}-synthetic-result.png`)
    const draft = await createAttachmentDraft(patientReq, {
      fileName: 'Synthetic result.png',
      inquiryId: inquiry.id,
      mimeType: 'image/png',
      sizeBytes: file.data.byteLength,
    })
    const uploadUrl = new URL(draft.upload.url)
    const initialAttachment = await readAttachment(draft.draftId)
    const draftObjectKey = String(initialAttachment.draftObjectKey)

    expect(draft.upload).toMatchObject({ headers: { 'content-type': 'image/png' }, method: 'PUT' })
    expect(draft.upload.headers).not.toHaveProperty('content-length')
    expect(uploadUrl.origin).toBe(new URL(storageConfig.clientConfig.endpoint).origin)
    expect(decodeURIComponent(uploadUrl.pathname)).toBe(`/${storageConfig.bucket}/${draftObjectKey}`)
    expect(draftObjectKey).toMatch(
      new RegExp(`^inquiry-communication/${String(clinicId)}/${inquiry.id}/[a-f0-9]{24}/draft/[a-f0-9-]{36}$`),
    )
    expect(uploadUrl.searchParams.get('X-Amz-Expires')).toBe('900')
    expect(uploadUrl.searchParams.get('X-Amz-Signature')).toMatch(/^[a-f0-9]{64}$/u)
    expect((await fetchStorageObject(draftObjectKey, 'HEAD')).status).toBe(404)

    const upload = await fetch(draft.upload.url, {
      body: new Uint8Array(file.data),
      headers: draft.upload.headers,
      method: draft.upload.method,
    })
    expect(upload.ok).toBe(true)
    const uploadedHead = await fetchStorageObject(draftObjectKey, 'HEAD')
    expect(uploadedHead.status).toBe(200)
    expect(uploadedHead.headers.get('content-length')).toBe(String(file.data.byteLength))
    expect(uploadedHead.headers.get('content-type')).toContain('image/png')

    const finalized = await finalizeAttachmentDraft(patientReq, {
      draftId: draft.draftId,
      inquiryId: inquiry.id,
    })
    const verifiedAttachment = await readAttachment(finalized.attachment.id)
    const readyObjectKey = String(verifiedAttachment.readyObjectKey)

    expect(verifiedAttachment).toMatchObject({
      draftCleanupCompletedAt: expect.any(String),
      draftObjectKey,
      state: 'verified',
    })
    expect(readyObjectKey).toMatch(/\/ready\/[a-f0-9-]{36}$/u)
    expect((await fetchStorageObject(draftObjectKey, 'HEAD')).status).toBe(404)
    const sealedObject = await fetchStorageObject(readyObjectKey)
    expect(sealedObject.status).toBe(200)
    expect(Buffer.from(await sealedObject.arrayBuffer())).toEqual(file.data)

    const sent = await sendPatientInquiryMessage(patientReq, {
      attachmentDraftId: finalized.attachment.id,
      expectedRevision: 0,
      idempotencyKey: `${slugPrefix}-happy-path-bind`,
      inquiryId: inquiry.id,
    })
    expect(sent.inquiry.revision).toBe(1)
    expect(sent.inquiry.timeline.at(-1)).toMatchObject({
      attachment: { fileName: 'Synthetic result.png' },
      kind: 'external-message',
    })
    await expect(readAttachment(finalized.attachment.id)).resolves.toMatchObject({ state: 'bound' })

    const patientAccess = await readAttachmentAccess(patientReq, {
      attachmentId: finalized.attachment.id,
      mode: 'download',
    })
    const downloadUrl = new URL(patientAccess.url)
    expect(patientAccess.method).toBe('GET')
    expect(downloadUrl.searchParams.get('X-Amz-Expires')).toBe('60')
    expect(downloadUrl.searchParams.get('response-content-disposition')).toContain('attachment')
    const download = await fetch(patientAccess.url)
    expect(download.status).toBe(200)
    expect(download.headers.get('content-type')).toContain('image/png')
    expect(Buffer.from(await download.arrayBuffer())).toEqual(file.data)

    await expect(
      readAttachmentAccess(clinicReq, { attachmentId: finalized.attachment.id, mode: 'preview' }),
    ).resolves.toMatchObject({ method: 'GET' })
    await expect(
      readAttachmentAccess(foreignPatientReq, { attachmentId: finalized.attachment.id, mode: 'download' }),
    ).rejects.toMatchObject({ kind: 'not-found' } satisfies Partial<InquiryCommunicationServiceError>)
  })

  it('rejects HEAD size, metadata type, and magic-byte drift before reusing the reserved ready key', async () => {
    const inquiry = await createInquiry('validation')
    const validFile = createTinyPngFile(`${slugPrefix}-validation.png`)
    const cases: Array<{
      bytes: Uint8Array
      contentType: InquiryAttachmentMimeType
      expectedKind: InquiryCommunicationServiceError['kind']
      label: string
      repair: boolean
    }> = [
      {
        bytes: Buffer.concat([validFile.data, Buffer.from([0])]),
        contentType: 'image/png',
        expectedKind: 'invalid-state',
        label: 'size',
        repair: false,
      },
      {
        bytes: validFile.data,
        contentType: 'application/pdf',
        expectedKind: 'unsupported-media-type',
        label: 'metadata-type',
        repair: false,
      },
      {
        bytes: Buffer.alloc(validFile.data.byteLength, 0x41),
        contentType: 'image/png',
        expectedKind: 'unsupported-media-type',
        label: 'magic-bytes',
        repair: true,
      },
    ]

    for (const entry of cases) {
      const draft = await createAttachmentDraft(patientReq, {
        fileName: `${entry.label}.png`,
        inquiryId: inquiry.id,
        mimeType: 'image/png',
        sizeBytes: validFile.data.byteLength,
      })
      const beforeFinalize = await readAttachment(draft.draftId)
      const draftObjectKey = String(beforeFinalize.draftObjectKey)
      await putStorageObject(draftObjectKey, entry.bytes, entry.contentType)

      await expect(
        finalizeAttachmentDraft(patientReq, { draftId: draft.draftId, inquiryId: inquiry.id }),
      ).rejects.toMatchObject({ kind: entry.expectedKind } satisfies Partial<InquiryCommunicationServiceError>)
      const failed = await readAttachment(draft.draftId)
      const reservedReadyObjectKey = String(failed.readyObjectKey)
      expect(failed).toMatchObject({ state: 'draft' })
      expect(reservedReadyObjectKey).toMatch(/\/ready\/[a-f0-9-]{36}$/u)

      if (entry.repair) {
        await putStorageObject(draftObjectKey, validFile.data, 'image/png')
        await expect(
          finalizeAttachmentDraft(patientReq, { draftId: draft.draftId, inquiryId: inquiry.id }),
        ).resolves.toMatchObject({ attachment: { id: draft.draftId, mimeType: 'image/png' } })
        const repaired = await readAttachment(draft.draftId)
        expect(repaired).toMatchObject({
          draftCleanupCompletedAt: expect.any(String),
          readyObjectKey: reservedReadyObjectKey,
          state: 'verified',
        })
        expect(Buffer.from(await (await fetchStorageObject(reservedReadyObjectKey)).arrayBuffer())).toEqual(
          validFile.data,
        )
        continue
      }

      await expect(
        discardAttachmentDraft(patientReq, { draftId: draft.draftId, inquiryId: inquiry.id }),
      ).resolves.toMatchObject({ discarded: true })
      await expect(cleanupDiscardedAttachment(patientReq, { attachmentId: draft.draftId })).resolves.toBe(true)
      expect((await fetchStorageObject(draftObjectKey, 'HEAD')).status).toBe(404)
    }
  })

  it('detects real object tampering between the preflight and atomic bind verification', async () => {
    const inquiry = await createInquiry('bind-race')
    const file = createTinyPngFile(`${slugPrefix}-bind-race.png`)
    const { draftId } = await uploadDraft(inquiry.id, 'Synthetic bind race.png', file.data)
    const finalized = await finalizeAttachmentDraft(patientReq, { draftId, inquiryId: inquiry.id })
    const storage = createS3InquiryAttachmentStorage()
    let verificationCount = 0
    const raceStorage: InquiryAttachmentStorageGateway = {
      ...storage,
      async verifySealed(args) {
        verificationCount += 1
        await storage.verifySealed(args)
        if (verificationCount === 1) {
          await putStorageObject(args.readyObjectKey, Buffer.alloc(args.expectedSizeBytes, 0x42), args.expectedMimeType)
        }
      },
    }

    await expect(
      sendPatientInquiryMessage(
        patientReq,
        {
          attachmentDraftId: finalized.attachment.id,
          expectedRevision: 0,
          idempotencyKey: `${slugPrefix}-bind-race-message`,
          inquiryId: inquiry.id,
        },
        raceStorage,
      ),
    ).rejects.toMatchObject({ kind: 'invalid-state' } satisfies Partial<InquiryCommunicationServiceError>)

    expect(verificationCount).toBe(2)
    await expect(readAttachment(finalized.attachment.id)).resolves.toMatchObject({ state: 'verified' })
    const messages = await payload.find({
      collection: 'inquiryMessages',
      depth: 0,
      overrideAccess: true,
      where: { inquiry: { equals: inquiry.id } },
    })
    expect(messages.docs).toHaveLength(0)
  })

  it('cleans explicit discards and sweeps at most 50 synthetic drafts older than 24 hours', async () => {
    const inquiry = await createInquiry('orphan-sweep')
    const file = createTinyPngFile(`${slugPrefix}-orphan.png`)
    const patientId = patientReq.user?.id
    if (patientId === undefined) throw new Error('Expected patient fixture')

    const explicit = await uploadDraft(inquiry.id, 'Explicit discard.png', file.data)
    await expect(
      discardAttachmentDraft(patientReq, { draftId: explicit.draftId, inquiryId: inquiry.id }),
    ).resolves.toMatchObject({ discarded: true })
    await expect(cleanupDiscardedAttachment(patientReq, { attachmentId: explicit.draftId })).resolves.toBe(true)
    expect((await fetchStorageObject(String(explicit.attachment.draftObjectKey), 'HEAD')).status).toBe(404)
    await expect(readAttachment(explicit.draftId)).resolves.toMatchObject({
      cleanupCompletedAt: expect.any(String),
      draftCleanupCompletedAt: expect.any(String),
      state: 'discarded',
    })

    const oldTimestamp = new Date(Date.now() - 25 * 60 * 60 * 1_000).toISOString()
    const candidateIds: Array<number | string> = []
    for (let index = 0; index < 51; index += 1) {
      const draftObjectKey = `inquiry-communication/${String(clinicId)}/${inquiry.id}/synthetic-orphan/draft/${randomUUID()}`
      const attachment = (await payload.create({
        collection: 'inquiryAttachments',
        data: {
          actorKey: `patients:${String(patientId)}`,
          clinic: clinicId,
          declaredMimeType: 'image/png',
          declaredSizeBytes: file.data.byteLength,
          draftObjectKey,
          expiresAt: oldTimestamp,
          fileName: `synthetic-orphan-${index + 1}.png`,
          inquiry: Number(inquiry.id),
          objectCreatedAt: oldTimestamp,
          ownerKind: 'patient',
          ownerPatient: patientId,
          patient: patientId,
          state: 'draft',
        },
        depth: 0,
        overrideAccess: true,
      })) as InquiryAttachment
      candidateIds.push(attachment.id)
      await putStorageObject(draftObjectKey, file.data, 'image/png')
    }

    const recentObjectKey = `inquiry-communication/${String(clinicId)}/${inquiry.id}/synthetic-recent/draft/${randomUUID()}`
    const recent = (await payload.create({
      collection: 'inquiryAttachments',
      data: {
        actorKey: `patients:${String(patientId)}`,
        clinic: clinicId,
        declaredMimeType: 'image/png',
        declaredSizeBytes: file.data.byteLength,
        draftObjectKey: recentObjectKey,
        expiresAt: new Date(Date.now() + 15 * 60 * 1_000).toISOString(),
        fileName: 'synthetic-recent.png',
        inquiry: Number(inquiry.id),
        objectCreatedAt: new Date().toISOString(),
        ownerKind: 'patient',
        ownerPatient: patientId,
        patient: patientId,
        state: 'draft',
      },
      depth: 0,
      overrideAccess: true,
    })) as InquiryAttachment
    await putStorageObject(recentObjectKey, file.data, 'image/png')

    await expect(sweepExpiredAttachmentDrafts(patientReq)).resolves.toEqual({ cleaned: 50, examined: 50 })
    const firstPass = (
      await payload.find({
        collection: 'inquiryAttachments',
        depth: 0,
        limit: 100,
        overrideAccess: true,
        where: { id: { in: candidateIds } },
      })
    ).docs as InquiryAttachment[]
    const firstPassCleaned = firstPass.filter(({ cleanupCompletedAt }) => Boolean(cleanupCompletedAt))
    const firstPassPending = firstPass.filter(({ cleanupCompletedAt }) => !cleanupCompletedAt)
    expect(firstPassCleaned).toHaveLength(50)
    expect(firstPassPending).toHaveLength(1)
    expect((await fetchStorageObject(String(firstPassCleaned[0]?.draftObjectKey), 'HEAD')).status).toBe(404)
    expect((await fetchStorageObject(String(firstPassPending[0]?.draftObjectKey), 'HEAD')).status).toBe(200)

    await expect(sweepExpiredAttachmentDrafts(patientReq)).resolves.toEqual({ cleaned: 1, examined: 1 })
    await expect(sweepExpiredAttachmentDrafts(patientReq)).resolves.toEqual({ cleaned: 0, examined: 0 })
    expect((await fetchStorageObject(String(firstPassPending[0]?.draftObjectKey), 'HEAD')).status).toBe(404)
    await expect(readAttachment(String(recent.id))).resolves.toMatchObject({
      cleanupCompletedAt: null,
      state: 'draft',
    })
    expect((await fetchStorageObject(recentObjectKey, 'HEAD')).status).toBe(200)

    await discardAttachmentDraft(patientReq, { draftId: String(recent.id), inquiryId: inquiry.id })
    await cleanupDiscardedAttachment(patientReq, { attachmentId: String(recent.id) })
    expect((await fetchStorageObject(recentObjectKey, 'HEAD')).status).toBe(404)
  }, 120_000)
})
