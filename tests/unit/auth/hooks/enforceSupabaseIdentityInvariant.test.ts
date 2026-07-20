import { describe, expect, it, vi } from 'vitest'
import { enforceSupabaseIdentityInvariant } from '@/auth/hooks/enforceSupabaseIdentityInvariant'

describe('enforceSupabaseIdentityInvariant', () => {
  it('checks principal collections sequentially through Payload', async () => {
    let activeQueries = 0
    let maximumConcurrentQueries = 0
    const find = vi.fn(async () => {
      activeQueries += 1
      maximumConcurrentQueries = Math.max(maximumConcurrentQueries, activeQueries)
      await Promise.resolve()
      activeQueries -= 1
      return { docs: [] }
    })

    const data = { supabaseUserId: 'supabase-user-1' }
    const result = await enforceSupabaseIdentityInvariant({
      collection: { slug: 'platformStaff' },
      context: {},
      data,
      operation: 'create',
      originalDoc: undefined,
      req: {
        payload: {
          find,
        },
      },
    } as never)

    expect(result).toBe(data)
    expect(find).toHaveBeenCalledTimes(3)
    expect(maximumConcurrentQueries).toBe(1)
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
})
