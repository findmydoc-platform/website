import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  revalidatePublishedPostsForPlatformAuthors: vi.fn(),
}))

vi.mock('@/hooks/revalidatePlatformAuthorPosts', () => ({
  hasPublicProfileMediaChange: vi.fn(() => true),
  revalidatePublishedPostsForPlatformAuthors: mocks.revalidatePublishedPostsForPlatformAuthors,
}))

import {
  captureUserProfileMediaPlatformAuthorsBeforeDelete,
  revalidateDeletedUserProfileMediaPlatformAuthorPosts,
} from '@/collections/UserProfileMedia/hooks/revalidatePlatformAuthorPosts'

describe('UserProfileMedia platform-author delete revalidation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('captures referencing authors before deletion and revalidates them afterwards', async () => {
    const find = vi.fn().mockResolvedValue({
      docs: [{ id: 11 }, { id: 12 }],
      hasNextPage: false,
      nextPage: null,
    })
    const req = {
      context: {},
      payload: { find, logger: { warn: vi.fn() } },
    }

    await captureUserProfileMediaPlatformAuthorsBeforeDelete({ id: 42, req } as never)
    await revalidateDeletedUserProfileMediaPlatformAuthorPosts({ doc: { id: 42 }, req } as never)

    expect(find).toHaveBeenCalledTimes(1)
    expect(mocks.revalidatePublishedPostsForPlatformAuthors).toHaveBeenCalledWith(req, [11, 12])
  })

  it('skips capture and revalidation when the seed context disables revalidation', async () => {
    const find = vi.fn()
    const req = {
      context: { disableRevalidate: true },
      payload: { find, logger: { warn: vi.fn() } },
    }

    await captureUserProfileMediaPlatformAuthorsBeforeDelete({ id: 42, req } as never)
    await revalidateDeletedUserProfileMediaPlatformAuthorPosts({ doc: { id: 42 }, req } as never)

    expect(find).not.toHaveBeenCalled()
    expect(mocks.revalidatePublishedPostsForPlatformAuthors).not.toHaveBeenCalled()
  })
})
