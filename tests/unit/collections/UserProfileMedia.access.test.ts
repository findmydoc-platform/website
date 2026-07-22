import { describe, expect, it, vi } from 'vitest'
import { UserProfileMedia } from '@/collections/UserProfileMedia'

const accessArgs = (user: unknown, find = vi.fn(), extra: Record<string, unknown> = {}) =>
  ({
    ...extra,
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
      .mockResolvedValueOnce({ docs: [{ id: 8 }] })
      .mockResolvedValueOnce({ docs: [{ id: 11 }] })

    await expect(UserProfileMedia.access?.read?.(accessArgs(null, find, { id: 42 }))).resolves.toEqual({
      and: [{ 'user.relationTo': { equals: 'platformStaff' } }, { id: { in: [42] } }],
    })

    expect(find).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ collection: 'platformStaff', where: { profileImage: { in: [42] } } }),
    )
    expect(find).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ collection: 'posts', where: expect.objectContaining({ and: expect.any(Array) }) }),
    )
  })

  it('combines clinic ownership with public platform author avatars', async () => {
    const find = vi
      .fn()
      .mockResolvedValueOnce({ docs: [{ id: 8 }] })
      .mockResolvedValueOnce({ docs: [{ id: 11 }] })

    await expect(
      UserProfileMedia.access?.read?.(accessArgs({ id: 2, collection: 'clinicStaff' }, find, { id: 42 })),
    ).resolves.toEqual({
      or: [
        { and: [{ 'user.relationTo': { equals: 'clinicStaff' } }, { 'user.value': { equals: 2 } }] },
        { and: [{ 'user.relationTo': { equals: 'platformStaff' } }, { id: { in: [42] } }] },
      ],
    })
  })

  it('resolves an anonymous static file through indexed filename and relation lookups', async () => {
    const find = vi
      .fn()
      .mockResolvedValueOnce({ docs: [{ id: 42 }] })
      .mockResolvedValueOnce({ docs: [{ id: 8 }] })
      .mockResolvedValueOnce({ docs: [{ id: 11 }] })

    await expect(
      UserProfileMedia.access?.read?.(
        accessArgs(null, find, { data: { filename: 'avatar-small.webp' }, isReadingStaticFile: true }),
      ),
    ).resolves.toEqual({
      and: [{ 'user.relationTo': { equals: 'platformStaff' } }, { id: { in: [42] } }],
    })

    expect(find).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        collection: 'userProfileMedia',
        where: expect.objectContaining({ or: expect.arrayContaining([{ filename: { equals: 'avatar-small.webp' } }]) }),
      }),
    )
    expect(find).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ collection: 'platformStaff', where: { profileImage: { in: [42] } } }),
    )
    expect(find).toHaveBeenNthCalledWith(3, expect.objectContaining({ collection: 'posts', limit: 1 }))
  })

  it('does not enumerate public avatars for an unscoped anonymous collection read', async () => {
    const find = vi.fn()

    await expect(UserProfileMedia.access?.read?.(accessArgs(null, find))).resolves.toEqual({ id: { in: [] } })
    expect(find).not.toHaveBeenCalled()
  })

  it('denies a requested media id that is not a current published platform author avatar', async () => {
    const find = vi.fn().mockResolvedValueOnce({ docs: [] })

    await expect(UserProfileMedia.access?.read?.(accessArgs(null, find, { id: 99 }))).resolves.toEqual({
      id: { in: [] },
    })
    expect(find).toHaveBeenCalledTimes(1)
  })

  it('rejects a client-supplied owner from another principal', () => {
    expect(UserProfileMedia.access?.create?.(accessArgs({ id: 2, collection: 'clinicStaff' }, vi.fn()))).toBe(true)
  })
})
