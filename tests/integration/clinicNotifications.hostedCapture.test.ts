import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { createLocalReq, getPayload, type Payload, type PayloadRequest } from 'payload'
import config from '@payload-config'
import { activateHostedCapture, readHostedCaptureStatus } from '@/features/clinicNotifications/hostedCapture'
import {
  clinicNotificationCaptureGetHandler,
  clinicNotificationCapturePostHandler,
} from '@/endpoints/clinicNotificationCapture'
import { withTestCaptureAuthority } from '@/features/clinicNotifications/testCaptureAuthority'
import { activateClinicNotificationsForTest } from '@/features/clinicNotifications/capture'
import { submitGuestClinicInquiry } from '@/features/inquiryCommunication/service'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { createClinicFixture } from '../fixtures/createClinicFixture'
import { asPayloadStaffUser, createPlatformTestUser } from '../fixtures/testUsers'
import { testSlug } from '../fixtures/testSlug'

vi.mock('@payloadcms/storage-s3', () => ({ s3Storage: () => (incoming: unknown) => incoming }))

function hostedEnvironment() {
  vi.stubEnv('DEPLOYMENT_ENV', 'preview')
  vi.stubEnv('VERCEL_ENV', 'preview')
  vi.stubEnv('VERCEL_GIT_COMMIT_SHA', 'a'.repeat(40))
}
function gate() {
  let release!: () => void
  const promise = new Promise<void>((resolve) => {
    release = resolve
  })
  return { promise, release }
}

describe('hosted capture native ownership and source ordering', () => {
  let payload: Payload
  let operator: PayloadRequest
  let clinicId: number
  let doctorId: number
  let initial: { id: number; active: boolean; activatedAt?: string | null } | undefined

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
    initial = (
      await payload.find({
        collection: 'clinicNotificationControls',
        where: { key: { equals: 'notification-center' } },
        overrideAccess: true,
        depth: 0,
      })
    ).docs[0]
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.useRealTimers()
  })
  afterAll(async () => {
    vi.unstubAllEnvs()
    vi.useRealTimers()
    if (payload) {
      await fixtureBoundary(initial?.active ?? false, initial?.activatedAt ?? null)
      await payload.db.destroy?.()
    }
  })

  async function fixtureBoundary(active = false, activatedAt: string | null = null) {
    const stored = (
      await payload.find({
        collection: 'clinicNotificationControls',
        where: { key: { equals: 'notification-center' } },
        overrideAccess: true,
        depth: 0,
      })
    ).docs[0]
    if (!stored) return
    vi.stubEnv('DEPLOYMENT_ENV', 'test')
    vi.stubEnv('VERCEL_ENV', 'development')
    const req = await createLocalReq({ context: { clinicNotificationCommand: true } }, payload)
    await withTestCaptureAuthority(req, () =>
      payload.update({
        collection: 'clinicNotificationControls',
        id: stored.id,
        overrideAccess: true,
        req,
        data: { active, activatedAt },
      }),
    )
    vi.unstubAllEnvs()
  }

  async function activation() {
    const status = await readHostedCaptureStatus(operator)
    return activateHostedCapture(operator, {
      action: 'activate',
      environment: 'preview',
      runtimeRevision: status.runtimeRevision,
      expectedState: status.expectedState,
    })
  }
  async function source(suffix: string, req?: PayloadRequest) {
    return submitGuestClinicInquiry(req ?? (await createLocalReq({}, payload)), {
      clinicId,
      doctorId,
      consent: true,
      email: `${suffix}@example.com`,
      fullName: 'Synthetic Capture Case',
      message: 'Controlled native source transition.',
      phoneNumber: '+493000000555',
    })
  }
  async function occurrences(id: string) {
    return (
      await payload.find({
        collection: 'clinicNotificationOccurrences',
        overrideAccess: true,
        depth: 0,
        where: { sourceRecordId: { equals: id } },
      })
    ).docs
  }

  it('creates the cold native boundary and retains the first activation time on prepared replay', async () => {
    expect(initial).toBeUndefined()
    const cities = await payload.find({ collection: 'cities', limit: 1, overrideAccess: true })
    const fixture = await createClinicFixture(payload, cities.docs[0]!.id, { slugPrefix: testSlug('hosted-capture') })
    clinicId = fixture.clinic.id
    doctorId = fixture.doctor.id
    operator = await createLocalReq(
      { user: asPayloadStaffUser(await createPlatformTestUser(payload, { emailPrefix: 'hosted-capture-operator' })) },
      payload,
    )
    hostedEnvironment()
    const hooks = payload.collections.clinicNotificationControls.config.hooks
    const previous = hooks.afterOperation
    let owners = 0
    hooks.afterOperation = [
      ...(previous ?? []),
      async ({ args, operation, req, result }) => {
        if ((operation === 'create' || operation === 'update') && args.data.active === true) {
          expect(operation).toBe('create')
          const id = await req.transactionID
          expect(id).toBeDefined()
          expect(Object.hasOwn(payload.db.sessions!, id!)).toBe(true)
          owners++
        }
        return result
      },
    ]
    try {
      const preparedResponse = await clinicNotificationCaptureGetHandler(operator)
      expect(preparedResponse.status).toBe(200)
      const prepared = await preparedResponse.json()
      const web = new Request('https://example.com/api/internal/clinic-notifications/capture', {
        method: 'POST',
        headers: { Origin: 'https://example.com', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'activate',
          environment: prepared.environment,
          runtimeRevision: prepared.runtimeRevision,
          expectedState: prepared.expectedState,
        }),
      })
      const httpReq = await createLocalReq({ req: web as Partial<PayloadRequest>, user: operator.user! }, payload)
      const serverURL = payload.config.serverURL
      payload.config.serverURL = 'https://example.com'
      let result: Awaited<ReturnType<typeof activateHostedCapture>>
      try {
        const response = await clinicNotificationCapturePostHandler(httpReq)
        expect(response.status).toBe(200)
        result = await response.json()
      } finally {
        payload.config.serverURL = serverURL
      }
      expect(result).toMatchObject({ active: true, outcome: 'activated', activatedAt: expect.any(String) })
      expect(owners).toBe(1)
      const replay = await activation()
      expect(replay).toMatchObject({ outcome: 'already_active', activatedAt: result.activatedAt })
      expect(owners).toBe(1)
      await expect(activateClinicNotificationsForTest(operator)).rejects.toMatchObject({ code: 'CLINIC_ACCESS_DENIED' })
    } finally {
      hooks.afterOperation = previous
    }
  })

  it('keeps source-first history ineligible after activation without replay backfill', async () => {
    await fixtureBoundary()
    hostedEnvironment()
    const entered = gate(),
      proceed = gate(),
      activationAttempt = gate()
    const auditHooks = payload.collections.inquiryAuditEvents.config.hooks
    const controls = payload.collections.clinicNotificationControls.config.hooks
    const previousAudit = auditHooks.afterChange,
      previousControls = controls.beforeOperation
    let paused = false,
      settled = false
    auditHooks.afterChange = [
      ...(previousAudit ?? []),
      async ({ doc, req }) => {
        if (req.context.hostedCaptureRace && !paused) {
          paused = true
          entered.release()
          await proceed.promise
        }
        return doc
      },
    ]
    controls.beforeOperation = [
      async ({ args, operation }) => {
        if ((operation === 'create' || operation === 'update') && args.data.active === true) activationAttempt.release()
        return args
      },
      ...(previousControls ?? []),
    ]
    const req = await createLocalReq({ context: { hostedCaptureRace: true } }, payload)
    const creating = source('hosted-source-first', req)
    let activating: Promise<unknown> | undefined
    try {
      await entered.promise
      activating = activation().finally(() => {
        settled = true
      })
      await activationAttempt.promise
      expect(settled).toBe(false)
      proceed.release()
      const created = await creating
      await activating
      expect(await occurrences(created.id)).toHaveLength(0)
      expect((await source('hosted-source-first')).deduped).toBe(true)
      expect(await occurrences(created.id)).toHaveLength(0)
      const after = await source('hosted-source-after')
      expect(await occurrences(after.id)).toHaveLength(1)
    } finally {
      proceed.release()
      await creating.catch(() => undefined)
      await activating?.catch(() => undefined)
      auditHooks.afterChange = previousAudit
      controls.beforeOperation = previousControls
    }
  })

  it('holds activation-first serialization through delayed native commit and captures the later source', async () => {
    await fixtureBoundary()
    hostedEnvironment()
    const entered = gate(),
      proceed = gate(),
      sourceAttempt = gate()
    const hooks = payload.collections.clinicNotificationControls.config.hooks
    const previousAfter = hooks.afterOperation,
      previousBefore = hooks.beforeOperation
    let activationTime: unknown
    hooks.afterOperation = [
      ...(previousAfter ?? []),
      async ({ args, operation, result }) => {
        if ((operation === 'create' || operation === 'update') && args.data.active === true) {
          activationTime = (result as { activatedAt?: string }).activatedAt
          entered.release()
          await proceed.promise
        }
        return result
      },
    ]
    hooks.beforeOperation = [
      async ({ args, operation }) => {
        if (operation === 'update' && args.data.nonce && !args.data.active) sourceAttempt.release()
        return args
      },
      ...(previousBefore ?? []),
    ]
    let creating: ReturnType<typeof source> | undefined
    let sourceSettled = false
    const activating = activation()
    try {
      await entered.promise
      vi.setSystemTime(new Date(Date.parse(String(activationTime)) + 60_000))
      creating = source('hosted-activation-first').finally(() => {
        sourceSettled = true
      })
      await sourceAttempt.promise
      expect(sourceSettled).toBe(false)
      proceed.release()
      const active = await activating
      const created = await creating
      expect(active.activatedAt).toBe(activationTime)
      const captured = await occurrences(created.id)
      expect(captured).toHaveLength(1)
      expect(Date.parse(captured[0]!.occurredAt)).toBeGreaterThanOrEqual(Date.parse(String(activationTime)))
    } finally {
      proceed.release()
      await activating.catch(() => undefined)
      await creating?.catch(() => undefined)
      hooks.afterOperation = previousAfter
      hooks.beforeOperation = previousBefore
    }
  })

  it('rolls back a rejected native activation and never retries an uncertain submitted result', async () => {
    await fixtureBoundary()
    hostedEnvironment()
    const hooks = payload.collections.clinicNotificationControls.config.hooks
    const previous = hooks.afterOperation
    let attempts = 0
    hooks.afterOperation = [
      ...(previous ?? []),
      ({ args, operation, result }) => {
        if ((operation === 'create' || operation === 'update') && args.data.active === true) {
          attempts++
          throw new Error('Synthetic native activation failure')
        }
        return result
      },
    ]
    try {
      await expect(activation()).rejects.toThrow('Synthetic native activation failure')
    } finally {
      hooks.afterOperation = previous
    }
    expect(attempts).toBe(1)
    expect(await readHostedCaptureStatus(operator)).toMatchObject({ active: false, activatedAt: null })
    const nativeCommit = payload.db.commitTransaction.bind(payload.db)
    const commit = vi.spyOn(payload.db, 'commitTransaction').mockImplementationOnce(async (id) => {
      await nativeCommit(id)
      throw new Error('Synthetic lost commit confirmation')
    })
    try {
      await expect(activation()).rejects.toThrow('Synthetic lost commit confirmation')
      expect(commit).toHaveBeenCalledTimes(1)
    } finally {
      commit.mockRestore()
    }
    expect(await readHostedCaptureStatus(operator)).toMatchObject({ active: true, activatedAt: expect.any(String) })
  })

  it('rejects loss of the original native session during the stored-role check before activation persistence', async () => {
    await fixtureBoundary()
    hostedEnvironment()
    const hooks = payload.collections.platformStaff.config.hooks
    const previous = hooks.afterOperation
    let roleReads = 0
    hooks.afterOperation = [
      ...(previous ?? []),
      async ({ req, operation, result }) => {
        if (
          operation === 'find' &&
          req.context.clinicNotificationCommand &&
          req.user?.id === operator.user!.id &&
          ++roleReads === 2
        ) {
          const transactionID = await req.transactionID
          expect(transactionID).toBeDefined()
          await payload.db.rollbackTransaction(transactionID!)
          delete req.transactionID
        }
        return result
      },
    ]
    try {
      await expect(activation()).rejects.toThrow('active native transaction session')
    } finally {
      hooks.afterOperation = previous
    }
    expect(roleReads).toBe(2)
    expect(await readHostedCaptureStatus(operator)).toMatchObject({ active: false, activatedAt: null })
  })
})
