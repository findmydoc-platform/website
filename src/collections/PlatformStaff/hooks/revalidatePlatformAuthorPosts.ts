import type { CollectionAfterChangeHook } from 'payload'
import {
  hasPublicAuthorProjectionChange,
  revalidatePublishedPostsForPlatformAuthors,
} from '@/hooks/revalidatePlatformAuthorPosts'

export const revalidatePlatformAuthorPosts: CollectionAfterChangeHook = async ({ doc, previousDoc, req }) => {
  if (!hasPublicAuthorProjectionChange(doc, previousDoc)) return doc

  try {
    await revalidatePublishedPostsForPlatformAuthors(req, [doc.id])
  } catch (error) {
    req.payload.logger.warn({ error, platformStaffId: doc.id }, 'Unable to revalidate public platform author posts')
  }

  return doc
}
