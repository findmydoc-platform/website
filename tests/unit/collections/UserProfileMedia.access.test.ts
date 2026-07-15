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
    const find = vi.fn().mockResolvedValue({ docs: [], hasNextPage: false, nextPage: null })

    await expect(
      UserProfileMedia.access?.read?.(accessArgs({ id: 2, collection: 'clinicStaff' }, find)),
    ).resolves.toEqual({
      or: [
        { and: [{ 'user.relationTo': { equals: 'clinicStaff' } }, { 'user.value': { equals: 2 } }] },
        { id: { in: [] } },
      ],
    })
  })

  it('publishes only the current avatar of a published platform author', async () => {
    const find = vi
      .fn()
      .mockResolvedValueOnce({ docs: [{ authors: [8] }], hasNextPage: false, nextPage: null })
      .mockResolvedValueOnce({ docs: [{ profileImage: 42 }] })

    await expect(UserProfileMedia.access?.read?.(accessArgs(null, find))).resolves.toEqual({
      and: [{ 'user.relationTo': { equals: 'platformStaff' } }, { id: { in: [42] } }],
    })
  })

  it('combines clinic ownership with public platform author avatars', async () => {
    const find = vi
      .fn()
      .mockResolvedValueOnce({ docs: [{ authors: [8] }], hasNextPage: false, nextPage: null })
      .mockResolvedValueOnce({ docs: [{ profileImage: 42 }] })

    await expect(
      UserProfileMedia.access?.read?.(accessArgs({ id: 2, collection: 'clinicStaff' }, find)),
    ).resolves.toEqual({
      or: [
        { and: [{ 'user.relationTo': { equals: 'clinicStaff' } }, { 'user.value': { equals: 2 } }] },
        { and: [{ 'user.relationTo': { equals: 'platformStaff' } }, { id: { in: [42] } }] },
      ],
    })
  })

  it('collects public platform authors across every published-post page', async () => {
    const find = vi
      .fn()
      .mockResolvedValueOnce({ docs: [{ authors: [8] }], hasNextPage: true, nextPage: 2 })
      .mockResolvedValueOnce({ docs: [{ authors: [9] }], hasNextPage: false, nextPage: null })
      .mockResolvedValueOnce({ docs: [{ profileImage: 42 }, { profileImage: 43 }] })

    await expect(UserProfileMedia.access?.read?.(accessArgs(null, find))).resolves.toEqual({
      and: [{ 'user.relationTo': { equals: 'platformStaff' } }, { id: { in: [42, 43] } }],
    })
    expect(find).toHaveBeenNthCalledWith(1, expect.objectContaining({ collection: 'posts', page: 1 }))
    expect(find).toHaveBeenNthCalledWith(2, expect.objectContaining({ collection: 'posts', page: 2 }))
    expect(find).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ collection: 'platformStaff', where: { id: { in: [8, 9] } } }),
    )
  })

  it('rejects a client-supplied owner from another principal', () => {
    expect(UserProfileMedia.access?.create?.(accessArgs({ id: 2, collection: 'clinicStaff' }, vi.fn()))).toBe(true)
  })
})
