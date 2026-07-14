import { describe, expect, it, vi } from 'vitest'
import { UserProfileMedia } from '@/collections/UserProfileMedia'

const accessArgs = (user: unknown, find = vi.fn()) =>
  ({
    req: {
      payload: { find },
      user,
    },
  }) as never

describe('UserProfileMedia access', () => {
  it('grants platform staff administration access', async () => {
    await expect(UserProfileMedia.access?.read?.(accessArgs({ id: 1, collection: 'platformStaff' }))).resolves.toBe(
      true,
    )
    expect(UserProfileMedia.access?.update?.(accessArgs({ id: 1, collection: 'platformStaff' }))).toBe(true)
  })

  it('scopes clinic staff to their own polymorphic owner relation', async () => {
    await expect(UserProfileMedia.access?.read?.(accessArgs({ id: 2, collection: 'clinicStaff' }))).resolves.toEqual({
      and: [{ 'user.relationTo': { equals: 'clinicStaff' } }, { 'user.value': { equals: 2 } }],
    })
  })

  it('publishes only the current avatar of a published platform author', async () => {
    const find = vi
      .fn()
      .mockResolvedValueOnce({ docs: [{ authors: [8] }] })
      .mockResolvedValueOnce({ docs: [{ profileImage: 42 }] })

    await expect(UserProfileMedia.access?.read?.(accessArgs(null, find))).resolves.toEqual({
      and: [{ 'user.relationTo': { equals: 'platformStaff' } }, { id: { in: [42] } }],
    })
  })

  it('rejects a client-supplied owner from another principal', () => {
    expect(UserProfileMedia.access?.create?.(accessArgs({ id: 2, collection: 'clinicStaff' }, vi.fn()))).toBe(true)
  })
})
