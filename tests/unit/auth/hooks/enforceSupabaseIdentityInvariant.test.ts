import { describe, expect, it, vi } from 'vitest'
import { enforceSupabaseIdentityInvariant } from '@/auth/hooks/enforceSupabaseIdentityInvariant'

describe('enforceSupabaseIdentityInvariant', () => {
  it('checks principal collections sequentially through Payload', async () => {
    let activeQueries = 0
    let maximumConcurrentQueries = 0
    const find = vi.fn(async (_query: Record<string, unknown>) => {
      activeQueries += 1
      maximumConcurrentQueries = Math.max(maximumConcurrentQueries, activeQueries)
      await Promise.resolve()
      activeQueries -= 1
      return { docs: [] }
    })

    const data = { supabaseUserId: 'supabase-user-1' }
    const req = { payload: { find } }
    const result = await enforceSupabaseIdentityInvariant({
      collection: { slug: 'platformStaff' },
      context: {},
      data,
      operation: 'create',
      originalDoc: undefined,
      req,
    } as never)

    expect(result).toBe(data)
    expect(find).toHaveBeenCalledTimes(3)
    expect(maximumConcurrentQueries).toBe(1)
    expect(find.mock.calls.map(([query]) => query)).toEqual(
      ['platformStaff', 'clinicStaff', 'patients'].map((candidateCollection) => ({
        collection: candidateCollection,
        depth: 0,
        limit: 1,
        overrideAccess: true,
        pagination: false,
        req,
        where: { supabaseUserId: { equals: 'supabase-user-1' } },
      })),
    )
  })

  it('fails closed at the first conflicting principal', async () => {
    const find = vi
      .fn()
      .mockResolvedValueOnce({ docs: [] })
      .mockResolvedValueOnce({ docs: [{ id: 2 }] })

    await expect(
      enforceSupabaseIdentityInvariant({
        collection: { slug: 'platformStaff' },
        context: {},
        data: { supabaseUserId: 'supabase-user-1' },
        operation: 'create',
        originalDoc: undefined,
        req: {
          payload: {
            find,
          },
        },
      } as never),
    ).rejects.toThrow('Supabase identity is already assigned to another authentication principal')

    expect(find).toHaveBeenCalledTimes(2)
  })

  it('excludes only the current principal during updates', async () => {
    const find = vi.fn().mockResolvedValue({ docs: [] })
    const req = { payload: { find } }

    await enforceSupabaseIdentityInvariant({
      collection: { slug: 'clinicStaff' },
      context: {},
      data: { supabaseUserId: 'supabase-user-1' },
      operation: 'update',
      originalDoc: { id: 42 },
      req,
    } as never)

    expect(find).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        collection: 'clinicStaff',
        where: {
          and: [{ supabaseUserId: { equals: 'supabase-user-1' } }, { id: { not_equals: 42 } }],
        },
      }),
    )
    expect(find).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        collection: 'platformStaff',
        where: { supabaseUserId: { equals: 'supabase-user-1' } },
      }),
    )
  })
})
