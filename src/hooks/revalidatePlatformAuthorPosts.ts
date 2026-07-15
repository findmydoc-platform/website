import type { PayloadRequest } from 'payload'
import { executeCollectionChangeRevalidation } from '@/hooks/cacheRevalidationAdapters'

type RelationValue = unknown

const relationId = (value: RelationValue): number | string | null => {
  if (typeof value === 'number' || (typeof value === 'string' && value.trim().length > 0)) return value
  if (value && typeof value === 'object' && 'id' in value) return relationId((value as { id?: unknown }).id)
  return null
}

/**
 * Reuses the existing Posts revalidation contract for only the published posts
 * whose public author projection depends on a platform staff principal.
 */
export async function revalidatePublishedPostsForPlatformAuthors(
  req: PayloadRequest,
  platformStaffIds: readonly (number | string)[],
) {
  if (req.context.disableRevalidate) return

  const ids = Array.from(new Set(platformStaffIds.map(String))).filter(Boolean)
  if (ids.length === 0) return

  let page = 1
  while (true) {
    const posts = await req.payload.find({
      collection: 'posts',
      depth: 0,
      limit: 100,
      page,
      pagination: true,
      overrideAccess: true,
      req,
      select: { _status: true, authors: true, id: true, slug: true },
      where: {
        and: [{ _status: { equals: 'published' } }, { authors: { in: ids } }],
      },
    })

    for (const post of posts.docs) {
      if (post._status !== 'published' || !post.slug) continue
      executeCollectionChangeRevalidation({ collection: 'posts', doc: post, logger: req.payload.logger })
    }

    if (!posts.hasNextPage) return
    page += 1
  }
}

export const hasPublicAuthorProjectionChange = (
  doc: Record<string, unknown>,
  previousDoc: Record<string, unknown> | undefined,
): boolean => {
  if (!previousDoc) return true

  return (
    doc.firstName !== previousDoc.firstName ||
    doc.lastName !== previousDoc.lastName ||
    relationId(doc.profileImage) !== relationId(previousDoc.profileImage)
  )
}

export const hasPublicProfileMediaChange = (
  doc: Record<string, unknown>,
  previousDoc: Record<string, unknown> | undefined,
): boolean => {
  if (!previousDoc) return true

  return ['alt', 'deletedAt', 'filename', 'filesize', 'mimeType', 'sizes', 'url'].some(
    (field) => JSON.stringify(doc[field]) !== JSON.stringify(previousDoc[field]),
  )
}
