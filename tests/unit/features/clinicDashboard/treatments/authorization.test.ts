import type { PayloadRequest } from 'payload'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ClinicTreatments } from '@/collections/ClinicTreatments'

const source = vi.hoisted(() => ({ principal: vi.fn(), target: vi.fn(), barrier: vi.fn(), session: vi.fn() }))
vi.mock('@/features/clinicNotifications/authorizationBarrier', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/clinicNotifications/authorizationBarrier')>()),
  guardClinicAuthorizationKeys: source.barrier,
  guardNotificationAuthorizationSession: source.session,
}))
vi.mock('@/auth/utilities/clinicPrincipalAccess', () => ({
  readClinicPrincipalAccess: source.principal,
  readClinicTargetAccess: source.target,
}))

const request = () => ({ user: { collection: 'clinicStaff', id: 7 }, payload: {} }) as unknown as PayloadRequest

describe('Clinic treatment current source access', () => {
  beforeEach(() => vi.clearAllMocks())

  it('reads only the current group clinic set, including inactive offerings', async () => {
    const req = request()
    source.principal.mockResolvedValue({ staff: { assignmentScope: 'group' }, clinics: [{ id: 11 }, { id: 12 }] })
    await expect(ClinicTreatments.access!.read!({ req })).resolves.toEqual({ clinic: { in: [11, 12] } })
    expect(source.principal).toHaveBeenCalledWith(req.payload, 7, req)
  })

  it('does not fall back to public active rows when personal readiness or membership is lost', async () => {
    source.principal.mockResolvedValue(null)
    await expect(ClinicTreatments.access!.read!({ req: request() })).resolves.toBe(false)
  })

  it('keeps anonymous public reads restricted to active offerings', async () => {
    expect(await ClinicTreatments.access!.read!({ req: { payload: {} } as PayloadRequest })).toEqual({
      active: { equals: true },
    })
  })
  it.each([undefined, {}])(
    'accepts an explicit group-clinic creation with native originalDoc %j',
    async (originalDoc) => {
      const req = request()
      req.routeParams = { clinicId: '12' }
      req.transactionID = Promise.resolve('native-owner')
      Object.assign(req.payload, {
        db: { sessions: { 'native-owner': {} } },
        findByID: vi.fn(async () => ({ id: 12, group: 30 })),
      })
      source.principal.mockResolvedValue({ staff: { assignmentScope: 'group' }, clinics: [{ id: 11 }, { id: 12 }] })
      source.target.mockResolvedValue({ clinic: { id: 12 } })
      const hook = ClinicTreatments.hooks!.beforeChange!.at(-1)!
      const data = { clinic: 12, treatment: 8, price: 20, active: false }
      const result = await hook({
        req,
        data,
        originalDoc,
        context: {},
        operation: 'create',
        collection: ClinicTreatments,
      } as unknown as Parameters<typeof hook>[0])
      expect(result).toMatchObject(data)
      expect(source.barrier).toHaveBeenCalledWith(
        req,
        expect.arrayContaining([
          'notification-authorization:clinic:12',
          'notification-authorization:group:30',
          'notification-authorization:staff:7',
        ]),
      )
      expect(source.target).toHaveBeenCalledWith(req.payload, 7, 12, req)
      expect(source.session).toHaveBeenCalledWith({ req })
    },
  )
  it.each([undefined, { collection: 'platformStaff', id: 8 }])(
    'preserves trusted native creation with an empty publication predecessor for %j',
    async (user) => {
      const req = {
        user,
        transactionID: Promise.resolve('native-owner'),
        payload: {
          db: { sessions: { 'native-owner': {} } },
          findByID: vi.fn(async () => ({ id: 12, group: 30 })),
        },
      } as unknown as PayloadRequest
      const hook = ClinicTreatments.hooks!.beforeChange!.at(-1)!
      const data = { clinic: 12, treatment: 8, price: 20, active: false }
      await expect(
        hook({
          req,
          data,
          originalDoc: {},
          operation: 'create',
          context: {},
          collection: ClinicTreatments,
        } as unknown as Parameters<typeof hook>[0]),
      ).resolves.toMatchObject(data)
      expect(source.barrier).toHaveBeenCalledWith(req, [
        'notification-authorization:clinic:12',
        'notification-authorization:group:30',
      ])
      expect(source.session).toHaveBeenCalledWith({ req })
    },
  )

  it('denies an update whose stored clinic is absent even when input supplies a clinic', async () => {
    const req = request()
    const hook = ClinicTreatments.hooks!.beforeChange!.at(-1)!
    await expect(
      hook({
        req,
        data: { clinic: 12, price: 20 },
        originalDoc: {},
        operation: 'update',
        context: {},
        collection: ClinicTreatments,
      } as unknown as Parameters<typeof hook>[0]),
    ).rejects.toMatchObject({ status: 403 })
    expect(source.barrier).not.toHaveBeenCalled()
  })

  it.each(['create', 'update'])(
    'denies direct %s before any source read when no native owner exists',
    async (operation) => {
      const req = request()
      Object.assign(req.payload, { db: { sessions: {} }, find: vi.fn() })
      const hook = ClinicTreatments.hooks!.beforeOperation![0]!
      await expect(
        hook({
          req,
          operation,
          args: { id: 9, data: { clinic: 12 } },
          collection: ClinicTreatments,
        } as unknown as Parameters<typeof hook>[0]),
      ).rejects.toThrow(/active native transaction/)
      expect(req.payload.find).not.toHaveBeenCalled()
      expect(source.barrier).not.toHaveBeenCalled()
    },
  )

  it('rechecks source eligibility after acquiring the native barriers', async () => {
    const req = request()
    req.transactionID = Promise.resolve('native-owner')
    Object.assign(req.payload, {
      db: { sessions: { 'native-owner': {} } },
      findByID: vi.fn(async () => ({ id: 11, group: 30 })),
    })
    source.target.mockResolvedValue(null)
    const hook = ClinicTreatments.hooks!.beforeChange!.at(-1)!
    await expect(
      hook({
        req,
        context: {},
        data: { price: 20 },
        originalDoc: { clinic: 11 },
        operation: 'update',
        collection: ClinicTreatments,
      } as unknown as Parameters<typeof hook>[0]),
    ).rejects.toMatchObject({ status: 403 })
    expect(source.target).toHaveBeenCalledAfter(source.barrier)
  })

  it.each(['create', 'update', 'updateByID', 'delete', 'deleteByID', 'restoreVersion'])(
    'fails %s final verification when a nested operation loses its native session',
    async (operation) => {
      const req = request()
      req.transactionID = Promise.resolve('finished-owner')
      Object.assign(req.payload, { db: { sessions: {} } })
      const hook = ClinicTreatments.hooks!.afterOperation![0]!
      await expect(
        hook({ req, operation, result: { clinic: 11 }, collection: ClinicTreatments } as unknown as Parameters<
          typeof hook
        >[0]),
      ).rejects.toThrow(/active native transaction/)
      expect(source.barrier).not.toHaveBeenCalled()
    },
  )
})
