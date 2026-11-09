import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createLocalReq, getPayload, type Payload } from 'payload'
import { revalidatePath, revalidateTag } from 'next/cache'

import config from '@payload-config'
import {
  asPayloadStaffUser,
  cleanupTrackedUsers,
  createPlatformTestUser,
  type PayloadRequestUser,
} from '../../fixtures/testUsers'
import { testSlug } from '../../fixtures/testSlug'
import { buildRichText } from '../../fixtures/richText'
import { ensureBaseline } from '../../fixtures/ensureBaseline'
import type { Treatment } from '@/payload-types'

describe('MCP key management and client access', () => {
  let payload: Payload
  let admin: PayloadRequestUser
  let support: PayloadRequestUser
  const staffIds: Array<number | string> = []
  const keyIds: number[] = []
  const clinicIds: Array<number | string> = []
  const groupIds: Array<number | string> = []
  const doctorIds: Array<number | string> = []
  const specialtyIds: Array<number | string> = []
  const doctorSpecialtyIds: Array<number | string> = []
  const clinicTreatmentIds: Array<number | string> = []
  const doctorTreatmentIds: Array<number | string> = []
  const treatmentIds: Array<number | string> = []
  const prefix = testSlug('mcpKeys-access.test.ts')

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
    const first = await createPlatformTestUser(payload, { emailPrefix: `${prefix}-admin`, createdStaffIds: staffIds })
    admin = asPayloadStaffUser(
      await payload.update({
        collection: 'platformStaff',
        id: first.id,
        data: { role: 'admin' },
        context: { trustedPlatformStaffOps: true },
        overrideAccess: true,
      }),
    )
    support = asPayloadStaffUser(
      await createPlatformTestUser(payload, {
        emailPrefix: `${prefix}-support`,
        createdStaffIds: staffIds,
      }),
    )
  }, 60000)

  afterAll(async () => {
    for (const id of clinicIds) {
      await payload.update({ collection: 'clinics', id, data: { deletedAt: null }, overrideAccess: true, trash: true })
    }
    for (const id of doctorSpecialtyIds)
      await payload.delete({ collection: 'doctorspecialties', id, overrideAccess: true })
    for (const id of clinicTreatmentIds)
      await payload.delete({ collection: 'clinictreatments', id, overrideAccess: true })
    for (const id of doctorTreatmentIds)
      await payload.delete({ collection: 'doctortreatments', id, overrideAccess: true })
    for (const id of doctorIds) await payload.delete({ collection: 'doctors', id, overrideAccess: true, trash: true })
    for (const id of clinicIds) await payload.delete({ collection: 'clinics', id, overrideAccess: true, trash: true })
    for (const id of groupIds)
      await payload.delete({ collection: 'clinicGroups', id, overrideAccess: false, user: support })
    for (const id of treatmentIds)
      await payload.delete({ collection: 'treatments', id, overrideAccess: true, trash: true })
    for (const id of specialtyIds)
      await payload.delete({ collection: 'medical-specialties', id, overrideAccess: true, trash: true })
    for (const id of keyIds) await payload.delete({ collection: 'payload-mcp-api-keys', id, overrideAccess: true })
    await cleanupTrackedUsers(payload, { staffIds })
  })

  it('allows an explicitly authorized support key to create and update clinic coordinates', async () => {
    const apiKey = randomUUID()
    const key = await payload.create({
      collection: 'payload-mcp-api-keys',
      overrideAccess: true,
      data: {
        user: support.id,
        label: `${prefix}-clinic-write`,
        enableAPIKey: true,
        apiKey,
        clinics: { find: true, create: true, update: true },
        clinicGroups: { find: true },
        doctors: { create: true, update: true },
        doctorspecialties: { create: true, update: true },
        clinictreatments: { create: true, update: true },
        doctortreatments: { create: true, update: true },
        ...{
          'payload-mcp-tool': {
            trashClinic: true,
            trashDoctor: true,
            deleteDoctorSpecialty: true,
            deleteClinicTreatment: true,
            deleteDoctorTreatment: true,
          },
        },
      },
    })
    keyIds.push(key.id)
    const endpoint = payload.config.endpoints.find((entry) => entry.path === '/mcp' && entry.method === 'post')
    if (!endpoint) throw new Error('Expected the MCP POST endpoint')

    const call = async (name: string, args: Record<string, unknown>, token = apiKey) => {
      const request = new Request('http://localhost:3000/api/mcp', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
      })
      const req = await createLocalReq(
        { req: { method: request.method, url: request.url, headers: request.headers, body: request.body } },
        payload,
      )
      const response = await endpoint.handler(req)
      expect(response.status).toBe(200)
      const text = await response.text()
      const result = JSON.parse(
        text.startsWith('data:') || text.includes('\ndata:')
          ? text
              .split('\n')
              .find((line) => line.startsWith('data:'))!
              .slice(5)
              .trim()
          : text,
      )
      return (result.result?.content?.[0]?.text ?? result.error?.message ?? '') as string
    }

    const name = `${prefix}-coordinates`
    expect(await call('createClinics', {})).toContain('name')
    const group = await payload.create({
      collection: 'clinicGroups',
      data: { name: `${prefix} test group` },
      overrideAccess: false,
      user: admin,
    })
    groupIds.push(group.id)
    expect(await call('findClinicGroups', { id: group.id })).toContain(group.name)

    const directName = `${prefix} direct automatic slug`
    expect(
      await call('createClinics', {
        name: directName,
        group: group.id,
        coordinates: { longitude: 28.9784, latitude: 41.0082 },
      }),
    ).toContain('Resource created successfully')
    const direct = await payload.find({
      collection: 'clinics',
      depth: 0,
      where: { name: { equals: directName } },
      overrideAccess: true,
    })
    expect(direct.docs).toHaveLength(1)
    clinicIds.push(direct.docs[0]!.id)
    expect(direct.docs[0]!.slug).toBeTruthy()
    expect(direct.docs[0]!.group).toEqual(group.id)
    expect(direct.docs[0]!.coordinates).toEqual([28.9784, 41.0082])

    const city = (await payload.find({ collection: 'cities', depth: 0, limit: 1, overrideAccess: true })).docs[0]!
    const country = typeof city.country === 'object' ? city.country.id : city.country
    const clinicSlug = direct.docs[0]!.slug!
    expect(
      await call('updateClinics', {
        id: direct.docs[0]!.id,
        address: { city: city.id, country, street: 'Test street', houseNumber: '1', zipCode: '34000' },
        internalPrimaryContact: {
          firstName: 'Test',
          lastName: 'Contact',
          email: 'test@example.com',
          role: 'Clinic Management',
        },
        supportedLanguages: ['english'],
      }),
    ).toContain('Document updated successfully')

    const expectInvalidation = () => {
      expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith(`/clinics/${clinicSlug}`)
      expect(vi.mocked(revalidateTag)).toHaveBeenCalledWith('collection:clinics', { expire: 0 })
    }
    const publicClinicCount = async () =>
      (
        await payload.find({
          collection: 'clinics',
          where: { id: { equals: direct.docs[0]!.id } },
          overrideAccess: false,
        })
      ).totalDocs

    expect(await publicClinicCount()).toBe(0)
    vi.clearAllMocks()
    expect(await call('updateClinics', { id: direct.docs[0]!.id, status: 'approved' })).toContain(
      'Document updated successfully',
    )
    expect(await publicClinicCount()).toBe(1)
    expectInvalidation()
    vi.clearAllMocks()
    expect(await call('updateClinics', { id: direct.docs[0]!.id, status: 'draft' })).toContain(
      'Document updated successfully',
    )
    expect(await publicClinicCount()).toBe(0)
    expectInvalidation()
    expect(await call('updateClinics', { id: direct.docs[0]!.id, status: 'approved' })).toContain(
      'Document updated successfully',
    )
    vi.clearAllMocks()
    expect(await call('trashClinic', { id: direct.docs[0]!.id })).toContain('moved to trash')
    expect(await publicClinicCount()).toBe(0)
    expectInvalidation()
    const createdText = await call('createClinics', {
      name,
      slug: name,
      coordinates: { longitude: 28.9784, latitude: 41.0082 },
    })
    expect(createdText).toContain('Resource created successfully')
    const created = await payload.find({
      collection: 'clinics',
      where: { name: { equals: name } },
      overrideAccess: true,
    })
    expect(created.docs).toHaveLength(1)
    clinicIds.push(created.docs[0]!.id)
    expect(created.docs[0]!.coordinates).toEqual([28.9784, 41.0082])

    const updatedText = await call('updateClinics', {
      id: created.docs[0]!.id,
      coordinates: { longitude: 29, latitude: 41 },
    })
    expect(updatedText).toContain('Document updated successfully')
    const updated = await payload.findByID({ collection: 'clinics', id: created.docs[0]!.id, overrideAccess: true })
    expect(updated.coordinates).toEqual([29, 41])

    const readOnlyKey = randomUUID()
    const readOnly = await payload.create({
      collection: 'payload-mcp-api-keys',
      overrideAccess: true,
      data: {
        user: support.id,
        label: `${prefix}-clinic-read-only`,
        enableAPIKey: true,
        apiKey: readOnlyKey,
        clinics: { find: true },
      },
    })
    keyIds.push(readOnly.id)
    expect(await call('findClinicGroups', { id: group.id }, readOnlyKey)).not.toContain(group.name)
    const deniedName = `${prefix}-denied`
    const deniedText = await call('createClinics', { name: deniedName }, readOnlyKey)
    expect(deniedText).not.toContain('Resource created successfully')
    const denied = await payload.find({
      collection: 'clinics',
      where: { name: { equals: deniedName } },
      overrideAccess: true,
    })
    expect(denied.docs).toHaveLength(0)

    const staff = await createPlatformTestUser(payload, { emailPrefix: `${prefix}-editor`, createdStaffIds: staffIds })
    const editor = await payload.update({
      collection: 'platformStaff',
      id: staff.id,
      data: { role: 'content-manager' },
      context: { trustedPlatformStaffOps: true },
      overrideAccess: true,
    })
    const editorToken = randomUUID()
    const editorKey = await payload.create({
      collection: 'payload-mcp-api-keys',
      overrideAccess: true,
      data: {
        user: editor.id,
        label: `${prefix}-editor`,
        enableAPIKey: true,
        apiKey: editorToken,
        clinics: { create: true },
        clinicGroups: { find: true },
      },
    })
    keyIds.push(editorKey.id)
    const editorName = `${prefix}-editor-denied`
    expect(await call('findClinicGroups', { id: group.id }, editorToken)).not.toContain(group.name)
    const editorResult = await call('createClinics', { name: editorName }, editorToken)
    expect(editorResult).not.toContain('Resource created successfully')
    const editorDocs = await payload.find({
      collection: 'clinics',
      where: { name: { equals: editorName } },
      overrideAccess: true,
    })
    expect(editorDocs.docs).toHaveLength(0)

    const doctorFirstName = `${prefix}-doctor`
    const doctorCreated = await call('createDoctors', {
      firstName: doctorFirstName,
      lastName: 'Doctor',
      fullName: 'Test Doctor',
      active: false,
      gender: 'female',
      clinic: created.docs[0]!.id,
      qualifications: ['Test'],
      languages: ['english'],
    })
    expect(doctorCreated).toContain('Resource created successfully')
    const doctorResult = await payload.find({
      collection: 'doctors',
      where: { firstName: { equals: doctorFirstName } },
      overrideAccess: true,
    })
    expect(doctorResult.docs).toHaveLength(1)
    const doctor = doctorResult.docs[0]!
    expect(doctor.slug).toBeTruthy()
    doctorIds.push(doctor.id)
    const specialty = await payload.create({
      collection: 'medical-specialties',
      overrideAccess: true,
      data: { name: `${prefix}-specialty`, iconKey: 'fallback' },
    })
    specialtyIds.push(specialty.id)
    const treatment = await payload.create({
      collection: 'treatments',
      overrideAccess: true,
      data: {
        name: `${prefix}-treatment`,
        description: buildRichText('Synthetic treatment'),
        medicalSpecialty: specialty.id,
      } as unknown as Treatment,
    })
    treatmentIds.push(treatment.id)
    expect(
      await call('createClinictreatments', {
        clinic: created.docs[0]!.id,
        treatment: treatment.id,
        price: 120,
        active: false,
      }),
    ).toContain('Resource created successfully')
    const clinicOffer = (
      await payload.find({
        collection: 'clinictreatments',
        where: { clinic: { equals: created.docs[0]!.id } },
        overrideAccess: true,
      })
    ).docs[0]!
    clinicTreatmentIds.push(clinicOffer.id)
    expect(await call('updateClinictreatments', { id: clinicOffer.id, price: 150, active: true })).toContain(
      'Document updated successfully',
    )
    expect(
      await payload.findByID({ collection: 'clinictreatments', id: clinicOffer.id, overrideAccess: true }),
    ).toMatchObject({ price: 150, active: true })
    expect(await call('deleteClinicTreatment', { id: clinicOffer.id }, readOnlyKey)).not.toContain('deleted')
    expect(await call('deleteClinicTreatment', { id: clinicOffer.id })).toContain('deleted')
    clinicTreatmentIds.pop()
    expect(
      await call('createDoctortreatments', {
        doctor: doctor.id,
        treatment: treatment.id,
        specializationLevel: 'specialist',
      }),
    ).toContain('Resource created successfully')
    const doctorOffer = (
      await payload.find({
        collection: 'doctortreatments',
        where: { doctor: { equals: doctor.id } },
        overrideAccess: true,
      })
    ).docs[0]!
    doctorTreatmentIds.push(doctorOffer.id)
    expect(
      await call('updateDoctortreatments', {
        id: doctorOffer.id,
        specializationLevel: 'sub_specialist',
        treatmentsPerformed: 500,
      }),
    ).toContain('Document updated successfully')
    expect(
      await payload.findByID({ collection: 'doctortreatments', id: doctorOffer.id, overrideAccess: true }),
    ).toMatchObject({ specializationLevel: 'sub_specialist', treatmentsPerformed: null })
    expect(await call('deleteDoctorTreatment', { id: doctorOffer.id })).toContain('deleted')
    doctorTreatmentIds.pop()
    expect(await payload.findByID({ collection: 'treatments', id: treatment.id, overrideAccess: true })).toBeTruthy()
    const linkCreated = await call('createDoctorspecialties', {
      doctor: doctor.id,
      medicalSpecialty: specialty.id,
      specializationLevel: 'beginner',
    })
    expect(linkCreated).toContain('Resource created successfully')
    const links = await payload.find({
      collection: 'doctorspecialties',
      where: { doctor: { equals: doctor.id } },
      overrideAccess: true,
    })
    expect(links.docs).toHaveLength(1)
    const link = links.docs[0]!
    doctorSpecialtyIds.push(link.id)
    const linkUpdated = await call('updateDoctorspecialties', { id: link.id, specializationLevel: 'advanced' })
    expect(linkUpdated).toContain('Document updated successfully')
    const deniedDelete = await call('deleteDoctorSpecialty', { id: link.id }, readOnlyKey)
    expect(deniedDelete).not.toContain('deleted')
    await expect(
      payload.findByID({ collection: 'doctorspecialties', id: link.id, overrideAccess: true }),
    ).resolves.toMatchObject({ id: link.id })
    const deletedLink = await call('deleteDoctorSpecialty', { id: link.id })
    expect(deletedLink).toContain('deleted')
    doctorSpecialtyIds.pop()
    await expect(
      payload.findByID({ collection: 'doctors', id: doctor.id, overrideAccess: true }),
    ).resolves.toMatchObject({ id: doctor.id })
    await expect(
      payload.findByID({ collection: 'medical-specialties', id: specialty.id, overrideAccess: true }),
    ).resolves.toMatchObject({ id: specialty.id })
    await call('updateDoctors', { id: doctor.id, deletedAt: new Date().toISOString() })
    const doctorAfterUpdate = await payload.findByID({
      collection: 'doctors',
      id: doctor.id,
      overrideAccess: true,
      trash: true,
    })
    expect(doctorAfterUpdate.deletedAt).toBeFalsy()
    const trashedDoctor = await call('trashDoctor', { id: doctor.id })
    expect(trashedDoctor).toContain('moved to trash')
    const storedDoctor = await payload.findByID({
      collection: 'doctors',
      id: doctor.id,
      overrideAccess: true,
      trash: true,
    })
    expect(storedDoctor.deletedAt).toBeTruthy()

    const deniedTrash = await call('trashClinic', { id: created.docs[0]!.id }, readOnlyKey)
    expect(deniedTrash).not.toContain('moved to trash')
    const stillActive = await payload.findByID({ collection: 'clinics', id: created.docs[0]!.id, overrideAccess: true })
    expect(stillActive.deletedAt).toBeFalsy()

    const editToken = randomUUID()
    const editKey = await payload.create({
      collection: 'payload-mcp-api-keys',
      overrideAccess: true,
      data: {
        user: support.id,
        label: `${prefix}-edit-only`,
        enableAPIKey: true,
        apiKey: editToken,
        clinics: { update: true },
      },
    })
    keyIds.push(editKey.id)
    await call('updateClinics', { id: created.docs[0]!.id, deletedAt: new Date().toISOString() }, editToken)
    const afterEditAttempt = await payload.findByID({
      collection: 'clinics',
      id: created.docs[0]!.id,
      overrideAccess: true,
      trash: true,
    })
    expect(afterEditAttempt.deletedAt).toBeFalsy()

    const trashed = await call('trashClinic', { id: created.docs[0]!.id })
    expect(trashed).toContain('moved to trash')
    const stored = await payload.findByID({
      collection: 'clinics',
      id: created.docs[0]!.id,
      overrideAccess: true,
      trash: true,
    })
    expect(stored.deletedAt).toBeTruthy()
  })

  it('lets an administrator manage their bound key and denies a stale administrator after role removal', async () => {
    const key = await payload.create({
      collection: 'payload-mcp-api-keys',
      user: admin,
      overrideAccess: false,
      data: { user: support.id, label: `${prefix}-managed`, enableAPIKey: true, apiKey: randomUUID() },
    })
    keyIds.push(key.id)
    expect(key.user).toMatchObject({ id: admin.id })
    expect(
      (
        await payload.findByID({
          collection: 'payload-mcp-api-keys',
          id: key.id,
          user: admin,
          overrideAccess: false,
        })
      ).id,
    ).toBe(key.id)
    const updated = await payload.update({
      collection: 'payload-mcp-api-keys',
      id: key.id,
      data: { user: support.id, label: `${prefix}-updated` },
      user: admin,
      overrideAccess: false,
    })
    expect(updated).toMatchObject({ label: `${prefix}-updated`, user: { id: admin.id } })
    await payload.update({
      collection: 'platformStaff',
      id: admin.id,
      data: { role: 'content-manager' },
      context: { trustedPlatformStaffOps: true },
      overrideAccess: true,
    })

    for (const user of [admin, support]) {
      await expect(
        payload.find({ collection: 'payload-mcp-api-keys', user, overrideAccess: false }),
      ).rejects.toMatchObject({ status: 403 })
      await expect(
        payload.create({
          collection: 'payload-mcp-api-keys',
          user,
          overrideAccess: false,
          data: { user: user.id, label: 'Blocked' },
        }),
      ).rejects.toMatchObject({ status: 403 })
      await expect(
        payload.update({
          collection: 'payload-mcp-api-keys',
          id: key.id,
          user,
          overrideAccess: false,
          data: { user: user.id, label: 'Blocked' },
        }),
      ).rejects.toMatchObject({ status: 403 })
      await expect(
        payload.delete({ collection: 'payload-mcp-api-keys', id: key.id, user, overrideAccess: false }),
      ).rejects.toMatchObject({ status: 403 })
    }
  })

  it('uses an existing support-owned key through the real MCP endpoint while management stays forbidden', async () => {
    const apiKey = randomUUID()
    const key = await payload.create({
      collection: 'payload-mcp-api-keys',
      overrideAccess: true,
      data: { user: support.id, label: `${prefix}-existing`, enableAPIKey: true, apiKey, posts: { find: true } },
    })
    keyIds.push(key.id)
    await expect(
      payload.findByID({
        collection: 'payload-mcp-api-keys',
        id: key.id,
        user: support,
        overrideAccess: false,
      }),
    ).rejects.toMatchObject({ status: 403 })

    const endpoint = payload.config.endpoints.find((entry) => entry.path === '/mcp' && entry.method === 'post')
    if (!endpoint) throw new Error('Expected the MCP POST endpoint')
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
        params: { name: 'findPosts', arguments: { limit: 1 } },
      }),
    })
    const req = await createLocalReq(
      {
        req: {
          method: request.method,
          url: request.url,
          headers: request.headers,
          body: request.body,
        },
      },
      payload,
    )
    const response = await endpoint.handler(req)
    expect(response.status).toBe(200)
    const text = await response.text()
    const result = JSON.parse(
      text.startsWith('data:') || text.includes('\ndata:')
        ? text
            .split('\n')
            .find((line) => line.startsWith('data:'))!
            .slice(5)
            .trim()
        : text,
    )
    expect(result.error).toBeUndefined()
    expect(result.result.content[0].text).toContain('Collection: "posts"')
    expect(req.user).toMatchObject({ id: support.id, collection: 'platformStaff', role: 'support' })
  })
})
