import { randomUUID } from 'node:crypto'
import { DeleteObjectsCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createLocalReq, getPayload, ValidationError, type Payload, type PayloadRequest } from 'payload'
import { readGalleryCreateFailure } from 'payload/gallery-upload-provenance'
import {
  readColdGalleryControlFailure,
  readGalleryNativeProvenance,
} from '@/features/clinicNotifications/coldAuthorizationControl'
import sharp from 'sharp'
import config from '@payload-config'
import { clinicDashboardGalleryMediaPostHandler } from '@/endpoints/clinicDashboardGallery'
import { resolveS3StorageConfig } from '@/plugins/storageConfig'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import {
  asClinicScopedPayloadUser,
  createClinicTestUser,
  cleanupTrackedUsers,
  createPlatformTestUser,
  asPayloadStaffUser,
} from '../fixtures/testUsers'
import { changeClinicGroup } from '@/features/clinicGroups/membership'
import { clinicGalleryConstraints } from '@/features/clinicDashboard/gallery/contracts'
import { replaceClinicStaffAssignment } from '@/features/clinicGroups/staffAssignments'
import { testSlug } from '../fixtures/testSlug'

const identity = vi.hoisted(() => ({ validate: vi.fn() }))
// Only the external identity provider is synthetic. Native rights, rows, owners and S3 remain real.
vi.mock('@/auth/utilities/jwtValidation', async (original) => ({
  ...(await original<typeof import('@/auth/utilities/jwtValidation')>()),
  validateSupabaseBearerToken: identity.validate,
}))

describe('cold native clinic gallery upload protocol', () => {
  let payload: Payload
  let city: { id: number; country: number }
  const prefix = `${testSlug('clinicGalleryUpload.protocol.test.ts')}-${randomUUID().slice(0, 8)}`
  const clinics: number[] = []
  const mediaIds: number[] = []
  const doctorIds: number[] = []
  const tagIds: number[] = []
  const orphanKeys = new Set<string>()
  const groups: Array<{ id: number; operator: PayloadRequest; staffId: number }> = []
  const staffIds: Array<number | string> = []
  const storage = resolveS3StorageConfig({ ...process.env, DEPLOYMENT_ENV: 'test' })
  const s3 = new S3Client(storage.clientConfig)

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
    city = (await payload.find({ collection: 'cities', limit: 1, depth: 0, overrideAccess: true }))
      .docs[0] as typeof city
  }, 60000)

  afterAll(async () => {
    if (!payload) return
    for (const id of mediaIds)
      await payload.delete({ collection: 'clinicMedia', id, overrideAccess: true, trash: true })
    for (const group of groups) {
      await replaceClinicStaffAssignment(group.operator, group.staffId, { scope: 'unassigned' })
      await payload.delete({ collection: 'clinicGroups', id: group.id, req: group.operator, overrideAccess: false })
    }
    await cleanupTrackedUsers(payload, { staffIds })
    for (const id of doctorIds) await payload.delete({ collection: 'doctors', id, overrideAccess: true })
    for (const id of tagIds) await payload.delete({ collection: 'tags', id, overrideAccess: true })
    for (const id of clinics) await payload.delete({ collection: 'clinics', id, overrideAccess: true })
    if (orphanKeys.size)
      await s3.send(
        new DeleteObjectsCommand({
          Bucket: storage.bucket,
          Delete: { Objects: [...orphanKeys].map((Key) => ({ Key })) },
        }),
      )
    s3.destroy()
  })

  const nativeSessions = () => {
    if (!payload.db.sessions) throw new Error('Expected native test sessions')
    return payload.db.sessions
  }

  const coldClinic = async (group?: number, req?: PayloadRequest) => {
    const slug = `${prefix}-${randomUUID()}`
    // A Doctor fixture would already acquire the Clinic control. Create only the actual owning clinic.
    const clinic = await payload.create({
      collection: 'clinics',
      overrideAccess: true,
      depth: 0,
      req,
      data: {
        ...(group === undefined ? {} : { group }),
        name: slug,
        slug,
        status: 'approved',
        participationStatus: 'approved',
        address: { street: 'Fixture Street', houseNumber: '1', zipCode: '10000', city: city.id, country: city.country },
        contact: { email: `${slug}@example.com`, phoneNumber: '+1000000000' },
        internalPrimaryContact: {
          firstName: 'Native',
          lastName: 'Fixture',
          email: `${slug}-contact@example.com`,
          role: 'Clinic Management',
        },
        supportedLanguages: ['english'],
      },
    })
    clinics.push(clinic.id)
    return clinic
  }

  const synchronizeColdReads = async (clinicId: number) => {
    const key = `notification-authorization:clinic:${clinicId}`
    expect(
      (
        await payload.find({
          collection: 'clinicNotificationControls',
          where: { key: { equals: key } },
          depth: 0,
          overrideAccess: true,
        })
      ).docs,
    ).toEqual([])
    let arrived = 0
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const hooks = payload.collections.clinicNotificationControls.config.hooks
    const original = hooks.afterOperation ?? []
    const checkpoint = async ({
      operation,
      args,
      result,
    }: {
      operation: string
      args: { where?: unknown }
      result: unknown
    }) => {
      if (
        operation === 'find' &&
        JSON.stringify(args.where) === JSON.stringify({ key: { equals: key } }) &&
        (result as { docs?: unknown[] }).docs?.length === 0 &&
        arrived < 3
      ) {
        arrived++
        if (arrived === 3) release()
        await gate
      }
      return result
    }
    hooks.afterOperation = [...original, checkpoint as never]
    return {
      arrivals: () => arrived,
      restore: () => {
        release()
        hooks.afterOperation = original
      },
    }
  }

  const assertExactObjects = async (clinicId: number, mode: 'direct' | 'http') => {
    const docs = (
      await payload.find({
        collection: 'clinicMedia',
        where: { clinic: { equals: clinicId } },
        limit: 20,
        depth: 0,
        overrideAccess: true,
      })
    ).docs
    mediaIds.push(...docs.map((doc) => doc.id))
    expect(docs).toHaveLength(3)
    const expected = docs
      .flatMap((doc) => [
        doc.storagePath,
        ...Object.values(doc.sizes ?? {}).flatMap((size) =>
          size?.filename ? [`clinics/${size.filename.replace(/^clinics\//u, '')}`] : [],
        ),
      ])
      .sort()
    expect(new Set(expected).size).toBe(expected.length)
    const listed = await s3.send(new ListObjectsV2Command({ Bucket: storage.bucket, Prefix: 'clinics/' }))
    expect(
      (listed.Contents ?? [])
        .map((object) => object.Key)
        .filter((key) => key?.includes(`${prefix}-${mode}-`))
        .sort(),
    ).toEqual(expected)
    for (const key of expected) {
      const response = await fetch(new URL(`${storage.bucket}/${key}`, `${storage.clientConfig.endpoint}/`))
      expect(response.status).toBe(200)
      expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(0)
    }
    return docs
  }

  it('accepts three cold direct native creates with exactly three persisted media and S3 object sets', async () => {
    const clinic = await coldClinic()
    const checkpoint = await synchronizeColdReads(clinic.id)
    const requests: PayloadRequest[] = []
    const controlHooks = payload.collections.clinicNotificationControls.config.hooks
    const originalControlHooks = controlHooks.beforeOperation ?? []
    controlHooks.beforeOperation = [
      ...originalControlHooks,
      async ({ args, req, operation }) => {
        if (
          operation === 'create' &&
          (args as { data?: { key?: string } }).data?.key === `notification-authorization:clinic:${clinic.id}`
        )
          req.transactionID = await req.transactionID
      },
    ]
    const originalRollback = payload.db.rollbackTransaction.bind(payload.db)
    const rollbackOutcomes: boolean[] = []
    const rollbackSpy = vi.spyOn(payload.db, 'rollbackTransaction').mockImplementation(async (...args) => {
      const result = await originalRollback(...args)
      rollbackOutcomes.push(Boolean(result))
      return result
    })
    const nativeHooks = payload.collections.clinicMedia.config.hooks
    const originalHooks = nativeHooks.beforeOperation ?? []
    nativeHooks.beforeOperation = [
      ({ req, operation }) => {
        if (operation === 'create') requests.push(req)
      },
      ...originalHooks,
    ]
    try {
      const bytes = await sharp({ create: { width: 1400, height: 1000, channels: 3, background: '#526b7a' } })
        .jpeg()
        .toBuffer()
      const results = await Promise.all(
        Array.from({ length: 3 }, (_, index) =>
          payload.create({
            collection: 'clinicMedia',
            data: { clinic: clinic.id, alt: `Cold native ${index}` },
            overrideAccess: true,
            file: { data: bytes, size: bytes.length, name: `${prefix}-direct-${index}.jpg`, mimetype: 'image/jpeg' },
          } as Parameters<Payload['create']>[0]),
        ),
      )
      expect(results).toHaveLength(3)
      expect(requests).toHaveLength(5)
      expect(rollbackOutcomes.filter(Boolean)).toHaveLength(2)
      expect(rollbackOutcomes.filter((value) => !value)).toHaveLength(2)
      expect(checkpoint.arrivals()).toBe(3)
      await assertExactObjects(clinic.id, 'direct')
    } catch (error) {
      if (error && typeof error === 'object') {
        const mapped = requests.map((req) => readGalleryNativeProvenance(req)?.readUniqueFailure(error)).find(Boolean)
        const cold = readColdGalleryControlFailure(error)
        console.info('Candidate C closed evidence diagnostic', {
          mapped: Boolean(mapped),
          code: mapped?.code,
          collection: mapped?.collection,
          table: mapped?.table,
          field: mapped?.field,
          initializer: Boolean(cold),
          owners: requests.map((req) => {
            const native = readGalleryCreateFailure(error, req)
            return {
              native: Boolean(native),
              owned: native?.owned,
              phase: native?.phase,
              idMatches: native?.transactionID === cold?.transactionID,
              receipts: native?.rollbacks.map((receipt) => {
                const rollback = readGalleryNativeProvenance(req)?.readRollback(receipt)
                return {
                  trusted: Boolean(rollback),
                  adapterMatches: rollback?.adapter === payload.db,
                  idMatches: rollback?.transactionID === native?.transactionID,
                }
              }),
            }
          }),
        })
      }
      throw error
    } finally {
      checkpoint.restore()
      nativeHooks.beforeOperation = originalHooks
      controlHooks.beforeOperation = originalControlHooks
      rollbackSpy.mockRestore()
    }
  }, 30000)

  it('accepts three actual multipart handlers without an outer owner and returns exactly three minimized 201 results', async () => {
    const clinic = await coldClinic()
    const staff = await createClinicTestUser(payload, { createdStaffIds: staffIds, emailPrefix: `${prefix}-http` })
    const origin = await coldClinic()
    const user = await asClinicScopedPayloadUser(payload, staff, origin.id)
    const platform = await createPlatformTestUser(payload, {
      createdStaffIds: staffIds,
      emailPrefix: `${prefix}-operator`,
    })
    const operator = await createLocalReq({ user: asPayloadStaffUser(platform) }, payload)
    await replaceClinicStaffAssignment(operator, staff.id, { scope: 'local', clinicId: clinic.id })
    identity.validate.mockResolvedValue({
      status: 'authenticated',
      authData: { userType: 'clinic', supabaseUserId: user.supabaseUserId },
    })
    const checkpoint = await synchronizeColdReads(clinic.id)
    try {
      const bytes = await sharp({ create: { width: 1400, height: 1000, channels: 3, background: '#526b7a' } })
        .jpeg()
        .toBuffer()
      const results = await Promise.all(
        Array.from({ length: 3 }, async (_, index) => {
          const form = new FormData()
          form.append('_payload', JSON.stringify({ alt: `HTTP cold ${index}` }))
          form.append('file', new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' }), `${prefix}-http-${index}.jpg`)
          const request = new Request('http://localhost:3000/api/clinic-dashboard/gallery', {
            method: 'POST',
            body: form,
            headers: {
              Authorization: 'Bearer synthetic-native-gallery',
              'X-Findmydoc-Clinic-Scope-Contract': 'clinic-scope-v1',
            },
          })
          const req = await createLocalReq({ user, req: request as Partial<PayloadRequest> }, payload)
          req.routeParams = { clinicId: String(clinic.id) }
          expect(req.transactionID).toBeUndefined()
          const response = await clinicDashboardGalleryMediaPostHandler(req)
          expect(response.status).toBe(201)
          expect(response.headers.get('Cache-Control')).toContain('no-store')
          return response.json()
        }),
      )
      expect(new Set(results.map((result) => result.id)).size).toBe(3)
      expect(checkpoint.arrivals()).toBe(3)
      const stored = await assertExactObjects(clinic.id, 'http')
      for (const doc of stored) expect(doc.createdBy).toEqual({ relationTo: 'clinicStaff', value: user.id })
      for (const result of results) {
        expect(result).not.toHaveProperty('storagePath')
        expect(result).not.toHaveProperty('createdBy')
      }
    } finally {
      checkpoint.restore()
    }
  }, 30000)

  it.each(['missing', 'rejected'] as const)(
    'refuses replay when the original native rollback is %s',
    async (mode) => {
      const clinic = await coldClinic()
      const checkpoint = await synchronizeColdReads(clinic.id)
      const hooks = payload.collections.clinicMedia.config.hooks
      const originalHooks = hooks.beforeOperation ?? []
      let attempts = 0
      hooks.beforeOperation = [
        ({ operation }) => {
          if (operation === 'create') attempts++
        },
        ...originalHooks,
      ]
      const originalRollback = payload.db.rollbackTransaction.bind(payload.db)
      const hidden = new Map<string | number, NonNullable<Payload['db']['sessions']>[string]>()
      const spy = vi.spyOn(payload.db, 'rollbackTransaction').mockImplementation(async (id) => {
        const resolved = await id
        if (resolved && mode === 'missing' && nativeSessions()[resolved]) {
          hidden.set(resolved, nativeSessions()[resolved]!)
          delete nativeSessions()[resolved]
        }
        const result = await originalRollback(id)
        if (mode === 'rejected' && result) throw new Error('Synthetic native rollback acknowledgement loss')
        return result
      })
      try {
        const bytes = await sharp({ create: { width: 20, height: 20, channels: 3, background: '#526b7a' } })
          .png()
          .toBuffer()
        const results = await Promise.allSettled(
          Array.from({ length: 3 }, (_, index) =>
            payload.create({
              collection: 'clinicMedia',
              data: { clinic: clinic.id, alt: `Rollback refusal ${index}` },
              overrideAccess: true,
              file: {
                data: bytes,
                size: bytes.length,
                name: `${prefix}-rollback-${mode}-${index}.png`,
                mimetype: 'image/png',
              },
            } as Parameters<Payload['create']>[0]),
          ),
        )
        expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
        expect(results.filter((result) => result.status === 'rejected')).toHaveLength(2)
        expect(attempts).toBe(3)
        const docs = (
          await payload.find({
            collection: 'clinicMedia',
            where: { clinic: { equals: clinic.id } },
            depth: 0,
            overrideAccess: true,
          })
        ).docs
        mediaIds.push(...docs.map((doc) => doc.id))
        expect(docs).toHaveLength(1)
      } finally {
        checkpoint.restore()
        hooks.beforeOperation = originalHooks
        spy.mockRestore()
        // Restore only the captured original sessions to let their existing native rollback finish.
        for (const [id, session] of hidden) {
          nativeSessions()[id] = session
          await originalRollback(id)
        }
      }
    },
    30000,
  )

  it('does not replay a borrowed media create inside a different native business owner', async () => {
    const target = await coldClinic()
    const owners = await Promise.all(Array.from({ length: 3 }, () => coldClinic()))
    for (const owner of owners)
      await payload.update({ collection: 'clinics', id: owner.id, data: { name: owner.name }, overrideAccess: true })
    const checkpoint = await synchronizeColdReads(target.id)
    const hooks = payload.collections.doctors.config.hooks
    const originalHooks = hooks.beforeChange ?? []
    let nestedAttempts = 0
    const bytes = await sharp({ create: { width: 20, height: 20, channels: 3, background: '#526b7a' } })
      .png()
      .toBuffer()
    hooks.beforeChange = [
      ...originalHooks,
      async ({ data, req }) => {
        if (typeof data.slug === 'string' && data.slug.startsWith(`${prefix}-borrowed-`)) {
          expect(req.transactionID).toBeDefined()
          nestedAttempts++
          await payload.create({
            collection: 'clinicMedia',
            data: { clinic: target.id, alt: data.slug },
            req,
            overrideAccess: true,
            file: { data: bytes, size: bytes.length, name: `${data.slug}.png`, mimetype: 'image/png' },
          } as Parameters<Payload['create']>[0])
        }
        return data
      },
    ]
    try {
      const results = await Promise.allSettled(
        owners.map((owner, index) =>
          payload.create({
            collection: 'doctors',
            overrideAccess: true,
            data: {
              firstName: 'Native',
              lastName: 'Borrowed',
              fullName: 'Native Borrowed',
              gender: 'male',
              active: true,
              clinic: owner.id,
              languages: ['english'],
              qualifications: ['MD'],
              slug: `${prefix}-borrowed-${index}`,
            },
          }),
        ),
      )
      for (const result of results) if (result.status === 'fulfilled') doctorIds.push(result.value.id)
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
      expect(results.filter((result) => result.status === 'rejected')).toHaveLength(2)
      expect(nestedAttempts).toBe(3)
      const docs = (
        await payload.find({
          collection: 'clinicMedia',
          where: { clinic: { equals: target.id } },
          depth: 0,
          overrideAccess: true,
        })
      ).docs
      mediaIds.push(...docs.map((doc) => doc.id))
      expect(docs).toHaveLength(1)
    } finally {
      checkpoint.restore()
      hooks.beforeChange = originalHooks
    }
  }, 30000)

  it('does not replay after real media and S3 persistence followed by a rejected hook', async () => {
    const clinic = await coldClinic()
    const hooks = payload.collections.clinicMedia.config.hooks
    const originalBefore = hooks.beforeOperation ?? []
    const originalAfter = hooks.afterChange ?? []
    const failure = new Error('Synthetic failure after real media storage')
    let attempts = 0
    hooks.beforeOperation = [
      ({ operation }) => {
        if (operation === 'create') attempts++
      },
      ...originalBefore,
    ]
    hooks.afterChange = [
      ...originalAfter,
      () => {
        throw failure
      },
    ]
    try {
      const bytes = await sharp({ create: { width: 20, height: 20, channels: 3, background: '#526b7a' } })
        .png()
        .toBuffer()
      await expect(
        payload.create({
          collection: 'clinicMedia',
          data: { clinic: clinic.id },
          overrideAccess: true,
          file: { data: bytes, size: bytes.length, name: `${prefix}-post-upload.png`, mimetype: 'image/png' },
        } as Parameters<Payload['create']>[0]),
      ).rejects.toBe(failure)
      expect(attempts).toBe(1)
      expect(
        (
          await payload.find({
            collection: 'clinicMedia',
            where: { clinic: { equals: clinic.id } },
            overrideAccess: true,
          })
        ).docs,
      ).toEqual([])
      const objects = await s3.send(new ListObjectsV2Command({ Bucket: storage.bucket, Prefix: 'clinics/' }))
      const orphaned = (objects.Contents ?? []).filter((object) => object.Key?.includes(`${prefix}-post-upload`))
      expect(orphaned.length).toBeGreaterThan(0)
      for (const object of orphaned) if (object.Key) orphanKeys.add(object.Key)
    } finally {
      hooks.beforeOperation = originalBefore
      hooks.afterChange = originalAfter
    }
  })

  it('keeps an uncertain native commit as one submitted attempt and permits readonly persisted readback', async () => {
    const clinic = await coldClinic()
    const commit = payload.db.commitTransaction.bind(payload.db)
    const failure = new Error('Synthetic commit acknowledgement loss')
    const spy = vi.spyOn(payload.db, 'commitTransaction').mockImplementation(async (...args) => {
      await commit(...args)
      throw failure
    })
    try {
      const bytes = await sharp({ create: { width: 20, height: 20, channels: 3, background: '#526b7a' } })
        .png()
        .toBuffer()
      await expect(
        payload.create({
          collection: 'clinicMedia',
          data: { clinic: clinic.id },
          overrideAccess: true,
          file: { data: bytes, size: bytes.length, name: `${prefix}-commit-unknown.png`, mimetype: 'image/png' },
        } as Parameters<Payload['create']>[0]),
      ).rejects.toBe(failure)
      expect(spy).toHaveBeenCalledOnce()
      const docs = (
        await payload.find({
          collection: 'clinicMedia',
          where: { clinic: { equals: clinic.id } },
          overrideAccess: true,
          depth: 0,
        })
      ).docs
      mediaIds.push(...docs.map((doc) => doc.id))
      expect(docs).toHaveLength(1)
      const object = await fetch(
        new URL(`${storage.bucket}/${docs[0]!.storagePath}`, `${storage.clientConfig.endpoint}/`),
      )
      expect(object.status).toBe(200)
    } finally {
      spy.mockRestore()
    }
  })

  it.each(['missing', 'promise', 'replacement'] as const)(
    'rejects %s original owner before upload and never rolls back a foreign owner',
    async (mode) => {
      const clinic = await coldClinic()
      const foreignClinic = await coldClinic()
      const bytes = await sharp({ create: { width: 20, height: 20, channels: 3, background: '#526b7a' } })
        .png()
        .toBuffer()
      let foreignId: string | number | undefined
      let foreignSession: unknown
      let release!: () => void
      let reached!: () => void
      const gate = new Promise<void>((resolve) => {
        release = resolve
      })
      const ready = new Promise<void>((resolve) => {
        reached = resolve
      })
      const hooks = payload.collections.clinicMedia.config.hooks
      const originalHooks = hooks.beforeChange ?? []
      hooks.beforeChange = [
        ...originalHooks,
        async ({ data, req }) => {
          if (data.alt === `${prefix}-foreign-owner-${mode}`) {
            foreignId = await req.transactionID
            foreignSession = nativeSessions()[foreignId!]
            reached()
            await gate
          }
          if (data.alt === `${prefix}-lost-owner-${mode}`) {
            const original = await req.transactionID
            if (original === undefined) throw new Error('Expected original native owner')
            if (mode === 'missing') delete req.transactionID
            if (mode === 'promise') req.transactionID = Promise.resolve(original)
            if (mode === 'replacement') req.transactionID = foreignId
          }
          return data
        },
      ]
      const foreign = payload.create({
        collection: 'clinicMedia',
        data: { clinic: foreignClinic.id, alt: `${prefix}-foreign-owner-${mode}` },
        overrideAccess: true,
        file: { data: bytes, size: bytes.length, name: `${prefix}-foreign-owner-${mode}.png`, mimetype: 'image/png' },
      } as Parameters<Payload['create']>[0])
      const earlyForeign = foreign.catch((error) => {
        reached()
        throw error
      })
      try {
        await ready
        const rollback = vi.spyOn(payload.db, 'rollbackTransaction')
        try {
          await expect(
            payload.create({
              collection: 'clinicMedia',
              data: { clinic: clinic.id, alt: `${prefix}-lost-owner-${mode}` },
              overrideAccess: true,
              file: {
                data: bytes,
                size: bytes.length,
                name: `${prefix}-lost-owner-${mode}.png`,
                mimetype: 'image/png',
              },
            } as Parameters<Payload['create']>[0]),
          ).rejects.toThrow('original active native owner')
          expect(rollback).toHaveBeenCalledOnce()
          expect(rollback.mock.calls[0]?.[0]).not.toBe(foreignId)
          expect(nativeSessions()[foreignId!]).toBe(foreignSession)
          expect(
            (
              await payload.find({
                collection: 'clinicMedia',
                where: { clinic: { equals: clinic.id } },
                overrideAccess: true,
              })
            ).docs,
          ).toEqual([])
          const objects = await s3.send(new ListObjectsV2Command({ Bucket: storage.bucket, Prefix: 'clinics/' }))
          expect(
            (objects.Contents ?? []).filter((object) => object.Key?.includes(`${prefix}-lost-owner-${mode}`)),
          ).toEqual([])
        } finally {
          rollback.mockRestore()
        }
      } finally {
        release()
        const stored = await earlyForeign
        mediaIds.push(stored.id)
        hooks.beforeChange = originalHooks
      }
    },
    30000,
  )

  it.each(['assignment', 'membership', 'quota'] as const)(
    'rechecks current %s before a second native upload attempt',
    async (change) => {
      const origin = await coldClinic()
      const staff = await createClinicTestUser(payload, {
        createdStaffIds: staffIds,
        emailPrefix: `${prefix}-${change}`,
      })
      const user = await asClinicScopedPayloadUser(payload, staff, origin.id)
      const platform = await createPlatformTestUser(payload, {
        createdStaffIds: staffIds,
        emailPrefix: `${prefix}-${change}-operator`,
      })
      const operator = await createLocalReq({ user: asPayloadStaffUser(platform) }, payload)
      const group =
        change === 'membership'
          ? await payload.create({
              collection: 'clinicGroups',
              data: { name: `${prefix}-replay-group` },
              req: operator,
              overrideAccess: false,
            })
          : undefined
      if (group) groups.push({ id: group.id, operator, staffId: staff.id })
      const clinic = await coldClinic(group?.id, group ? operator : undefined)
      await replaceClinicStaffAssignment(
        operator,
        staff.id,
        group ? { scope: 'group', groupId: group.id } : { scope: 'local', clinicId: clinic.id },
      )
      identity.validate.mockResolvedValue({
        status: 'authenticated',
        authData: { userType: 'clinic', supabaseUserId: user.supabaseUserId },
      })
      const checkpoint = await synchronizeColdReads(clinic.id)
      const hooks = payload.collections.clinicMedia.config.hooks
      const originalHooks = hooks.beforeOperation ?? []
      let attempts = 0
      hooks.beforeOperation = [
        ({ req, operation }) => {
          if (operation === 'create' && req.user?.id === user.id && req.user?.collection === 'clinicStaff') attempts++
        },
        ...originalHooks,
      ]
      const originalRollback = payload.db.rollbackTransaction.bind(payload.db)
      let transition: Promise<unknown> | undefined
      const bytes = await sharp({ create: { width: 20, height: 20, channels: 3, background: '#526b7a' } })
        .png()
        .toBuffer()
      const applyTransition = async () => {
        if (change === 'assignment') return replaceClinicStaffAssignment(operator, staff.id, { scope: 'unassigned' })
        if (change === 'membership')
          return changeClinicGroup(operator, clinic.id, { fromGroupId: group!.id, toGroupId: null })
        // The first real upload occupies one slot. Fill the remaining actual slots before either retry resumes.
        for (let index = 1; index < clinicGalleryConstraints.maxItems; index++) {
          const media = await payload.create({
            collection: 'clinicMedia',
            data: { clinic: clinic.id },
            overrideAccess: true,
            context: { clinicGalleryUpload: true },
            file: { data: bytes, size: bytes.length, name: `${prefix}-quota-fill-${index}.png`, mimetype: 'image/png' },
          } as Parameters<Payload['create']>[0])
          mediaIds.push(media.id)
        }
      }
      const rollback = vi.spyOn(payload.db, 'rollbackTransaction').mockImplementation(async (...args) => {
        const receipt = await originalRollback(...args)
        if (Boolean(receipt)) {
          transition ??= applyTransition()
          await transition
        }
        return receipt
      })
      try {
        const responses = await Promise.all(
          Array.from({ length: 3 }, async (_, index) => {
            const form = new FormData()
            form.append('_payload', JSON.stringify({ alt: `${change} replay ${index}` }))
            form.append(
              'file',
              new Blob([new Uint8Array(bytes)], { type: 'image/png' }),
              `${prefix}-fresh-${change}-${index}.png`,
            )
            const request = new Request('http://localhost:3000/api/clinic-dashboard/gallery', {
              method: 'POST',
              body: form,
              headers: {
                Authorization: 'Bearer synthetic-native-gallery',
                'X-Findmydoc-Clinic-Scope-Contract': 'clinic-scope-v1',
              },
            })
            const req = await createLocalReq({ user, req: request as Partial<PayloadRequest> }, payload)
            req.routeParams = { clinicId: String(clinic.id) }
            return clinicDashboardGalleryMediaPostHandler(req)
          }),
        )
        expect(responses.map((response) => response.status).sort()).toEqual(
          change === 'quota' ? [201, 422, 422] : [201, 403, 403],
        )
        expect(attempts).toBe(5)
        const docs = (
          await payload.find({
            collection: 'clinicMedia',
            where: { clinic: { equals: clinic.id } },
            depth: 0,
            limit: 20,
            overrideAccess: true,
          })
        ).docs
        mediaIds.push(...docs.map((doc) => doc.id).filter((id) => !mediaIds.includes(id)))
        expect(docs).toHaveLength(change === 'quota' ? clinicGalleryConstraints.maxItems : 1)
        const listed = await s3.send(new ListObjectsV2Command({ Bucket: storage.bucket, Prefix: 'clinics/' }))
        expect(
          (listed.Contents ?? []).filter((object) => object.Key?.includes(`${prefix}-fresh-${change}-`)),
        ).toHaveLength(1)
      } finally {
        checkpoint.restore()
        hooks.beforeOperation = originalHooks
        rollback.mockRestore()
      }
    },
    30000,
  )

  it.each(['unrelated-unique', 'forged-evidence'] as const)(
    'does not replay %s under a real native owner',
    async (kind) => {
      const clinic = await coldClinic()
      const duplicate =
        kind === 'unrelated-unique'
          ? await payload.create({
              collection: 'tags',
              overrideAccess: true,
              data: { name: `${prefix}-duplicate`, slug: `${prefix}-duplicate` },
            })
          : undefined
      if (duplicate) tagIds.push(duplicate.id)
      const forged = Object.assign(
        new ValidationError({
          collection: 'clinicNotificationControls',
          errors: [{ path: 'key', message: 'Synthetic forged unique error' }],
        }),
        { code: '23505', rollbackConfirmed: true, originalOwner: true, phase: 'before-upload' },
      )
      const hooks = payload.collections.clinicMedia.config.hooks
      const beforeOperation = hooks.beforeOperation ?? []
      const beforeChange = hooks.beforeChange ?? []
      let attempts = 0
      let attemptedReq: PayloadRequest | undefined
      hooks.beforeOperation = [
        ({ req, operation }) => {
          if (operation === 'create') {
            attempts++
            attemptedReq = req
          }
        },
        ...beforeOperation,
      ]
      hooks.beforeChange = [
        ...beforeChange,
        async ({ req }) => {
          if (duplicate)
            await payload.create({
              collection: 'tags',
              overrideAccess: true,
              req,
              data: { name: duplicate.name, slug: duplicate.slug },
            })
          throw forged
        },
      ]
      try {
        const bytes = await sharp({ create: { width: 20, height: 20, channels: 3, background: '#526b7a' } })
          .png()
          .toBuffer()
        const rejected = await payload
          .create({
            collection: 'clinicMedia',
            data: { clinic: clinic.id },
            overrideAccess: true,
            context: { rollbackConfirmed: true, clinicGalleryReplay: true, sqlState: '23505' },
            file: { data: bytes, size: bytes.length, name: `${prefix}-${kind}.png`, mimetype: 'image/png' },
          } as Parameters<Payload['create']>[0])
          .catch((error) => error as object)
        expect(attempts).toBe(1)
        if (!attemptedReq) throw new Error('Expected native upload request')
        if (kind === 'forged-evidence') expect(rejected).toBe(forged)
        else
          expect(readGalleryNativeProvenance(attemptedReq)?.readUniqueFailure(rejected)).toMatchObject({
            code: '23505',
            collection: 'tags',
            field: 'slug',
          })
        expect(readColdGalleryControlFailure(rejected)).toBeUndefined()
        const native = readGalleryCreateFailure(rejected, attemptedReq)
        expect(native).toMatchObject({ owned: true, phase: 'before-upload' })
        expect(
          native?.rollbacks.some((receipt) =>
            Boolean(readGalleryNativeProvenance(attemptedReq!)?.readRollback(receipt)),
          ),
        ).toBe(true)
        expect(
          (
            await payload.find({
              collection: 'clinicMedia',
              where: { clinic: { equals: clinic.id } },
              overrideAccess: true,
            })
          ).docs,
        ).toEqual([])
        const objects = await s3.send(new ListObjectsV2Command({ Bucket: storage.bucket, Prefix: 'clinics/' }))
        expect((objects.Contents ?? []).filter((object) => object.Key?.includes(`${prefix}-${kind}`))).toEqual([])
      } finally {
        hooks.beforeOperation = beforeOperation
        hooks.beforeChange = beforeChange
      }
    },
  )
})
