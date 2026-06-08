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

function makePayload(overrides?: Partial<Payload>): Payload {
  return {
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    find: vi.fn(async () => ({ docs: [] })),
    ...(overrides ?? {}),
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

  it('creates deep nested objects when mapping dotted target paths', async () => {
    mockLoadSeedFile.mockResolvedValueOnce([{ stableId: 'r-1', cityRef: 'city-1' }])

    await importCollection({
      payload: makePayload(),
      kind: 'demo',
      collection: 'clinics',
      fileName: 'clinics',
      mapping: [
        {
          sourceField: 'cityRef',
          targetField: 'address.location.city.id',
          collection: 'cities',
        },
      ],
      resolvers: makeResolvers(),
    })

    const payloadData = mockUpsertByStableId.mock.calls[0]?.[2] as Record<string, unknown> | undefined
    expect(payloadData?.address).toEqual({
      location: {
        city: {
          id: 'city-1-id',
        },
      },
    })
  })

  it('overwrites non-object intermediates when mapping nested values', async () => {
    mockLoadSeedFile.mockResolvedValueOnce([{ stableId: 'r-1', cityRef: 'city-1', address: 'not-an-object' }])

    await importCollection({
      payload: makePayload(),
      kind: 'demo',
      collection: 'clinics',
      fileName: 'clinics',
      mapping: [
        {
          sourceField: 'cityRef',
          targetField: 'address.city',
          collection: 'cities',
        },
      ],
      resolvers: makeResolvers(),
    })

    const payloadData = mockUpsertByStableId.mock.calls[0]?.[2] as Record<string, unknown> | undefined
    expect(payloadData?.address).toEqual({ city: 'city-1-id' })
  })

  it('skips empty path segments when mapping dotted target paths', async () => {
    mockLoadSeedFile.mockResolvedValueOnce([{ stableId: 'r-1', cityRef: 'city-1' }])

    await importCollection({
      payload: makePayload(),
      kind: 'demo',
      collection: 'clinics',
      fileName: 'clinics',
      mapping: [
        {
          sourceField: 'cityRef',
          targetField: 'address..city',
          collection: 'cities',
        },
      ],
      resolvers: makeResolvers(),
    })

    const payloadData = mockUpsertByStableId.mock.calls[0]?.[2] as Record<string, unknown> | undefined
    expect(payloadData?.address).toEqual({ city: 'city-1-id' })
  })

  it('does not throw when mapping an empty target path', async () => {
    mockLoadSeedFile.mockResolvedValueOnce([{ stableId: 'r-1', cityRef: 'city-1' }])

    await importCollection({
      payload: makePayload(),
      kind: 'demo',
      collection: 'clinics',
      fileName: 'clinics',
      mapping: [
        {
          sourceField: 'cityRef',
          targetField: '',
          collection: 'cities',
        },
      ],
      resolvers: makeResolvers(),
    })

    const payloadData = mockUpsertByStableId.mock.calls[0]?.[2] as Record<string, unknown> | undefined
    expect(payloadData?.cityRef).toBeUndefined()
    expect(payloadData && Object.prototype.hasOwnProperty.call(payloadData, '')).toBe(false)
  })

  it('maps review patient relations from patient stableIds', async () => {
    mockLoadSeedFile.mockResolvedValueOnce([{ stableId: 'review-1', patientStableId: 'seed-patient-maya-kaya' }])

    const outcome = await importCollection({
      payload: makePayload(),
      kind: 'demo',
      collection: 'reviews',
      fileName: 'reviews',
      mapping: [
        {
          sourceField: 'patientStableId',
          targetField: 'patient',
          collection: 'patients',
          required: true,
        },
      ],
      resolvers: makeResolvers(),
    })

    expect(mockUpsertByStableId).toHaveBeenCalledTimes(1)
    const payloadData = mockUpsertByStableId.mock.calls[0]?.[2] as Record<string, unknown> | undefined
    expect(payloadData?.patient).toBe('seed-patient-maya-kaya-id')
    expect(outcome.warnings).toHaveLength(0)
  })

  it('skips required review patient relation when patient stableId cannot be resolved', async () => {
    mockLoadSeedFile.mockResolvedValueOnce([{ stableId: 'review-1', patientStableId: 'unknown-patient' }])

    const resolvers = makeResolvers()
    vi.spyOn(resolvers, 'resolveIdByStableId').mockResolvedValue(null)

    const outcome = await importCollection({
      payload: makePayload(),
      kind: 'demo',
      collection: 'reviews',
      fileName: 'reviews',
      mapping: [
        {
          sourceField: 'patientStableId',
          targetField: 'patient',
          collection: 'patients',
          required: true,
        },
      ],
      resolvers,
    })

    expect(mockUpsertByStableId).not.toHaveBeenCalled()
    expect(outcome.created).toBe(0)
    expect(outcome.warnings).toContainEqual(expect.stringMatching(/Missing patients/))
  })

  it('merges default data into each imported record', async () => {
    mockLoadSeedFile.mockResolvedValueOnce([{ stableId: 'media-1', alt: 'Dental category image' }])

    await importCollection({
      payload: makePayload(),
      kind: 'baseline',
      collection: 'platformContentMedia',
      fileName: 'platformContentMedia',
      defaults: {
        createdBy: 42,
      },
      resolvers: makeResolvers(),
    })

    const payloadData = mockUpsertByStableId.mock.calls[0]?.[2] as Record<string, unknown> | undefined
    expect(payloadData?.createdBy).toBe(42)
    expect(payloadData?.alt).toBe('Dental category image')
  })

  it('preserves localized field objects for locale-aware seed records', async () => {
    const localizedContent = {
      en: {
        root: {
          type: 'root',
          children: [],
          direction: 'ltr',
          format: '',
          indent: 0,
          version: 1,
        },
      },
      de: {
        root: {
          type: 'root',
          children: [],
          direction: 'ltr',
          format: '',
          indent: 0,
          version: 1,
        },
      },
    }

    mockLoadSeedFile.mockResolvedValueOnce([
      {
        stableId: 'post-1',
        slug: 'localized-post',
        title: { en: 'English title', de: 'Deutscher Titel' },
        excerpt: { en: 'English excerpt', de: 'Deutscher Auszug' },
        content: localizedContent,
        meta: {
          title: { en: 'English SEO', de: 'Deutscher SEO' },
          description: { en: 'English description', de: 'Deutsche Beschreibung' },
        },
      },
    ])

    await importCollection({
      payload: makePayload(),
      kind: 'demo',
      collection: 'posts',
      fileName: 'posts',
      resolvers: makeResolvers(),
    })

    const payloadData = mockUpsertByStableId.mock.calls[0]?.[2] as Record<string, unknown> | undefined
    expect(payloadData?.title).toEqual({ en: 'English title', de: 'Deutscher Titel' })
    expect(payloadData?.excerpt).toEqual({ en: 'English excerpt', de: 'Deutscher Auszug' })
    expect(payloadData?.content).toEqual(localizedContent)
    expect(payloadData?.meta).toEqual({
      title: { en: 'English SEO', de: 'Deutscher SEO' },
      description: { en: 'English description', de: 'Deutsche Beschreibung' },
    })
  })

  it('splits configured localized fields into default upsert and locale updates', async () => {
    const englishContent = {
      root: {
        type: 'root',
        children: [],
        direction: 'ltr',
        format: '',
        indent: 0,
        version: 1,
      },
    }
    const germanContent = {
      root: {
        type: 'root',
        children: [],
        direction: 'ltr',
        format: '',
        indent: 0,
        version: 1,
      },
    }
    const update = vi.fn(async () => ({ id: 'post-1-id' }))

    mockLoadSeedFile.mockResolvedValueOnce([
      {
        stableId: 'post-1',
        slug: 'localized-post',
        title: { en: 'English title', de: 'Deutscher Titel' },
        excerpt: { en: 'English excerpt', de: 'Deutscher Auszug' },
        content: { en: englishContent, de: germanContent },
        meta: {
          title: { en: 'English SEO', de: 'Deutscher SEO' },
          description: { en: 'English description', de: 'Deutsche Beschreibung' },
        },
      },
    ])

    await importCollection({
      payload: makePayload({ update: update as unknown as Payload['update'] }),
      kind: 'demo',
      collection: 'posts',
      fileName: 'posts',
      localizedFields: ['title', 'content', 'excerpt', 'meta.title', 'meta.description'],
      resolvers: makeResolvers(),
    })

    const payloadData = mockUpsertByStableId.mock.calls[0]?.[2] as Record<string, unknown> | undefined
    expect(payloadData?.title).toBe('English title')
    expect(payloadData?.excerpt).toBe('English excerpt')
    expect(payloadData?.content).toEqual(englishContent)
    expect(payloadData?.meta).toEqual({
      title: 'English SEO',
      description: 'English description',
    })

    expect(update).toHaveBeenCalledWith({
      collection: 'posts',
      id: 'post-1-id',
      locale: 'de',
      data: {
        title: 'Deutscher Titel',
        excerpt: 'Deutscher Auszug',
        content: germanContent,
        meta: {
          title: 'Deutscher SEO',
          description: 'Deutsche Beschreibung',
        },
      },
      trash: true,
      overrideAccess: true,
      context: {
        disableRevalidate: true,
        disableSearchSync: true,
      },
      req: undefined,
    })
  })
})
