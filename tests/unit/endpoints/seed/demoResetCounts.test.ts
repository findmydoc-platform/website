import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'
import type { CollectionImportResult } from '@/endpoints/seed/utils/import-collection'
import type { StableIdResolvers } from '@/endpoints/seed/utils/resolvers'

const resetCollections = vi.hoisted(() => vi.fn())
const importCollection = vi.hoisted<() => CollectionImportResult | Promise<CollectionImportResult>>(() =>
  vi.fn<(...args: []) => Promise<CollectionImportResult>>(),
)
const createStableIdResolvers = vi.hoisted(() =>
  vi.fn(
    (): StableIdResolvers => ({
      resolveIdByStableId: vi.fn(async () => null),
      resolveManyIdsByStableIds: vi.fn(async () => ({ ids: [], missing: [] })),
      resolveStableIdById: vi.fn(async () => null),
      resolveManyStableIdsByIds: vi.fn(async () => ({ stableIds: [], missing: [] })),
    }),
  ),
)

vi.mock('@/endpoints/seed/utils/reset', () => ({ resetCollections }))
vi.mock('@/endpoints/seed/utils/import-collection', () => ({ importCollection }))
vi.mock('@/endpoints/seed/utils/resolvers', () => ({ createStableIdResolvers }))
vi.mock('@/endpoints/seed/utils/plan', () => ({
  demoPlan: [
    { kind: 'collection', name: 'demo-one', collection: 'posts', fileName: 'posts' },
    { kind: 'collection', name: 'demo-two', collection: 'clinics', fileName: 'clinics' },
  ],
}))

import { runDemoSeeds } from '@/endpoints/seed/demo'

function makePayload(): Payload {
  return {
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  } as unknown as Payload
}

describe('demo seed reset handling', () => {
  beforeEach(() => {
    resetCollections.mockClear()
    importCollection.mockReset()
    importCollection.mockResolvedValue({
      name: 'demo',
      created: 1,
      updated: 0,
      warnings: [],
      failures: [],
    })
  })

  it('resets demo collections when reset flag is true', async () => {
    const payload = makePayload()
    await runDemoSeeds(payload, { reset: true })
    expect(resetCollections).toHaveBeenCalledWith(payload, 'demo')
  })

  it('aggregates warnings and failures from collection imports', async () => {
    importCollection
      .mockResolvedValueOnce({ name: 'demo-one', created: 1, updated: 0, warnings: ['w1'], failures: [] })
      .mockResolvedValueOnce({ name: 'demo-two', created: 0, updated: 1, warnings: [], failures: ['f1'] })

    const payload = makePayload()
    const outcome = await runDemoSeeds(payload, { reset: false })

    expect(outcome.units).toHaveLength(2)
    expect(outcome.warnings).toContain('w1')
    expect(outcome.failures).toContain('f1')
  })
})
