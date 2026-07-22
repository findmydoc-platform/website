import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  CollectionBeforeDeleteHook,
  PayloadRequest,
} from 'payload'
import {
  hasPublicProfileMediaChange,
  revalidatePublishedPostsForPlatformAuthors,
} from '@/hooks/revalidatePlatformAuthorPosts'

const CONTEXT_KEY = 'userProfileMediaPlatformAuthorIdsBeforeDelete'
const LOOKUP_PAGE_SIZE = 100

type RevalidationContext = Record<string, unknown> & {
  [CONTEXT_KEY]?: Record<string, Array<number | string>>
}

const isRevalidationDisabled = (req: PayloadRequest) => req.context?.disableRevalidate === true

async function findReferencingPlatformAuthorIds(
  req: PayloadRequest,
  mediaId: number | string,
): Promise<Array<number | string>> {
  const principalIds: Array<number | string> = []
  let page = 1

  while (page > 0) {
    const principals = await req.payload.find({
      collection: 'platformStaff',
      depth: 0,
      limit: LOOKUP_PAGE_SIZE,
      page,
      overrideAccess: true,
      req,
      where: { profileImage: { equals: mediaId } },
    })

    principalIds.push(...principals.docs.map((principal) => principal.id))
    page = principals.hasNextPage && principals.nextPage ? principals.nextPage : 0
  }

  return principalIds
}

async function revalidateReferencingPlatformAuthors(req: PayloadRequest, mediaId: number | string) {
  const principalIds = await findReferencingPlatformAuthorIds(req, mediaId)

  await revalidatePublishedPostsForPlatformAuthors(req, principalIds)
}

export const captureUserProfileMediaPlatformAuthorsBeforeDelete: CollectionBeforeDeleteHook = async ({ id, req }) => {
  if (isRevalidationDisabled(req)) return

  try {
    const context = req.context as RevalidationContext
    const capturedByMediaId = context[CONTEXT_KEY] ?? {}
    capturedByMediaId[String(id)] = await findReferencingPlatformAuthorIds(req, id)
    context[CONTEXT_KEY] = capturedByMediaId
  } catch (error) {
    req.payload.logger.warn(
      { error, userProfileMediaId: id },
      'Unable to capture platform author avatar consumers before deletion',
    )
  }
}

export const revalidateUserProfileMediaPlatformAuthorPosts: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  req,
}) => {
  if (isRevalidationDisabled(req)) return doc
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
  if (isRevalidationDisabled(req)) return doc

  try {
    const context = req.context as RevalidationContext
    const capturedByMediaId = context[CONTEXT_KEY]
    const principalIds = capturedByMediaId?.[String(doc.id)] ?? []
    if (capturedByMediaId) delete capturedByMediaId[String(doc.id)]

    await revalidatePublishedPostsForPlatformAuthors(req, principalIds)
  } catch (error) {
    req.payload.logger.warn(
      { error, userProfileMediaId: doc.id },
      'Unable to revalidate deleted platform author avatar consumers',
    )
  }

  return doc
}
