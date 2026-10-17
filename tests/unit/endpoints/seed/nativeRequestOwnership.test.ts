import { describe, expect, it, vi } from 'vitest'
import { createDataloaderCacheKey, createLocalReq, type Payload, type PayloadRequest } from 'payload'
import { importCollection } from '@/endpoints/seed/utils/import-collection'
import { upsertByStableId } from '@/endpoints/seed/utils/upsert'
import { createStableIdResolvers } from '@/endpoints/seed/utils/resolvers'

vi.mock('@/endpoints/seed/utils/load-json', () => ({
  loadSeedFile: vi.fn(async () => [{ stableId: 'clinic-one', name: { en: 'One', de: 'Eins', tr: 'Bir' } }]),
}))

// Keep Payload's real request-bound population loader at the native API boundary.
// Its relationship reads must not attach a completed transaction to the seed caller.
async function nativeBoundary(existing: boolean, activeTransaction?: string) {
  let nextTransaction = 0
  const writes: Partial<PayloadRequest>[] = []
  const payload = {
    config: {},
    collections: { clinics: { config: {}, customIDType: 'number' } },
    db: { defaultIDType: 'number' },
    logger: { warn: vi.fn() },
    find: vi.fn(async (options) => ({
      docs: options.where?.stableId && !existing ? [] : [{ id: 42, stableId: 'clinic-one' }],
      totalDocs: options.where?.stableId && !existing ? 0 : 1,
    })),
  } as unknown as Payload
  const caller = await createLocalReq({ req: { i18n: { t: () => '' } as unknown as PayloadRequest['i18n'] } }, payload)
  caller.context = { seedCaller: 'preserved' }
  if (activeTransaction) caller.transactionID = activeTransaction
  const mutate = vi.fn(async (options) => {
    const req = await createLocalReq(options, payload)
    if (req.transactionID && req.transactionID !== activeTransaction)
      throw new Error('A completed native transaction leaked into the next seed write.')
    req.transactionID ??= `seed-operation-${++nextTransaction}`
    writes.push(req)
    await req.payloadDataLoader.load(
      createDataloaderCacheKey({
        collectionSlug: 'clinics',
        docID: 42,
        depth: 0,
        currentDepth: 0,
        locale: 'en',
        overrideAccess: true,
        draft: false,
        fallbackLocale: 'en',
        showHiddenFields: false,
        transactionID: req.transactionID,
      }),
    )
    if (!activeTransaction) delete req.transactionID
    return { id: 42 }
  })
  payload.create = mutate as unknown as Payload['create']
  payload.update = mutate as unknown as Payload['update']
  return { payload, caller, writes }
}

describe('seed native request ownership', () => {
  it.each([false, true])('keeps consecutive upserts independent when existing=%s', async (existing) => {
    const { payload, caller, writes } = await nativeBoundary(existing)
    await upsertByStableId(payload, 'clinics', { stableId: 'clinic-one' }, { req: caller })
    await upsertByStableId(payload, 'clinics', { stableId: 'clinic-two' }, { req: caller })
    expect(writes).toHaveLength(2)
    expect(caller.transactionID).toBeUndefined()
  })

  it('keeps localized follow-up writes independent from their seed caller', async () => {
    const { payload, caller, writes } = await nativeBoundary(true)
    const result = await importCollection({
      payload,
      kind: 'demo',
      collection: 'clinics',
      fileName: 'clinics',
      localizedFields: ['name'],
      req: caller,
      resolvers: createStableIdResolvers(payload),
    })
    expect(result.failures).toEqual([])
    expect(writes.length).toBeGreaterThan(1)
    expect(caller.transactionID).toBeUndefined()
  })

  it('preserves a caller-owned native transaction and context without reusing its population loader', async () => {
    const { payload, caller, writes } = await nativeBoundary(true, 'active-caller-transaction')
    const originalLoader = caller.payloadDataLoader
    const originalContext = caller.context
    await upsertByStableId(payload, 'clinics', { stableId: 'clinic-one' }, { req: caller })
    expect(writes[0]?.transactionID).toBe('active-caller-transaction')
    expect(writes[0]?.payloadDataLoader).not.toBe(originalLoader)
    expect(writes[0]?.context).toMatchObject({ seedCaller: 'preserved', disableRevalidate: true })
    expect(caller.transactionID).toBe('active-caller-transaction')
    expect(caller.payloadDataLoader).toBe(originalLoader)
    expect(caller.context).toBe(originalContext)
    expect(caller.context).toEqual({ seedCaller: 'preserved' })
  })

  it('does not discard an unrecognized caller transaction to continue importing', async () => {
    const { payload, caller } = await nativeBoundary(true)
    caller.transactionID = 'completed-caller-transaction'
    await expect(upsertByStableId(payload, 'clinics', { stableId: 'clinic-one' }, { req: caller })).rejects.toThrow(
      'A completed native transaction leaked into the next seed write.',
    )
    expect(caller.transactionID).toBe('completed-caller-transaction')
  })
})
