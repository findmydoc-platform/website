import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'
import type { CollectionSlug } from 'payload'
import type { StableIdResolvers } from '@/endpoints/seed/utils/resolvers'

const mockLoadSeedFile = vi.hoisted(() => vi.fn())
const mockUpsertByStableId = vi.hoisted(() => vi.fn())

vi.mock('@/endpoints/seed/utils/load-json', () => ({
  loadSeedFile: mockLoadSeedFile,
}))

vi.mock('@/endpoints/seed/utils/upsert', () => ({
  upsertByStableId: mockUpsertByStableId,
}))

import { importCollection } from '@/endpoints/seed/utils/import-collection'

function makeResolvers(): StableIdResolvers {
  return {
    resolveIdByStableId: vi.fn(async (_collection: CollectionSlug, stableId: string) => `${stableId}-id`),
    resolveManyIdsByStableIds: vi.fn(async (_collection: CollectionSlug, stableIds: string[]) => ({
      ids: stableIds.map((id) => `${id}-id`),
      missing: [],
    })),
    resolveStableIdById: vi.fn(async () => 'cached-stable'),
    resolveManyStableIdsByIds: vi.fn(async () => ({ stableIds: ['cached-stable'], missing: [] })),
  }
}

function makePayload(): Payload {
  return {
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  } as unknown as Payload
}

describe('importCollection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpsertByStableId.mockResolvedValue({ created: true, updated: false })
  })

  it('maps single relations and upserts records', async () => {
    mockLoadSeedFile.mockResolvedValueOnce([{ stableId: 'r-1', cityRef: 'city-1', name: 'Clinic' }])

    const outcome = await importCollection({
      payload: makePayload(),
      kind: 'demo',
      collection: 'clinics',
      fileName: 'clinics',
      mapping: [
        {
          sourceField: 'cityRef',
          targetField: 'address.city',
          collection: 'cities',
          required: true,
        },
      ],
      resolvers: makeResolvers(),
    })

    expect(mockUpsertByStableId).toHaveBeenCalledTimes(1)
    const payloadData = mockUpsertByStableId.mock.calls[0]?.[2] as Record<string, unknown> | undefined
    expect(payloadData?.['address']).toEqual({ city: 'city-1-id' })
    expect(outcome.created).toBe(1)
    expect(outcome.warnings).toHaveLength(0)
    expect(outcome.failures).toHaveLength(0)
  })

  it('skips required relations when missing and records warnings', async () => {
    mockLoadSeedFile.mockResolvedValueOnce([{ stableId: 'r-1', cityRef: null }])

    const outcome = await importCollection({
      payload: makePayload(),
      kind: 'demo',
      collection: 'clinics',
      fileName: 'clinics',
      mapping: [
        {
          sourceField: 'cityRef',
          targetField: 'address.city',
          collection: 'cities',
          required: true,
        },
      ],
      resolvers: makeResolvers(),
    })

    expect(mockUpsertByStableId).not.toHaveBeenCalled()
    expect(outcome.created).toBe(0)
    expect(outcome.warnings).toContainEqual(expect.stringMatching(/Missing cityRef/))
  })

  it('handles many-to-many mappings with partial missing references', async () => {
    mockLoadSeedFile.mockResolvedValueOnce([{ stableId: 'r-1', tagRefs: ['tag-a', 'tag-missing'] }])

    const resolvers = makeResolvers()
    vi.spyOn(resolvers, 'resolveManyIdsByStableIds').mockResolvedValueOnce({
      ids: ['tag-a-id'],
      missing: ['tag-missing'],
    })

    const outcome = await importCollection({
      payload: makePayload(),
      kind: 'demo',
      collection: 'clinics',
      fileName: 'clinics',
      mapping: [
        {
          sourceField: 'tagRefs',
          targetField: 'tags',
          collection: 'tags',
          many: true,
        },
      ],
      resolvers,
    })

    expect(mockUpsertByStableId).toHaveBeenCalledTimes(1)
    const payloadData = mockUpsertByStableId.mock.calls[0]?.[2] as Record<string, unknown> | undefined
    expect(payloadData?.tags).toEqual(['tag-a-id'])
    expect(outcome.warnings).toContainEqual(expect.stringMatching(/Missing tags/))
    expect(outcome.failures).toHaveLength(0)
  })
})
