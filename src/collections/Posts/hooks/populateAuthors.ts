import type { CollectionAfterReadHook } from 'payload'
import type { BasicUser } from 'src/payload-types'

// Basic users are not publicly readable, so we project only safe author metadata
// into a dedicated populatedAuthors field consumed by frontend cards/hero.
export const populateAuthors: CollectionAfterReadHook = async ({ doc, req, req: { payload } }) => {
  if (!doc) return doc

  let rawAuthors = Array.isArray(doc.authors) ? doc.authors : undefined
  const requestContext = req.context ?? {}

  // Some frontend list queries select populatedAuthors but not authors.
  // In that case, fetch the minimal relation data so cards still render author info.
  if ((!rawAuthors || rawAuthors.length === 0) && doc.id && !requestContext.skipPopulateAuthorsFallback) {
    try {
      const postWithAuthors = await payload.findByID({
        collection: 'posts',
        id: doc.id,
        depth: 0,
        context: { ...requestContext, skipPopulateAuthorsFallback: true },
        overrideAccess: true,
        req,
      })

      if (postWithAuthors && typeof postWithAuthors === 'object' && Array.isArray(postWithAuthors.authors)) {
        rawAuthors = postWithAuthors.authors
      }
    } catch (_e) {
      // swallow - we keep an empty populatedAuthors fallback
    }
  }

  if (!rawAuthors || rawAuthors.length === 0) {
    doc.populatedAuthors = []
    return doc
  }

  const authorDocs: BasicUser[] = []

  for (const author of rawAuthors) {
    const authorId = typeof author === 'object' ? author?.id : author
    if (!authorId) continue

    try {
      const authorDoc = (await payload.findByID({
        id: authorId,
        collection: 'basicUsers',
        depth: 0,
        overrideAccess: true,
        req,
      })) as BasicUser

      if (authorDoc) {
        authorDocs.push(authorDoc)
      }
    } catch (_e) {
      // ignore invalid/stale relation ids
    }
  }

  doc.populatedAuthors = []
  for (const authorDoc of authorDocs) {
    let name = 'Unknown Author'
    let avatar: string | undefined

    try {
      const firstName = authorDoc?.firstName?.trim()
      const lastName = authorDoc?.lastName?.trim()
      if (firstName && lastName) {
        name = `${firstName} ${lastName}`
      } else if (firstName) {
        name = firstName
      } else if (lastName) {
        name = lastName
      }

      const profileImage = authorDoc?.profileImage
      if (profileImage && typeof profileImage === 'object' && profileImage.url) {
        avatar = profileImage.url
      } else if (typeof profileImage === 'number') {
        const media = await payload.findByID({
          collection: 'userProfileMedia',
          id: profileImage,
          depth: 0,
          overrideAccess: true,
          req,
        })

        if (media && typeof media === 'object' && 'url' in media && typeof media.url === 'string') {
          avatar = media.url
        }
      }
    } catch (_e) {
      // swallow - keep fallback fields
    }

    doc.populatedAuthors.push({ id: String(authorDoc.id), name, avatar })
  }

  return doc
}
