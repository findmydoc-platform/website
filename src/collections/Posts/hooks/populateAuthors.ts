import type { BasicUser, BasicUsersSelect, Post, PostsSelect } from '@/payload-types'
import type { FieldHook } from 'payload'
import { resolveMediaDescriptorFromRelation } from '@/utilities/media/relationMedia'

type PopulatedAuthorsValue = Post['populatedAuthors']
type PopulatedAuthor = NonNullable<NonNullable<PopulatedAuthorsValue>[number]>
type RawAuthorRelation = NonNullable<Post['authors']>[number]

const POST_AUTHOR_FALLBACK_SELECT = {
  authors: true,
} satisfies PostsSelect<true>

const BASIC_USER_AUTHOR_SELECT = {
  firstName: true,
  lastName: true,
  profileImage: true,
} satisfies BasicUsersSelect<true>

const buildAuthorName = (authorDoc: Pick<BasicUser, 'firstName' | 'lastName'>): string => {
  const firstName = authorDoc.firstName?.trim()
  const lastName = authorDoc.lastName?.trim()

  if (firstName && lastName) return `${firstName} ${lastName}`
  if (firstName) return firstName
  if (lastName) return lastName

  return 'Unknown Author'
}

// Basic users are not publicly readable, so we project only safe author metadata
// into a dedicated virtual field consumed by frontend cards and post detail.
export const populateAuthors: FieldHook<Post, PopulatedAuthorsValue, Post> = async ({
  data,
  req,
  req: { payload },
}) => {
  if (!data) return []

  let rawAuthors: RawAuthorRelation[] | undefined = Array.isArray(data.authors) ? data.authors : undefined
  const requestContext = req.context ?? {}

  // Some frontend list queries select populatedAuthors but not authors.
  // In that case, fetch the minimal relation data so cards still render author info.
  if ((!rawAuthors || rawAuthors.length === 0) && data.id && !requestContext.skipPopulateAuthorsFallback) {
    try {
      const postWithAuthors = await payload.findByID({
        collection: 'posts',
        id: data.id,
        depth: 0,
        select: POST_AUTHOR_FALLBACK_SELECT,
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
    return []
  }

  const populatedAuthors: PopulatedAuthor[] = []

  for (const author of rawAuthors) {
    const authorId = typeof author === 'object' ? author?.id : author
    if (!authorId) continue

    try {
      const authorDoc = (await payload.findByID({
        id: authorId,
        collection: 'basicUsers',
        depth: 0,
        select: BASIC_USER_AUTHOR_SELECT,
        overrideAccess: true,
        req,
      })) as BasicUser

      if (!authorDoc) continue

      let avatar: string | undefined

      try {
        const mediaDescriptor = await resolveMediaDescriptorFromRelation({
          payload,
          collection: 'userProfileMedia',
          relation: authorDoc.profileImage,
          req,
          overrideAccess: true,
        })
        avatar = mediaDescriptor?.url ?? undefined
      } catch (_e) {
        // swallow - keep fallback fields
      }

      populatedAuthors.push({
        id: String(authorDoc.id),
        name: buildAuthorName(authorDoc),
        avatar,
      })
    } catch (_e) {
      // ignore invalid/stale relation ids
    }
  }

  return populatedAuthors
}
