import { createHash, createHmac, randomUUID } from 'node:crypto'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { createLocalReq, getPayload, type Payload, type CollectionBeforeChangeHook } from 'payload'
import config from '@payload-config'
import { bindAuthActions } from '@/auth/actions/lifecycle'
import { dashboardRecoveryContext } from '@/auth/actions/recoveryContext'
import { createPatientTestUser, cleanupTrackedUsers } from '../fixtures/testUsers'
import { testSlug } from '../fixtures/testSlug'

vi.mock('@/auth/utilities/jwtValidation', () => ({ extractSupabaseUserData: async () => null }))
const key = { version: 'recovery-ci-v1', secret: 'synthetic-ci-recovery-counting-material-for-tests' }
const signingKey = { version: 'dashboard-ci-v1', secret: 'synthetic-ci-dashboard-signing-material-for-tests' }
const start = Date.parse('2026-10-02T10:00:00Z')
const prefix = testSlug('recoveryRequests.lifecycle.test.ts')

describe('private recovery admission with real Payload transactions', () => {
  let payload: Payload
  let now: number
  const patientIDs: Array<number | string> = []
  const actionIDs = new Set<number>()
  const actions = async () =>
    bindAuthActions(await createLocalReq({}, payload), { environment: 'ci', now: () => now, recoveryKeys: [key] })
  const context = (email: string, clientIP = '198.51.100.8') => {
    const input = {
      method: 'POST',
      operation: 'requestRecovery',
      timestamp: new Date(now).toISOString(),
      requestId: randomUUID(),
      body: JSON.stringify({ email, clientIP }),
      keyVersion: signingKey.version,
      signature: '',
    }
    input.signature = createHmac('sha256', signingKey.secret)
      .update(
        JSON.stringify([
          'auth-recovery-request-v1',
          'ci',
          input.method,
          input.operation,
          input.timestamp,
          input.requestId,
          createHash('sha256').update(input.body).digest('hex'),
        ]),
      )
      .digest('hex')
    return dashboardRecoveryContext(input, { environment: 'ci', keys: [signingKey], now: () => now })!
  }
  beforeAll(async () => {
    payload = await getPayload({ config })
  }, 60000)
  afterEach(async () => {
    vi.restoreAllMocks()
    now = start + 3600000
    while ((await (await actions()).sweepRecovery()).deleted === 100) {
      /* drain bounded batches */
    }
    now = start + 365 * 86400000
    const system = await actions()
    for (const id of actionIDs) if (!(await system.read(id))?.terminalAt) await system.transition({ id, to: 'revoked' })
    now = start + 730 * 86400000
    await (await actions()).sweep()
    actionIDs.clear()
    await cleanupTrackedUsers(payload, { patientIds: patientIDs })
  })

  it('admits only one known request when concurrent writers observe an unused allowance', async () => {
    now = start
    const patient = await createPatientTestUser(payload, {
      emailPrefix: `${prefix}-concurrent`,
      supabaseUserId: randomUUID(),
      createdPatientIds: patientIDs,
    })
    const email = patient.email
    let arrivals = 0
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const timer = setTimeout(release, 10000)
    const hooks = payload.collections.recoveryRequestEvents.config.hooks.beforeChange
    const synchronize: CollectionBeforeChangeHook = async ({ data, operation }) => {
      if (operation === 'create' && data.dimension === 'target') {
        arrivals++
        if (arrivals === 2) release()
        if (arrivals <= 2) await gate
      }
      return data
    }
    hooks.push(synchronize)
    try {
      const contenders = await Promise.all([actions(), actions()])
      const results = await Promise.all(
        contenders.map((system) => system.reserveRecovery({ email, context: context(email) })),
      )
      for (const action of results) if (action) actionIDs.add(action.id)
      expect(arrivals).toBeGreaterThanOrEqual(2)
      expect(results.filter(Boolean)).toHaveLength(1)
      expect(results.find(Boolean)).toMatchObject({
        actionType: 'patient-recovery',
        principal: { relationTo: 'patients', value: patient.id },
      })
      now = start + 3600000
      expect(await (await actions()).sweepRecovery()).toEqual({ deleted: 2 })
    } finally {
      clearTimeout(timer)
      release()
      hooks.splice(hooks.indexOf(synchronize), 1)
    }
  })

  it('counts unknown targets, denies generic reads and deletes both event dimensions at the deadline', async () => {
    now = start
    const system = await actions()
    const email = `${prefix}-unknown@example.test`
    expect(await system.reserveRecovery({ email, context: context(email) })).toBeNull()
    now += 299999
    expect(await system.reserveRecovery({ email, context: context(email) })).toBeNull()
    for (const overrideAccess of [false, true]) {
      await expect(
        payload.find({
          collection: 'recoveryRequestEvents',
          overrideAccess,
          context: { authActionCapability: {}, trustedSystem: true },
        }),
      ).rejects.toMatchObject({ status: 403 })
    }
    now = start + 3600000
    expect(await system.sweepRecovery()).toEqual({ deleted: 2 })
    expect(await system.sweepRecovery()).toEqual({ deleted: 0 })
  })
})
