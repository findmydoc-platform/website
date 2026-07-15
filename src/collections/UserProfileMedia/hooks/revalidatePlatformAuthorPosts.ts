import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'
import {
  hasPublicProfileMediaChange,
  revalidatePublishedPostsForPlatformAuthors,
} from '@/hooks/revalidatePlatformAuthorPosts'

async function revalidateReferencingPlatformAuthors(
  req: Parameters<CollectionAfterChangeHook>[0]['req'],
  mediaId: number | string,
) {
  const principals = await req.payload.find({
    collection: 'platformStaff',
    depth: 0,
    limit: 100,
    pagination: false,
    overrideAccess: true,
    req,
    where: { profileImage: { equals: mediaId } },
  })

  await revalidatePublishedPostsForPlatformAuthors(
    req,
    principals.docs.map((principal) => principal.id),
  )
}

export const revalidateUserProfileMediaPlatformAuthorPosts: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  req,
}) => {
  if (!hasPublicProfileMediaChange(doc, previousDoc)) return doc

  try {
    await revalidateReferencingPlatformAuthors(req, doc.id)
  } catch (error) {
    req.payload.logger.warn(
      { error, userProfileMediaId: doc.id },
      'Unable to revalidate platform author avatar consumers',
    )
  }

  return doc
}

export const revalidateDeletedUserProfileMediaPlatformAuthorPosts: CollectionAfterDeleteHook = async ({ doc, req }) => {
  try {
    await revalidateReferencingPlatformAuthors(req, doc.id)
  } catch (error) {
    req.payload.logger.warn(
      { error, userProfileMediaId: doc.id },
      'Unable to revalidate deleted platform author avatar consumers',
    )
  }

  return doc
}
