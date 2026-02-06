import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'
import { createStableIdResolvers } from '@/endpoints/seed/utils/resolvers'
import { upsertByStableId } from '@/endpoints/seed/utils/upsert'
import { resetCollections } from '@/endpoints/seed/utils/reset'

describe('stableId resolvers', () => {
  const find = vi.fn()
  const findByID = vi.fn()
  const payload = {
    find,
    findByID,
  } as unknown as Payload

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('caches resolveIdByStableId results', async () => {
    find.mockResolvedValue({ docs: [{ id: 'doc-1', stableId: 's-1' }], totalDocs: 1 })
    const resolvers = createStableIdResolvers(payload)

    const first = await resolvers.resolveIdByStableId('clinics', 's-1')
    const second = await resolvers.resolveIdByStableId('clinics', 's-1')

    expect(first).toBe('doc-1')
    expect(second).toBe('doc-1')
    expect(find).toHaveBeenCalledTimes(1)
  })

  it('returns missing stableIds in resolveManyIdsByStableIds', async () => {
    find.mockResolvedValue({ docs: [], totalDocs: 0 })
    const resolvers = createStableIdResolvers(payload)

    const outcome = await resolvers.resolveManyIdsByStableIds('tags', ['a', 'b'])
    expect(outcome.ids).toHaveLength(0)
    expect(outcome.missing).toEqual(['a', 'b'])
  })

  it('caches resolveStableIdById results', async () => {
    findByID.mockResolvedValue({ id: 'doc-2', stableId: 's-2' })
    const resolvers = createStableIdResolvers(payload)

    const first = await resolvers.resolveStableIdById('cities', 'doc-2')
    const second = await resolvers.resolveStableIdById('cities', 'doc-2')

    expect(first).toBe('s-2')
    expect(second).toBe('s-2')
    expect(findByID).toHaveBeenCalledTimes(1)
  })
})

describe('upsertByStableId', () => {
  const find = vi.fn()
  const create = vi.fn()
  const update = vi.fn()
  const payload = {
    find,
    create,
    update,
  } as unknown as Payload

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('creates when no existing doc', async () => {
    find.mockResolvedValue({ totalDocs: 0, docs: [] })
    create.mockResolvedValue({ id: 'new-id' })

    const result = await upsertByStableId(payload, 'clinics', { stableId: 's-1', name: 'Clinic' })
    expect(result.created).toBe(true)
    expect(result.updated).toBe(false)
    expect(create).toHaveBeenCalled()
  })

  it('updates when doc exists', async () => {
    find.mockResolvedValue({ totalDocs: 1, docs: [{ id: 'existing-id' }] })
    update.mockResolvedValue({ id: 'existing-id', name: 'Updated' })

    const result = await upsertByStableId(payload, 'clinics', { stableId: 's-1', name: 'Clinic' })
    expect(result.created).toBe(false)
    expect(result.updated).toBe(true)
    expect(update).toHaveBeenCalledWith({
      collection: 'clinics',
      id: 'existing-id',
      data: { stableId: 's-1', name: 'Clinic' },
      trash: true,
      overrideAccess: true,
      context: { disableRevalidate: true },
    })
  })
})

describe('resetCollections', () => {
  const find = vi.fn()
  const del = vi.fn()

  const payload = {
    logger: {
      info: vi.fn(),
    },
    find,
    delete: del,
  } as unknown as Payload

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('throws in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    await expect(resetCollections(payload, 'baseline')).rejects.toThrow(/disabled in production/i)
    expect(payload.find).not.toHaveBeenCalled()
    expect(payload.delete).not.toHaveBeenCalled()
  })

  function mockFindOneDocThenEmptyForCollections(collections: string[]) {
    for (let i = 0; i < collections.length; i += 1) {
      find.mockResolvedValueOnce({ docs: [{ id: 'c1' }] })
      find.mockResolvedValueOnce({ docs: [] })
    }
  }

  it('deletes demo collections in order for demo reset', async () => {
    vi.stubEnv('NODE_ENV', 'test')

    const expectedOrder = [
      'reviews',
      'favoriteclinics',
      'doctortreatments',
      'doctorspecialties',
      'clinictreatments',
      'doctors',
      'clinics',
      'posts',
      'platformContentMedia',
      'basicUsers',
    ]

    mockFindOneDocThenEmptyForCollections(expectedOrder)
    del.mockResolvedValue(undefined)

    await resetCollections(payload, 'demo')

    const actualOrder = del.mock.calls.map((call: unknown[]) => {
      const args = call[0] as unknown
      return (args as { collection: string }).collection
    })

    expect(actualOrder).toEqual(expectedOrder)
  })

  it('deletes demo then baseline collections for baseline reset', async () => {
    vi.stubEnv('NODE_ENV', 'test')

    const expectedOrder = [
      'reviews',
      'favoriteclinics',
      'doctortreatments',
      'doctorspecialties',
      'clinictreatments',
      'doctors',
      'clinics',
      'posts',
      'platformContentMedia',
      'basicUsers',
      'treatments',
      'categories',
      'tags',
      'accreditation',
      'medical-specialties',
      'cities',
      'countries',
    ]

    mockFindOneDocThenEmptyForCollections(expectedOrder)
    del.mockResolvedValue(undefined)

    await resetCollections(payload, 'baseline')

    const actualOrder = del.mock.calls.map((call: unknown[]) => {
      const args = call[0] as unknown
      return (args as { collection: string }).collection
    })

    expect(actualOrder).toEqual(expectedOrder)
  })
})
