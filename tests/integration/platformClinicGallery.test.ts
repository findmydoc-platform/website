import { randomUUID } from 'node:crypto'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createLocalReq, getPayload, type Payload, type PayloadRequest } from 'payload'
import config from '@payload-config'
import type { ClinicMedia } from '@/payload-types'
import { platformClinicGalleryAppendHandler } from '@/endpoints/platformClinicGallery'
import { clinicGalleryConstraints } from '@/features/clinicDashboard/gallery/contracts'
import {
  asPayloadStaffUser,
  cleanupTrackedUsers,
  createPlatformTestUser,
  type PayloadRequestUser,
} from '../fixtures/testUsers'

describe('Platform clinic gallery', () => {
  let payload: Payload
  let staff: PayloadRequestUser
  let clinicId: number
  let mediaId: number
  let secondMediaId: number
  let uploadedMediaId: number | undefined
  let doctorId: number | undefined
  let otherDoctorId: number | undefined
  let doctorMediaId: number | undefined
  const extraDraftIds: number[] = []
  const keyIds: number[] = []
  const staffIds: Array<number | string> = []
  const suffix = randomUUID()

  beforeAll(async () => {
    payload = await getPayload({ config })
    staff = asPayloadStaffUser(
      await createPlatformTestUser(payload, { emailPrefix: `gallery-${suffix}`, createdStaffIds: staffIds }),
    )
    const clinic = await payload.create({
      collection: 'clinics',
      overrideAccess: true,
      data: { name: `Gallery test ${suffix}`, slug: `gallery-test-${suffix}` },
    })
    clinicId = clinic.id
    const data = await sharp({ create: { width: 400, height: 300, channels: 3, background: '#778899' } })
      .png()
      .toBuffer()
    const media = (await payload.create({
      collection: 'clinicMedia',
      overrideAccess: true,
      user: staff,
      data: { clinic: clinicId, alt: 'Synthetic clinic image', status: 'draft' },
      file: { name: `test-${suffix}.png`, data, size: data.length, mimetype: 'image/png' },
    } as Parameters<Payload['create']>[0])) as ClinicMedia
    mediaId = media.id
    const second = (await payload.create({
      collection: 'clinicMedia',
      overrideAccess: true,
      user: staff,
      data: { clinic: clinicId, alt: 'Second synthetic image', status: 'draft' },
      file: { name: `second-${suffix}.png`, data, size: data.length, mimetype: 'image/png' },
    } as Parameters<Payload['create']>[0])) as ClinicMedia
    secondMediaId = second.id
  })

  afterAll(async () => {
    if (clinicId)
      await payload.update({ collection: 'clinics', id: clinicId, data: { profileGallery: [] }, overrideAccess: true })
    if (mediaId) await payload.delete({ collection: 'clinicMedia', id: mediaId, overrideAccess: true, trash: true })
    if (secondMediaId)
      await payload.delete({ collection: 'clinicMedia', id: secondMediaId, overrideAccess: true, trash: true })
    if (uploadedMediaId)
      await payload.delete({ collection: 'clinicMedia', id: uploadedMediaId, overrideAccess: true, trash: true })
    for (const id of extraDraftIds)
      await payload.delete({ collection: 'clinicMedia', id, overrideAccess: true, trash: true })
    if (otherDoctorId)
      await payload.update({
        collection: 'doctors',
        id: otherDoctorId,
        data: { profileImage: null },
        overrideAccess: true,
      })
    if (doctorId)
      await payload.update({ collection: 'doctors', id: doctorId, data: { profileImage: null }, overrideAccess: true })
    if (doctorMediaId)
      await payload.delete({ collection: 'doctorMedia', id: doctorMediaId, overrideAccess: true, trash: true })
    if (otherDoctorId)
      await payload.delete({ collection: 'doctors', id: otherDoctorId, overrideAccess: true, trash: true })
    if (doctorId) await payload.delete({ collection: 'doctors', id: doctorId, overrideAccess: true, trash: true })
    for (const id of keyIds) await payload.delete({ collection: 'payload-mcp-api-keys', id, overrideAccess: true })
    if (clinicId) await payload.delete({ collection: 'clinics', id: clinicId, overrideAccess: true })
    await cleanupTrackedUsers(payload, { staffIds })
  })

  const request = async (user: PayloadRequest['user']) => {
    const req = await createLocalReq({ user: user ?? undefined }, payload)
    req.routeParams = { id: String(mediaId) }
    req.headers.set('content-type', 'application/json')
    return platformClinicGalleryAppendHandler(req)
  }

  it('denies anonymous users and adds an owned draft image for platform staff', async () => {
    expect((await request(null)).status).toBe(403)
    const before = await payload.findByID({ collection: 'clinicMedia', id: mediaId, overrideAccess: true })
    expect(before.status).toBe('draft')

    expect((await request(staff)).status).toBe(200)
    const media = await payload.findByID({ collection: 'clinicMedia', id: mediaId, overrideAccess: true })
    const clinic = await payload.findByID({ collection: 'clinics', id: clinicId, depth: 0, overrideAccess: true })
    expect(media.status).toBe('published')
    expect(clinic.profileGallery).toEqual([mediaId])
    expect(clinic.thumbnail).toBe(mediaId)
  })

  it('requires an explicit MCP key grant and preserves the existing gallery order', async () => {
    expect((await request(staff)).status).toBe(200)
    const token = randomUUID()
    const ungrantedToken = randomUUID()
    const ungranted = await payload.create({
      collection: 'payload-mcp-api-keys',
      overrideAccess: true,
      data: {
        user: staff.id,
        label: `gallery-ungranted-${suffix}`,
        enableAPIKey: true,
        apiKey: ungrantedToken,
        clinics: { update: true },
      },
    })
    keyIds.push(ungranted.id)
    const key = await payload.create({
      collection: 'payload-mcp-api-keys',
      overrideAccess: true,
      data: {
        user: staff.id,
        label: `gallery-${suffix}`,
        enableAPIKey: true,
        apiKey: token,
        ...{
          'payload-mcp-tool': {
            publishClinicGalleryImage: true,
            uploadClinicGalleryImage: true,
            readClinicGallery: true,
            saveClinicGallery: true,
            uploadDoctorImage: true,
            readDoctorImage: true,
            updateDoctorImage: true,
            deleteDoctorImage: true,
            deleteClinicImage: true,
          },
          clinicMedia: { find: true },
          doctorMedia: { find: true },
          doctors: { find: true, update: true },
        },
      },
    })
    keyIds.push(key.id)
    const endpoint = payload.config.endpoints.find((entry) => entry.path === '/mcp' && entry.method === 'post')
    if (!endpoint) throw new Error('Expected the MCP endpoint')
    const call = async (
      apiKey: string,
      name = 'publishClinicGalleryImage',
      args: Record<string, unknown> = { mediaId: secondMediaId },
    ) => {
      const request = new Request('http://localhost:3000/api/mcp', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name, arguments: args },
        }),
      })
      const req = await createLocalReq(
        { req: { method: request.method, url: request.url, headers: request.headers, body: request.body } },
        payload,
      )
      const response = await endpoint.handler(req)
      expect(response.status).toBe(200)
      const body = await response.text()
      const serialized =
        body.startsWith('data:') || body.includes('\ndata:')
          ? body
              .split('\n')
              .find((line) => line.startsWith('data:'))!
              .slice(5)
              .trim()
          : body
      const result = JSON.parse(serialized)
      return (result.result?.content?.[0]?.text ??
        result.result?.content?.[0]?.data ??
        result.error?.message ??
        '') as string
    }
    expect(await call(ungrantedToken)).not.toContain('Second synthetic image')
    expect(
      (await payload.findByID({ collection: 'clinicMedia', id: secondMediaId, overrideAccess: true })).status,
    ).toBe('draft')
    const text = await call(token)
    expect(text).toContain('Second synthetic image')
    const clinic = await payload.findByID({ collection: 'clinics', id: clinicId, depth: 0, overrideAccess: true })
    expect(clinic.profileGallery).toEqual([mediaId, secondMediaId])
    expect(clinic.thumbnail).toBe(mediaId)
    const initialSnapshot = await call(token, 'readClinicGallery', { clinicId })
    expect(initialSnapshot).not.toContain('/clinic-dashboard/')
    expect(await call(ungrantedToken, 'readClinicGallery', { clinicId, mediaId })).not.toContain('iVBOR')
    const image = JSON.parse(await call(token, 'readClinicGallery', { clinicId, mediaId })) as {
      data: string
      mimeType: string
    }
    expect(image.mimeType).toBe('image/png')
    expect((await sharp(Buffer.from(image.data, 'base64')).metadata()).format).toBe('png')
    expect(await call(token, 'readClinicGallery', { clinicId, mediaId: secondMediaId + 999999 })).not.toContain('iVBOR')
    expect(await call(ungrantedToken, 'updateClinics', { id: clinicId, profileGallery: [] })).not.toContain(
      'Document updated successfully',
    )
    const retained = await payload.findByID({ collection: 'clinics', id: clinicId, depth: 0, overrideAccess: true })
    expect(retained.profileGallery).toEqual([mediaId, secondMediaId])
    expect((await payload.findByID({ collection: 'clinicMedia', id: mediaId, overrideAccess: true })).status).toBe(
      'published',
    )

    const bytes = await sharp({ create: { width: 320, height: 240, channels: 3, background: '#99aabb' } })
      .png()
      .toBuffer()
    const upload = {
      clinicId,
      name: `mcp-${suffix}.png`,
      mimeType: 'image/png',
      base64: bytes.toString('base64'),
      alt: 'MCP synthetic image',
    }
    expect(await call(ungrantedToken, 'uploadClinicGalleryImage', upload)).not.toContain('"id"')
    const countBeforeInvalid = await payload.count({ collection: 'clinicMedia', overrideAccess: true })
    expect(await call(token, 'uploadClinicGalleryImage', { ...upload, base64: 'not-valid-base64' })).not.toContain(
      '"id"',
    )
    expect(
      await call(token, 'uploadClinicGalleryImage', {
        ...upload,
        base64: Buffer.from('not an image').toString('base64'),
      }),
    ).not.toContain('"id"')
    expect((await payload.count({ collection: 'clinicMedia', overrideAccess: true })).totalDocs).toBe(
      countBeforeInvalid.totalDocs,
    )
    const uploaded = JSON.parse(await call(token, 'uploadClinicGalleryImage', upload)) as { id: number }
    uploadedMediaId = uploaded.id
    const stored = await payload.findByID({
      collection: 'clinicMedia',
      id: uploaded.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(stored).toMatchObject({ clinic: clinicId, alt: 'MCP synthetic image', status: 'draft' })
    for (let index = 1; index < clinicGalleryConstraints.maxItems; index++) {
      const extra = (await payload.create({
        collection: 'clinicMedia',
        overrideAccess: true,
        user: staff,
        data: { clinic: clinicId, alt: `Draft ${index}`, status: 'draft' },
        file: { name: `draft-${index}-${suffix}.png`, data: bytes, size: bytes.length, mimetype: 'image/png' },
      } as Parameters<Payload['create']>[0])) as ClinicMedia
      extraDraftIds.push(extra.id)
    }
    expect(await call(token, 'uploadClinicGalleryImage', { ...upload, name: `over-limit-${suffix}.png` })).toContain(
      'Too many unfinished clinic gallery uploads.',
    )
    while (extraDraftIds.length) {
      const id = extraDraftIds.pop()!
      await payload.delete({ collection: 'clinicMedia', id, overrideAccess: true, trash: true })
    }
    expect(await call(ungrantedToken, 'readClinicGallery', { clinicId })).not.toContain('"revision"')
    const snapshot = JSON.parse(await call(token, 'readClinicGallery', { clinicId })) as { revision: number }
    const edit = {
      clinicId,
      expectedRevision: snapshot.revision,
      items: [
        { mediaId: String(uploaded.id), alt: 'MCP synthetic image' },
        { mediaId: String(mediaId), alt: 'Updated synthetic image' },
      ],
    }
    expect(await call(ungrantedToken, 'saveClinicGallery', edit)).not.toContain('Updated synthetic image')
    expect(await call(token, 'saveClinicGallery', edit)).toContain('Updated synthetic image')
    const updatedClinic = await payload.findByID({
      collection: 'clinics',
      id: clinicId,
      depth: 0,
      overrideAccess: true,
    })
    expect(updatedClinic.profileGallery).toEqual([uploaded.id, mediaId])
    expect(updatedClinic.thumbnail).toBe(uploaded.id)
    expect(
      (await payload.findByID({ collection: 'clinicMedia', id: secondMediaId, overrideAccess: true })).status,
    ).toBe('draft')
    expect(await call(token, 'saveClinicGallery', edit)).not.toContain('Updated synthetic image')

    expect(await call(ungrantedToken, 'findClinicMedia', { limit: 20 })).not.toContain('Updated synthetic image')
    expect(await call(token, 'findClinicMedia', { limit: 20 })).toContain('Updated synthetic image')
    const doctor = await payload.create({
      collection: 'doctors',
      overrideAccess: true,
      data: {
        firstName: 'Test',
        lastName: 'Doctor',
        fullName: 'Test Doctor',
        active: false,
        gender: 'female',
        clinic: clinicId,
        qualifications: ['Test'],
        languages: ['english'],
        slug: `gallery-doctor-${suffix}`,
      },
    })
    doctorId = doctor.id
    const doctorUpload = {
      doctorId,
      name: `doctor-${suffix}.png`,
      mimeType: 'image/png',
      base64: upload.base64,
      alt: 'Synthetic doctor image',
    }
    expect(await call(ungrantedToken, 'uploadDoctorImage', doctorUpload)).not.toContain('"id"')
    const doctorImage = JSON.parse(await call(token, 'uploadDoctorImage', doctorUpload)) as { id: number }
    doctorMediaId = doctorImage.id
    const storedDoctorImage = await payload.findByID({
      collection: 'doctorMedia',
      id: doctorMediaId,
      depth: 0,
      overrideAccess: true,
    })
    expect(storedDoctorImage).toMatchObject({ doctor: doctorId, clinic: clinicId, alt: 'Synthetic doctor image' })
    const metadataToken = randomUUID()
    const metadataKey = await payload.create({
      collection: 'payload-mcp-api-keys',
      overrideAccess: true,
      data: {
        user: staff.id,
        label: `doctor-metadata-${suffix}`,
        enableAPIKey: true,
        apiKey: metadataToken,
        doctorMedia: { find: true },
      },
    })
    keyIds.push(metadataKey.id)
    expect(metadataKey['payload-mcp-tool']?.readDoctorImage).toBe(false)
    expect(await call(metadataToken, 'findDoctorMedia', { id: doctorMediaId })).toContain('Synthetic doctor image')
    expect(await call(metadataToken, 'readDoctorImage', { id: doctorMediaId })).not.toContain('iVBOR')
    const doctorImageBytes = JSON.parse(await call(token, 'readDoctorImage', { id: doctorMediaId })) as {
      data: string
      mimeType: string
    }
    expect(doctorImageBytes.mimeType).toBe('image/png')
    expect((await sharp(Buffer.from(doctorImageBytes.data, 'base64')).metadata()).format).toBe('png')
    expect(await call(ungrantedToken, 'findDoctorMedia', { limit: 20 })).not.toContain('Synthetic doctor image')
    expect(await call(token, 'findDoctorMedia', { limit: 20 })).toContain('Synthetic doctor image')
    expect(await call(token, 'updateDoctorImage', { id: doctorMediaId, alt: 'Updated doctor image' })).toContain(
      'Updated doctor image',
    )
    const otherDoctor = await payload.create({
      collection: 'doctors',
      overrideAccess: true,
      data: {
        firstName: 'Other',
        lastName: 'Doctor',
        fullName: 'Other Doctor',
        active: false,
        gender: 'female',
        clinic: clinicId,
        qualifications: ['Test'],
        languages: ['english'],
        slug: `gallery-other-doctor-${suffix}`,
      },
    })
    otherDoctorId = otherDoctor.id
    expect(await call(token, 'updateDoctors', { id: otherDoctorId, profileImage: doctorMediaId })).not.toContain(
      'Document updated successfully',
    )
    const unchangedDoctor = await payload.findByID({ collection: 'doctors', id: otherDoctorId, overrideAccess: true })
    expect(unchangedDoctor.profileImage).toBeFalsy()
    expect(await call(token, 'updateDoctors', { id: doctorId, profileImage: doctorMediaId })).toContain(
      'Document updated successfully',
    )
    const doctorText = await call(token, 'findDoctors', { id: doctorId })
    expect(JSON.parse(doctorText.slice(doctorText.indexOf('{')))).toMatchObject({ profileImage: doctorMediaId })
    expect(await call(token, 'deleteDoctorImage', { id: doctorMediaId })).not.toContain('deleted')
    expect(await call(token, 'deleteClinicImage', { id: mediaId })).not.toContain('deleted')
    expect(await call(ungrantedToken, 'deleteClinicImage', { id: secondMediaId })).not.toContain('deleted')
    expect(await call(token, 'deleteClinicImage', { id: secondMediaId })).toContain('deleted')
    secondMediaId = 0
    expect(await call(token, 'updateDoctors', { id: doctorId, profileImage: null })).toContain(
      'Document updated successfully',
    )
    expect(await call(token, 'deleteDoctorImage', { id: doctorMediaId })).toContain('deleted')
    doctorMediaId = undefined
    expect(await payload.findByID({ collection: 'doctors', id: doctorId, overrideAccess: true })).toBeTruthy()
  })
})
