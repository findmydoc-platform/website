import { beforeEach, describe, expect, it, vi } from 'vitest'
import { revalidatePath, revalidateTag } from 'next/cache'

import { revalidatePlatformAuthorPosts } from '@/collections/PlatformStaff/hooks/revalidatePlatformAuthorPosts'
import { createMockReq } from '../helpers/testHelpers'

type HookArgs = Parameters<typeof revalidatePlatformAuthorPosts>[0]

const buildArgs = (profileImage: number | null, disableRevalidate = false): HookArgs => {
  const req = createMockReq(null, undefined, { context: { disableRevalidate } })
  vi.mocked(req.payload.find).mockResolvedValue({
    docs: [{ id: 12, _status: 'published', slug: 'staff-article' }],
    hasNextPage: false,
  } as never)

  return {
    collection: { slug: 'platformStaff' } as HookArgs['collection'],
    context: req.context,
    data: {},
    doc: { id: 7, profileImage },
    previousDoc: { id: 7, profileImage: 42 },
    operation: 'update',
    req,
  }
}

describe('platform author profile image revalidation', () => {
  beforeEach(() => vi.clearAllMocks())

  it.each([43, null])('refreshes dependent public posts when the image becomes %s', async (profileImage) => {
    const args = buildArgs(profileImage)

    await revalidatePlatformAuthorPosts(args)

    expect(args.req.payload.find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'posts',
        limit: 100,
        where: { and: [{ _status: { equals: 'published' } }, { authors: { in: ['7'] } }] },
      }),
    )
    expect(vi.mocked(revalidatePath).mock.calls.map(([path]) => path)).toEqual(['/posts/staff-article', '/posts'])
    expect(vi.mocked(revalidateTag).mock.calls.map(([tag]) => tag)).toEqual([
      'entity:posts:12',
      'collection:posts',
      'slug:posts:staff-article',
      'surface:sitemap:posts',
      'surface:posts-list',
      'surface:home',
      'surface:partners-clinics',
    ])
  })

  it.each([
    { image: 42, disabled: false },
    { image: 43, disabled: true },
  ])('skips unchanged images and explicitly disabled revalidation: %j', async ({ image, disabled }) => {
    const args = buildArgs(image, disabled)

    await revalidatePlatformAuthorPosts(args)

    expect(args.req.payload.find).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
    expect(revalidateTag).not.toHaveBeenCalled()
  })
})
