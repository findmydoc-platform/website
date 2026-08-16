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
  const findVersions = vi.fn()
  const create = vi.fn()
  const update = vi.fn()
  const payload = {
    find,
    findVersions,
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
      overrideAccess: true,
      context: {
        disableRevalidate: true,
        seedMediaExpectedNoSuchKeyRecovery: false,
      },
      req: {
        context: {
          disableRevalidate: true,
          seedMediaExpectedNoSuchKeyRecovery: false,
        },
      },
    })
  })

  it('skips an intermediate seed snapshot that already exists in version history', async () => {
    find.mockResolvedValue({ totalDocs: 1, docs: [{ id: 'existing-id' }] })
    findVersions.mockResolvedValue({
      docs: [
        {
          version: {
            stableId: 'seed-review-06',
            publicMeasure: 'placeholder',
            publicComment: null,
          },
        },
      ],
    })

    const result = await upsertByStableId(
      payload,
      'reviews',
      {
        stableId: 'seed-review-06',
        publicMeasure: 'placeholder',
        publicComment: null,
      },
      { policy: { skipIfVersionMatches: true } },
    )

    expect(result).toEqual({ created: false, updated: false })
    expect(findVersions).toHaveBeenCalledWith({
      collection: 'reviews',
      depth: 0,
      overrideAccess: true,
      pagination: false,
      where: { parent: { equals: 'existing-id' } },
    })
    expect(update).not.toHaveBeenCalled()
  })

  it('updates a terminal seed snapshot when only an older version matches', async () => {
    find.mockResolvedValue({
      totalDocs: 1,
      docs: [
        {
          id: 'existing-id',
          stableId: 'seed-review-06',
          publicMeasure: 'placeholder',
          publicComment: null,
        },
      ],
    })
    findVersions.mockResolvedValue({
      docs: [
        {
          version: {
            stableId: 'seed-review-06',
            publicMeasure: 'redaction',
            publicComment: 'Care was otherwise excellent.',
          },
        },
      ],
    })
    update.mockResolvedValue({ id: 'existing-id' })

    const result = await upsertByStableId(
      payload,
      'reviews',
      {
        stableId: 'seed-review-06',
        publicMeasure: 'redaction',
        publicComment: 'Care was otherwise excellent.',
      },
      { policy: { skipIfCurrentMatches: true } },
    )

    expect(result).toEqual({ created: false, updated: true })
    expect(findVersions).not.toHaveBeenCalled()
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'reviews',
        id: 'existing-id',
        data: {
          stableId: 'seed-review-06',
          publicMeasure: 'redaction',
          publicComment: 'Care was otherwise excellent.',
        },
      }),
    )
  })

  it('skips a terminal seed snapshot when the current document matches', async () => {
    find.mockResolvedValue({
      totalDocs: 1,
      docs: [
        {
          id: 'existing-id',
          stableId: 'seed-review-06',
          publicMeasure: 'redaction',
          publicComment: 'Care was otherwise excellent.',
        },
      ],
    })

    const result = await upsertByStableId(
      payload,
      'reviews',
      {
        stableId: 'seed-review-06',
        publicMeasure: 'redaction',
        publicComment: 'Care was otherwise excellent.',
      },
      { policy: { skipIfCurrentMatches: true } },
    )

    expect(result).toEqual({ created: false, updated: false })
    expect(findVersions).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })

  it('reconciles a review response by its unique review while preserving the existing stable ID', async () => {
    find.mockResolvedValueOnce({ totalDocs: 0, docs: [] }).mockResolvedValueOnce({
      totalDocs: 1,
      docs: [
        {
          id: 'existing-response-id',
          stableId: 'generated-response-id',
          review: 'review-id',
          moderationStatus: 'pending',
        },
      ],
    })
    update.mockResolvedValue({ id: 'existing-response-id' })

    const result = await upsertByStableId(
      payload,
      'reviewResponses',
      {
        stableId: 'seed-review-response-id',
        review: 'review-id',
        moderationStatus: 'approved',
      },
      {
        policy: {
          reconcileByUniqueFields: ['review'],
          skipIfCurrentMatches: true,
        },
      },
    )

    expect(result).toEqual({ created: false, updated: true })
    expect(find).toHaveBeenNthCalledWith(2, {
      collection: 'reviewResponses',
      depth: 0,
      where: { review: { equals: 'review-id' } },
      limit: 2,
      trash: true,
      overrideAccess: true,
    })
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'reviewResponses',
        id: 'existing-response-id',
        data: {
          stableId: 'generated-response-id',
          review: 'review-id',
          moderationStatus: 'approved',
        },
      }),
    )
  })

  it('skips a reconciled review response when its current workflow snapshot matches', async () => {
    find.mockResolvedValueOnce({ totalDocs: 0, docs: [] }).mockResolvedValueOnce({
      totalDocs: 1,
      docs: [
        {
          id: 'existing-response-id',
          stableId: 'generated-response-id',
          review: 'review-id',
          moderationStatus: 'approved',
        },
      ],
    })

    const result = await upsertByStableId(
      payload,
      'reviewResponses',
      {
        stableId: 'seed-review-response-id',
        review: 'review-id',
        moderationStatus: 'approved',
      },
      {
        policy: {
          reconcileByUniqueFields: ['review'],
          skipIfCurrentMatches: true,
        },
      },
    )

    expect(result).toEqual({ created: false, updated: false })
    expect(update).not.toHaveBeenCalled()
  })
})

describe('resetCollections', () => {
  const find = vi.fn()
  const update = vi.fn()
  const deleteDocuments = vi.fn()
  const collectionConfigs = [
    {
      slug: 'platformStaff',
      fields: [{ name: 'profileImage', type: 'upload', relationTo: 'userProfileMedia' }],
    },
    {
      slug: 'clinicStaff',
      fields: [
        { name: 'profileImage', type: 'upload', relationTo: 'userProfileMedia' },
        { name: 'clinic', type: 'relationship', relationTo: 'clinics' },
      ],
    },
    {
      slug: 'patients',
      fields: [
        { name: 'profileImage', type: 'upload', relationTo: 'userProfileMedia' },
        { name: 'country', type: 'relationship', relationTo: 'countries' },
      ],
    },
  ]

  const payload = {
    config: {
      collections: collectionConfigs,
    },
    delete: deleteDocuments,
    find,
    logger: {
      info: vi.fn(),
    },
    update,
  } as unknown as Payload

  afterEach(() => {
    vi.clearAllMocks()
    find.mockResolvedValue({ docs: [] })
    update.mockResolvedValue({ id: 'updated' })
    deleteDocuments.mockResolvedValue({ docs: [], errors: [] })
    vi.unstubAllEnvs()
  })

  it('throws for baseline reset in production', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    vi.stubEnv('DEPLOYMENT_ENV', 'production')
    vi.stubEnv('NODE_ENV', 'production')

    await expect(resetCollections(payload, 'baseline')).rejects.toThrow(/seed reset is disabled in this runtime/i)
    expect(deleteDocuments).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
    expect(find).not.toHaveBeenCalled()
  })

  it('throws for demo reset in production', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    vi.stubEnv('DEPLOYMENT_ENV', 'production')
    vi.stubEnv('NODE_ENV', 'production')

    await expect(resetCollections(payload, 'demo')).rejects.toThrow(/demo reset is disabled in production/i)
    expect(deleteDocuments).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
    expect(find).not.toHaveBeenCalled()
  })

  it('returns the post slugs that must be invalidated after reset', async () => {
    vi.stubEnv('VERCEL_ENV', '')
    vi.stubEnv('DEPLOYMENT_ENV', '')
    vi.stubEnv('NODE_ENV', 'test')
    find.mockImplementation(async ({ collection }: { collection: string }) => ({
      docs:
        collection === 'posts'
          ? [{ slug: ' old-post ' }, { slug: 'another-post' }, { slug: 'old-post' }, { slug: null }]
          : [],
    }))

    const result = await resetCollections(payload, 'demo')

    expect(result).toEqual({ affectedPostSlugs: ['another-post', 'old-post'] })
    expect(find).toHaveBeenCalledWith({
      collection: 'posts',
      depth: 0,
      overrideAccess: true,
      pagination: false,
      select: { slug: true },
      trash: true,
    })
  })

  it('deletes demo collections in order for demo reset', async () => {
    vi.stubEnv('VERCEL_ENV', '')
    vi.stubEnv('DEPLOYMENT_ENV', '')
    vi.stubEnv('NODE_ENV', 'test')

    const expectedOrder = [
      'reviewAppeals',
      'reviewResponses',
      'reviews',
      'patientClinicInquiries',
      'favoriteclinics',
      'doctortreatments',
      'doctorspecialties',
      'clinictreatments',
      'clinicProfileDrafts',
      'clinicMedia',
      'doctorMedia',
      'doctors',
      'clinics',
      'posts',
      'userProfileMedia',
      'platformContentMedia',
    ]

    await resetCollections(payload, 'demo')

    const actualOrder = deleteDocuments.mock.calls.map((call: unknown[]) => {
      const args = call[0] as { collection: string }
      return args.collection
    })

    expect(actualOrder).toEqual(expectedOrder)
    expect(deleteDocuments).toHaveBeenCalledTimes(expectedOrder.length)
    for (const [args] of deleteDocuments.mock.calls) {
      expect(args).toEqual(
        expect.objectContaining({
          context: expect.objectContaining({ seedReset: true, skipHooks: true }),
          disableTransaction: true,
        }),
      )
    }

    const platformContentMediaDelete = deleteDocuments.mock.calls.find((call: unknown[]) => {
      return (call[0] as { collection: string }).collection === 'platformContentMedia'
    })?.[0] as { trash: boolean; where: { stableId: { in: string[] } } } | undefined

    expect(platformContentMediaDelete?.trash).toBe(true)
    expect(platformContentMediaDelete?.where.stableId.in.length).toBeGreaterThan(0)
    expect(platformContentMediaDelete?.where.stableId.in).toEqual(expect.arrayContaining([expect.any(String)]))
  })

  it('publishes the reset cache scope before the first destructive mutation', async () => {
    vi.stubEnv('VERCEL_ENV', '')
    vi.stubEnv('DEPLOYMENT_ENV', 'test')
    vi.stubEnv('NODE_ENV', 'test')
    const events: string[] = []
    deleteDocuments.mockImplementation(async () => {
      events.push('delete')
      return { docs: [], errors: [] }
    })

    await resetCollections(payload, 'demo', {
      onPrepared: ({ affectedPostSlugs }) => {
        expect(affectedPostSlugs).toEqual([])
        events.push('prepared')
      },
    })

    expect(events[0]).toBe('prepared')
    expect(events[1]).toBe('delete')
  })

  it('preserves every principal and clears only resettable relations without Supabase synchronization', async () => {
    vi.stubEnv('VERCEL_ENV', '')
    vi.stubEnv('DEPLOYMENT_ENV', 'test')
    vi.stubEnv('NODE_ENV', 'test')

    find.mockImplementation(async ({ collection, where }: { collection: string; where?: Record<string, unknown> }) => {
      if (collection === 'posts') return { docs: [] }
      if (collection === 'platformStaff') return { docs: [{ id: 'platform-1' }] }
      if (collection === 'clinicStaff') return { docs: [{ id: 'clinic-staff-1' }] }
      if (collection === 'patients') return { docs: [{ id: 'patient-1' }] }
      throw new Error(`Unexpected find: ${collection}:${JSON.stringify(where)}`)
    })

    await resetCollections(payload, 'demo')

    expect(update).toHaveBeenCalledTimes(3)
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'platformStaff',
        id: 'platform-1',
        data: { profileImage: null },
        context: expect.objectContaining({ skipClinicStaffAuthSync: true }),
      }),
    )
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'clinicStaff',
        id: 'clinic-staff-1',
        data: { clinic: null, profileImage: null },
        context: expect.objectContaining({ skipClinicStaffAuthSync: true }),
      }),
    )
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'patients',
        id: 'patient-1',
        data: { profileImage: null },
      }),
    )

    const deletedCollections = deleteDocuments.mock.calls.map((call: unknown[]) => {
      return (call[0] as { collection: string }).collection
    })
    expect(deletedCollections).not.toContain('search')
    expect(deletedCollections).not.toContain('platformStaff')
    expect(deletedCollections).not.toContain('clinicStaff')
    expect(deletedCollections).not.toContain('patients')
  })

  it('clears baseline-only patient country relations before deleting countries', async () => {
    vi.stubEnv('VERCEL_ENV', '')
    vi.stubEnv('DEPLOYMENT_ENV', 'test')
    vi.stubEnv('NODE_ENV', 'test')

    find.mockImplementation(async ({ collection, where }: { collection: string; where?: Record<string, unknown> }) => {
      if (collection === 'posts') return { docs: [] }
      if (collection === 'patients' && where && 'country' in where) return { docs: [{ id: 'patient-1' }] }
      return { docs: [] }
    })

    await resetCollections(payload, 'baseline')

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'patients',
        id: 'patient-1',
        data: { country: null },
      }),
    )
  })

  it('fails preflight before any mutation when a protected relation becomes required', async () => {
    vi.stubEnv('VERCEL_ENV', '')
    vi.stubEnv('DEPLOYMENT_ENV', 'test')
    vi.stubEnv('NODE_ENV', 'test')

    const unsafePayload = {
      ...payload,
      config: {
        collections: collectionConfigs.map((collection) =>
          collection.slug === 'clinicStaff'
            ? {
                ...collection,
                fields: collection.fields.map((field) =>
                  field.name === 'clinic' ? { ...field, required: true } : field,
                ),
              }
            : collection,
        ),
      },
    } as unknown as Payload

    await expect(resetCollections(unsafePayload, 'demo')).rejects.toThrow(
      /clinicStaff\.clinic cannot be cleared safely/,
    )
    expect(update).not.toHaveBeenCalled()
    expect(deleteDocuments).not.toHaveBeenCalled()
  })

  it('surfaces Payload lifecycle delete errors instead of continuing', async () => {
    vi.stubEnv('VERCEL_ENV', '')
    vi.stubEnv('DEPLOYMENT_ENV', 'test')
    vi.stubEnv('NODE_ENV', 'test')
    deleteDocuments.mockResolvedValueOnce({ docs: [], errors: [{ id: 'appeal-1', message: 'blocked' }] })

    await expect(resetCollections(payload, 'demo')).rejects.toThrow(
      /Seed reset failed while deleting reviewAppeals: appeal-1: blocked/,
    )
    expect(deleteDocuments).toHaveBeenCalledTimes(1)
  })

  it('deletes demo then baseline collections for baseline reset', async () => {
    vi.stubEnv('VERCEL_ENV', '')
    vi.stubEnv('DEPLOYMENT_ENV', '')
    vi.stubEnv('NODE_ENV', 'test')

    const expectedOrder = [
      'reviewAppeals',
      'reviewResponses',
      'reviews',
      'patientClinicInquiries',
      'favoriteclinics',
      'doctortreatments',
      'doctorspecialties',
      'clinictreatments',
      'clinicProfileDrafts',
      'clinicMedia',
      'doctorMedia',
      'doctors',
      'clinics',
      'posts',
      'userProfileMedia',
      'platformContentMedia',
      'treatments',
      'categories',
      'tags',
      'accreditation',
      'medical-specialties',
      'cities',
      'countries',
    ]

    await resetCollections(payload, 'baseline')

    const actualOrder = deleteDocuments.mock.calls.map((call: unknown[]) => {
      const args = call[0] as { collection: string }
      return args.collection
    })

    expect(actualOrder).toEqual(expectedOrder)
    expect(deleteDocuments).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'platformContentMedia', where: { id: { exists: true } } }),
    )
  })
})
