import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Payload, PayloadRequest, CollectionConfig } from 'payload'
import { AuthActions } from '@/collections/AuthActions'
import { RecoveryRequestEvents } from '@/collections/RecoveryRequestEvents'
import { bindAuthActions } from '@/auth/actions/lifecycle'
import { websiteRecoveryContext } from '@/auth/actions/recoveryContext'
import { bindRecoveryRequests } from '@/auth/actions/recoveryRequests'

vi.mock('payload', async (load) => ({
  ...(await load<typeof import('payload')>()),
  createLocalReq: async ({ context, req }: { context: object; req: object }, payload: Payload) => ({
    ...req,
    context,
    payload,
    user: null,
  }),
}))
afterEach(() => vi.unstubAllEnvs())
const start = Date.parse('2026-10-02T10:00:00Z')
const key = { version: 'v1', secret: 'synthetic-recovery-counting-material-for-tests' }

function matches(doc: Record<string, unknown>, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([field, clause]) => {
    if (field === 'and' || field === 'or') {
      const clauses = clause as Record<string, unknown>[]
      return field === 'and' ? clauses.every((part) => matches(doc, part)) : clauses.some((part) => matches(doc, part))
    }
    return Object.entries(clause as Record<string, unknown>).every(([op, value]) => {
      if (op === 'equals') return doc[field] === value
      if (op === 'not_in') return !(value as unknown[]).includes(doc[field])
      if (op === 'greater_than') return String(doc[field]) > String(value)
      if (op === 'less_than_equal') return String(doc[field]) <= String(value)
      throw new Error(`Unsupported storage predicate ${op}`)
    })
  })
}

// Database boundary fake: Local API documents and production hooks; no admission or eligibility policy.
function storage() {
  const rows: Record<string, Record<string, unknown>[]> = {
    authActions: [],
    recoveryRequestEvents: [],
    patients: [],
    clinicStaff: [],
    platformStaff: [],
  }
  const configs: Record<string, CollectionConfig> = {
    authActions: AuthActions,
    recoveryRequestEvents: RecoveryRequestEvents,
  }
  let nextID = 1
  let snapshot: typeof rows | undefined
  const db = {
    beginTransaction: vi.fn(async () => {
      snapshot = structuredClone(rows)
      return 'owned'
    }),
    commitTransaction: vi.fn(async () => undefined),
    rollbackTransaction: vi.fn(async () => {
      Object.assign(rows, snapshot)
    }),
  }
  async function operation(operation: string, options: Record<string, unknown>) {
    for (const hook of configs[String(options.collection)]?.hooks?.beforeOperation ?? [])
      await hook({ operation, args: options, req: options.req } as Parameters<typeof hook>[0])
  }
  async function read(doc: Record<string, unknown>, options: Record<string, unknown>) {
    let result = structuredClone(doc)
    for (const hook of configs[String(options.collection)]?.hooks?.afterRead ?? [])
      result = await hook({ doc: result, req: options.req } as Parameters<typeof hook>[0])
    return result
  }
  const payload = {
    db,
    find: vi.fn(async (options) => {
      await operation('read', options)
      const docs = rows[options.collection]!.filter((doc) => matches(doc, options.where ?? {}))
      docs.sort((a, b) =>
        options.sort === '-observedAt'
          ? String(b.observedAt).localeCompare(String(a.observedAt))
          : Number(a.id) - Number(b.id),
      )
      return { docs: await Promise.all(docs.slice(0, options.limit).map((doc) => read(doc, options))) }
    }),
    findByID: vi.fn(async (options) => {
      await operation('read', options)
      const doc = rows[options.collection]!.find((doc) => doc.id === options.id)
      return doc ? read(doc, options) : null
    }),
    create: vi.fn(async (options) => {
      await operation('create', options)
      let data = structuredClone(options.data)
      for (const hook of configs[options.collection]?.hooks?.beforeChange ?? [])
        data = await hook({ data, operation: 'create', req: options.req } as Parameters<typeof hook>[0])
      const doc = { ...data, id: nextID++ }
      rows[options.collection]!.push(doc)
      return read(doc, options)
    }),
    delete: vi.fn(async (options) => {
      await operation('delete', options)
      for (const hook of configs[options.collection]?.hooks?.beforeDelete ?? [])
        await hook({ id: options.id, req: options.req } as Parameters<typeof hook>[0])
      rows[options.collection] = rows[options.collection]!.filter((doc) => doc.id !== options.id)
    }),
  } as unknown as Payload
  const req = { payload, context: {}, user: null } as PayloadRequest
  vi.stubEnv('VERCEL', '1')
  vi.stubEnv('VERCEL_ENV', 'preview')
  const context = (ip = '198.51.100.8') =>
    websiteRecoveryContext(new Request('https://example.test/auth', { headers: { 'x-vercel-forwarded-for': ip } }))!
  return { rows, payload, req, db, context }
}

describe('recovery admission through the owned Auth command', () => {
  it('acknowledges valid known, unknown, limited and unavailable requests identically without response caching', async () => {
    const fixture = storage()
    fixture.rows.patients!.push({
      id: 75,
      email: 'person@example.test',
      supabaseUserId: 'ddbbd37e-d44b-4d56-8038-234b8e6fa6d0',
    })
    const authority = bindRecoveryRequests(fixture.req, {
      environment: 'preview',
      now: () => start,
      recoveryKeys: [key],
    })
    for (const email of ['person@example.test', 'unknown@example.test', 'person@example.test']) {
      const response = await authority.request({ email, context: fixture.context() })
      expect(response.status).toBe(200)
      expect(response.headers.get('cache-control')).toBe('no-store')
      expect(await response.json()).toEqual({ ok: true })
    }
    fixture.db.beginTransaction.mockRejectedValueOnce(new Error('Private database detail'))
    expect(
      await (await authority.request({ email: 'person@example.test', context: fixture.context() })).json(),
    ).toEqual({ ok: true })
    expect((await authority.request({ email: 'not-an-address', context: fixture.context() })).status).toBe(400)
  })
  it.each(['target', 'ip'] as const)(
    'enforces the %s cooldown independently without extending it on denial',
    async (dimension) => {
      const fixture = storage()
      let now = start
      const actions = bindAuthActions(fixture.req, { environment: 'preview', now: () => now, recoveryKeys: [key] })
      await actions.reserveRecovery({ email: 'same@example.test', context: fixture.context() })
      const original = structuredClone(fixture.rows.recoveryRequestEvents)
      const next = {
        email: dimension === 'target' ? 'same@example.test' : 'another@example.test',
        context: fixture.context(dimension === 'ip' ? '198.51.100.8' : '198.51.100.9'),
      }
      now = start + 299999
      await actions.reserveRecovery(next)
      expect(fixture.rows.recoveryRequestEvents).toEqual(original)
      now = start + 300000
      await actions.reserveRecovery(next)
      expect(fixture.rows.recoveryRequestEvents).toHaveLength(4)
    },
  )
  it.each(['target', 'ip'] as const)(
    'counts at most five admitted requests per %s in a rolling hour',
    async (dimension) => {
      const fixture = storage()
      let now = start
      const actions = bindAuthActions(fixture.req, { environment: 'preview', now: () => now, recoveryKeys: [key] })
      for (let attempt = 0; attempt < 6; attempt++) {
        await actions.reserveRecovery({
          email: dimension === 'target' ? 'same@example.test' : `person${attempt}@example.test`,
          context: fixture.context(dimension === 'ip' ? '198.51.100.8' : `198.51.100.${attempt + 1}`),
        })
        now += 300000
      }
      expect(fixture.rows.recoveryRequestEvents).toHaveLength(10)
      now = start + 3600000
      await actions.reserveRecovery({ email: 'same@example.test', context: fixture.context() })
      expect(fixture.rows.recoveryRequestEvents).toHaveLength(12)
    },
  )

  it('rejects untrusted or wrong-environment context without counting or creating an action', async () => {
    const fixture = storage()
    const actions = bindAuthActions(fixture.req, { environment: 'preview', now: () => start, recoveryKeys: [key] })
    await actions.reserveRecovery({ email: 'person@example.test', context: {} as ReturnType<typeof fixture.context> })
    await actions.reserveRecovery({ email: 'person@example.test', context: null })
    vi.stubEnv('VERCEL_ENV', 'production')
    await actions.reserveRecovery({ email: 'person@example.test', context: fixture.context() })
    expect(fixture.rows.recoveryRequestEvents).toHaveLength(0)
    expect(fixture.rows.authActions).toHaveLength(0)
  })

  it.each([
    { status: 'blocked', authSync: { status: 'synced' } },
    { status: 'approved', authSync: { status: 'failed' } },
    { status: 'approved', authSync: { status: 'synced' }, supabaseUserId: null },
  ])('counts ineligible clinic targets without preparing recovery', async (fields) => {
    const fixture = storage()
    fixture.rows.clinicStaff!.push({
      id: 75,
      email: 'person@example.test',
      supabaseUserId: 'ddbbd37e-d44b-4d56-8038-234b8e6fa6d0',
      ...fields,
    })
    const actions = bindAuthActions(fixture.req, { environment: 'preview', now: () => start, recoveryKeys: [key] })
    expect(await actions.reserveRecovery({ email: 'person@example.test', context: fixture.context() })).toBeNull()
    expect(fixture.rows.recoveryRequestEvents).toHaveLength(2)
    expect(fixture.rows.authActions).toHaveLength(0)
  })

  it('does not choose a principal when an address belongs to multiple authoritative collections', async () => {
    const fixture = storage()
    for (const collection of ['patients', 'platformStaff'])
      fixture.rows[collection]!.push({
        id: 75,
        email: 'person@example.test',
        supabaseUserId: 'ddbbd37e-d44b-4d56-8038-234b8e6fa6d0',
      })
    const actions = bindAuthActions(fixture.req, { environment: 'preview', now: () => start, recoveryKeys: [key] })
    expect(await actions.reserveRecovery({ email: 'person@example.test', context: fixture.context() })).toBeNull()
    expect(fixture.rows.authActions).toHaveLength(0)
  })

  it('retains prior-key limits during rotation and fails closed when a live key is missing', async () => {
    const fixture = storage()
    let now = start
    const rotated = { version: 'v2', secret: 'synthetic-rotated-recovery-material-for-tests' }
    const bind = (keys: (typeof key)[]) =>
      bindAuthActions(fixture.req, { environment: 'preview', now: () => now, recoveryKeys: keys })
    const input = { email: 'person@example.test', context: fixture.context() }
    await bind([key]).reserveRecovery(input)
    await bind([rotated, key]).reserveRecovery(input)
    expect(fixture.rows.recoveryRequestEvents).toHaveLength(2)
    now += 300000
    await expect(bind([rotated]).reserveRecovery(input)).rejects.toMatchObject({ code: 'correlation-unavailable' })
    expect(fixture.rows.recoveryRequestEvents).toHaveLength(2)
    await bind([rotated, key]).reserveRecovery(input)
    expect(fixture.rows.recoveryRequestEvents).toHaveLength(4)
  })

  it('rolls back both counters if eligible action persistence fails', async () => {
    const fixture = storage()
    fixture.rows.patients!.push({
      id: 75,
      email: 'person@example.test',
      supabaseUserId: 'ddbbd37e-d44b-4d56-8038-234b8e6fa6d0',
    })
    const create = vi.mocked(fixture.payload.create).getMockImplementation()!
    vi.spyOn(fixture.payload, 'create').mockImplementation(async (options) => {
      if (options.collection === 'authActions') throw new Error('Database write failed')
      return create(options)
    })
    const actions = bindAuthActions(fixture.req, { environment: 'preview', now: () => start, recoveryKeys: [key] })
    await expect(actions.reserveRecovery({ email: 'person@example.test', context: fixture.context() })).rejects.toThrow(
      'Database write failed',
    )
    expect(fixture.rows.recoveryRequestEvents).toHaveLength(0)
    expect(fixture.rows.authActions).toHaveLength(0)
  })

  it('denies generic reads and writes even with overrideAccess and forged JSON capabilities', async () => {
    const fixture = storage()
    const req = { ...fixture.req, context: { authActionCapability: {}, recovery: true } }
    await expect(
      fixture.payload.find({ collection: 'recoveryRequestEvents', overrideAccess: true, req }),
    ).rejects.toMatchObject({ code: 'access-denied' })
    await expect(
      fixture.payload.create({
        collection: 'recoveryRequestEvents',
        overrideAccess: true,
        req,
        data: {
          dimension: 'target',
          environment: 'preview',
          keyVersion: 'v1',
          digest: 'a'.repeat(64),
          observedAt: new Date(start).toISOString(),
        },
      }),
    ).rejects.toMatchObject({ code: 'access-denied' })
  })
  it('removes expired events through the existing Auth retention command without retaining deletion receipts', async () => {
    const fixture = storage()
    let now = start
    const actions = bindAuthActions(fixture.req, { environment: 'preview', now: () => now, recoveryKeys: [key] })
    await actions.reserveRecovery({ email: 'unknown@example.test', context: fixture.context() })
    now += 3599999
    expect(await actions.sweepRecovery()).toEqual({ deleted: 0 })
    now += 1
    expect(await actions.sweepRecovery()).toEqual({ deleted: 2 })
    expect(await actions.sweepRecovery()).toEqual({ deleted: 0 })
    expect(fixture.rows.recoveryRequestEvents).toHaveLength(0)
  })
  it.each([
    ['patients', 'patient-recovery'],
    ['platformStaff', 'platform-recovery'],
    ['clinicStaff', 'clinic-recovery'],
  ] as const)(
    'creates a bound action only for the authoritative eligible %s principal',
    async (collection, actionType) => {
      const fixture = storage()
      fixture.rows[collection]!.push({
        id: 75,
        email: 'person@example.test',
        supabaseUserId: 'ddbbd37e-d44b-4d56-8038-234b8e6fa6d0',
        status: 'approved',
        authSync: { status: 'synced' },
      })
      const actions = bindAuthActions(fixture.req, { environment: 'preview', now: () => start, recoveryKeys: [key] })
      expect(
        await actions.reserveRecovery({ email: ' Person@Example.test ', context: fixture.context() }),
      ).toMatchObject({
        actionType,
        principal: { relationTo: collection, value: 75 },
        state: 'pending',
      })
      expect(fixture.rows.recoveryRequestEvents).toHaveLength(2)
    },
  )
  it('counts unknown targets privately and does not extend either cooldown after a denied request', async () => {
    const fixture = storage()
    let now = start
    const actions = bindAuthActions(fixture.req, { environment: 'preview', now: () => now, recoveryKeys: [key] })
    const input = { email: 'unknown@example.test', context: fixture.context() }
    expect(await actions.reserveRecovery(input)).toBeNull()
    expect(fixture.rows.recoveryRequestEvents).toHaveLength(2)
    expect(JSON.stringify(fixture.rows)).not.toContain(input.email)
    expect(JSON.stringify(fixture.rows)).not.toContain('198.51.100.8')
    now += 299999
    expect(await actions.reserveRecovery(input)).toBeNull()
    expect(fixture.rows.recoveryRequestEvents).toHaveLength(2)
    now += 1
    expect(await actions.reserveRecovery(input)).toBeNull()
    expect(fixture.rows.recoveryRequestEvents).toHaveLength(4)
    expect(fixture.rows.authActions).toHaveLength(0)
  })
})
