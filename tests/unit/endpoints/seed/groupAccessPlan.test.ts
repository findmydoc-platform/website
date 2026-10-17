import { describe, expect, it, vi } from 'vitest'
import { buildSeedQueueJobs } from '@/endpoints/seed/utils/planner'

describe('group-access demo seed execution', () => {
  it('queues two private groups before clinic references with the existing platform seed operator', async () => {
    const jobs = await buildSeedQueueJobs({
      runId: 'group-acceptance',
      type: 'demo',
      reset: false,
      queue: 'seed:group-acceptance',
    })
    const groups = jobs.find(({ input }) => input.collection === 'clinicGroups')
    const clinics = jobs.find(({ input }) => input.stepName === 'clinics')

    expect(groups?.input).toMatchObject({
      kind: 'collection',
      reqUserStableId: 'seed-platform-admin',
      stableIds: ['seed-group-coastal', 'seed-group-capital'],
    })
    expect(jobs.indexOf(groups!)).toBeLessThan(jobs.indexOf(clinics!))
    expect(clinics?.input).toMatchObject({
      reqUserStableId: 'seed-platform-admin',
      mapping: expect.arrayContaining([
        {
          sourceField: 'groupStableId',
          targetField: 'group',
          collection: 'clinicGroups',
          required: true,
          nullable: true,
        },
      ]),
    })
  })
})

it('imports an explicitly independent clinic while refusing an unresolved required group', async () => {
  const { importCollection } = await import('@/endpoints/seed/utils/import-collection')
  const { createStableIdResolvers } = await import('@/endpoints/seed/utils/resolvers')
  const created: Record<string, unknown>[] = []
  const payload = {
    logger: { info: () => {}, warn: () => {}, error: () => {} },
    find: async () => ({ docs: [], totalDocs: 0 }),
    create: async ({ data }: { data: Record<string, unknown> }) => {
      created.push(data)
      return { id: created.length }
    },
  } as unknown as import('payload').Payload
  const mapping = [
    {
      sourceField: 'groupStableId',
      targetField: 'group',
      collection: 'clinicGroups' as const,
      required: true,
      nullable: true,
    },
  ]
  const independent = await importCollection({
    payload,
    kind: 'demo',
    collection: 'clinics',
    fileName: 'clinics',
    stableIds: ['seed-clinic-antalya-medvista'],
    mapping,
    resolvers: createStableIdResolvers(payload),
  })
  expect(independent.created).toBe(1)
  expect(created[0]).toMatchObject({ stableId: 'seed-clinic-antalya-medvista', group: null })
  const unresolved = await importCollection({
    payload,
    kind: 'demo',
    collection: 'clinics',
    fileName: 'clinics',
    stableIds: ['seed-clinic-izmir-coast'],
    mapping,
    resolvers: createStableIdResolvers(payload),
  })
  expect(unresolved.created).toBe(0)
  expect(unresolved.warnings).toContainEqual(
    expect.stringContaining('Missing clinicGroups for clinics:seed-clinic-izmir-coast'),
  )
  expect(created).toHaveLength(1)
})

it('rejects direct demo group imports in Production while retaining baseline references', async () => {
  const { importCollection } = await import('@/endpoints/seed/utils/import-collection')
  const { createStableIdResolvers } = await import('@/endpoints/seed/utils/resolvers')
  const create = vi.fn(async () => ({ id: 1 }))
  const payload = {
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    find: vi.fn(async () => ({ docs: [], totalDocs: 0 })),
    create,
  } as unknown as import('payload').Payload
  vi.stubEnv('VERCEL_ENV', 'production')
  vi.stubEnv('DEPLOYMENT_ENV', 'production')
  vi.stubEnv('NODE_ENV', 'production')
  try {
    await expect(
      importCollection({
        payload,
        kind: 'demo',
        collection: 'clinicGroups',
        fileName: 'clinicGroups',
        resolvers: createStableIdResolvers(payload),
      }),
    ).rejects.toThrow('Demo seeding is disabled in production runtime')
    expect(create).not.toHaveBeenCalled()
    const baseline = await importCollection({
      payload,
      kind: 'baseline',
      collection: 'tags',
      fileName: 'tags',
      resolvers: createStableIdResolvers(payload),
    })
    expect(baseline.failures).toEqual([])
    expect(baseline.created).toBeGreaterThan(0)
  } finally {
    vi.unstubAllEnvs()
  }
})
