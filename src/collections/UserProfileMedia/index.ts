import type { CollectionConfig, PayloadRequest, Where } from 'payload'
import path from 'path'
import { fileURLToPath } from 'url'

import { isPlatformBasicUser } from '@/access/isPlatformBasicUser'
import { stableIdBeforeChangeHook, stableIdField } from '@/collections/common/stableIdField'
import { beforeChangeComputeStorage } from '@/hooks/media/computeStorage'
import { afterErrorLogMediaUploadError, beforeOperationCaptureMediaUpload } from '@/hooks/media/uploadLogging'
import { beforeOperationPrepareUploadFilename } from '@/hooks/media/prepareUploadFilename'
import { beforeOperationValidateMediaUpload } from '@/hooks/media/validateMediaUpload'
import { beforeChangeFreezeRelation } from '@/hooks/ownership'
import {
  captureUserProfileMediaPlatformAuthorsBeforeDelete,
  revalidateDeletedUserProfileMediaPlatformAuthorPosts,
  revalidateUserProfileMediaPlatformAuthorPosts,
} from './hooks/revalidatePlatformAuthorPosts'
import type { UserProfileMedia as UserProfileMediaType } from '@/payload-types'
import {
  buildMediaCreatedByField,
  buildMediaPrefixField,
  buildMediaStoragePathField,
  buildMediaUploadConfig,
} from '@/collections/common/mediaCollection'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const LOOKUP_PAGE_SIZE = 100

const normalizeUserId = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return value
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed.length) return null
    const num = Number(trimmed)
    if (Number.isSafeInteger(num) && num > 0) return num
  }
  return null
}

const extractPolymorphicRelationKey = (value: unknown): string | null => {
  if (value == null || typeof value !== 'object') return null
  const obj = value as Record<string, unknown>

  const relationTo = obj.relationTo
  if (typeof relationTo !== 'string' || !relationTo.trim().length) return null

  const inner = obj.value
  const directId = normalizeUserId(inner)
  if (directId != null) return `${relationTo}:${directId}`

  if (inner && typeof inner === 'object') {
    const innerObj = inner as Record<string, unknown>
    const candidate = innerObj.id ?? innerObj.value
    const candidateId = normalizeUserId(candidate)
    if (candidateId != null) return `${relationTo}:${candidateId}`
  }

  return null
}

const ownerFilter = (req: PayloadRequest): Where | null => {
  const user = req?.user
  if (!user) return null
  if (!['platformStaff', 'clinicStaff', 'patients'].includes(user.collection)) return null
  // NOTE: The `user` field on this collection is a polymorphic relationship stored
  // by Payload as an object with `{ relationTo, value }`. To scope queries to
  // media owned by the current authenticated user, we must match BOTH:
  // - `user.relationTo`: the underlying principal collection
  // - `user.value`: the related document id
  // Using an `and` condition here ensures the filter shape aligns with how Payload
  // persists polymorphic relationships in the database and avoids returning media
  // from other collections or users that might share the same numeric id.
  const filter: Where = {
    and: [{ 'user.relationTo': { equals: user.collection } }, { 'user.value': { equals: user.id } }],
  }
  return filter
}

const ownerMatches = (
  req: PayloadRequest,
  ownerValue:
    string | number | { relationTo?: string; collection?: string; value?: string | number; id?: string | number },
) => {
  const user = req?.user
  if (!user) return false
  if (!['platformStaff', 'clinicStaff', 'patients'].includes(user.collection)) return false

  if (ownerValue && typeof ownerValue === 'object') {
    const relationTo = ownerValue.relationTo ?? ownerValue.collection
    const value = ownerValue.value ?? ownerValue.id
    return relationTo === user.collection && String(value) === String(user.id)
  }

  if (typeof ownerValue === 'string' || typeof ownerValue === 'number') {
    return String(ownerValue) === String(user.id)
  }

  return false
}

const publishedPlatformAuthorAvatarFilter = async (req: PayloadRequest): Promise<Where> => {
  const authorIds = new Set<number>()
  let page = 1

  while (page > 0) {
    const posts = await req.payload.find({
      collection: 'posts',
      where: { _status: { equals: 'published' } },
      depth: 0,
      limit: LOOKUP_PAGE_SIZE,
      page,
      select: { authors: true },
      overrideAccess: true,
      req,
    })

    for (const post of posts?.docs ?? []) {
      if (!Array.isArray(post.authors)) continue
      for (const author of post.authors) {
        const id = normalizeUserId(typeof author === 'object' ? author.id : author)
        if (id !== null) authorIds.add(id)
      }
    }

    page = posts?.hasNextPage && posts.nextPage ? posts.nextPage : 0
  }

  if (authorIds.size === 0) return { id: { in: [] } }

  const authorIdList = Array.from(authorIds)
  const mediaIds = new Set<number>()

  for (let offset = 0; offset < authorIdList.length; offset += LOOKUP_PAGE_SIZE) {
    const principals = await req.payload.find({
      collection: 'platformStaff',
      where: { id: { in: authorIdList.slice(offset, offset + LOOKUP_PAGE_SIZE) } },
      depth: 0,
      limit: LOOKUP_PAGE_SIZE,
      pagination: false,
      select: { profileImage: true },
      overrideAccess: true,
      req,
    })

    for (const principal of principals.docs) {
      const mediaId = normalizeUserId(principal.profileImage)
      if (mediaId !== null) mediaIds.add(mediaId)
    }
  }

  return {
    and: [{ 'user.relationTo': { equals: 'platformStaff' } }, { id: { in: Array.from(mediaIds) } }],
  }
}

export const UserProfileMedia: CollectionConfig = {
  slug: 'userProfileMedia',
  admin: {
    group: 'User Management',
    description: 'Profile images and personal media',
    defaultColumns: ['user', 'createdBy'],
    components: {
      edit: {
        Upload: '@/app/(payload)/components/PolicyAwareUpload',
      },
    },
  },
  access: {
    read: async ({ req }) => {
      if (isPlatformBasicUser({ req })) return true

      const ownedFilter = ownerFilter(req)
      const publicAuthorAvatarFilter = await publishedPlatformAuthorAvatarFilter(req)

      return ownedFilter ? { or: [ownedFilter, publicAuthorAvatarFilter] } : publicAuthorAvatarFilter
    },
    create: ({ req, data }) => {
      if (isPlatformBasicUser({ req })) return true
      const filter = ownerFilter(req)
      if (!filter) return false

      const incomingOwner = (data as Partial<UserProfileMediaType> | undefined)?.user as
        | undefined
        | null
        | string
        | number
        | { relationTo?: string; collection?: string; value?: string | number; id?: string | number }

      // NOTE: When creating media via an `upload` field (for example a profile image),
      // Payload can submit the file before `user` is present. In that case we allow
      // the create and rely on the beforeChange hook to set `user` to the requester.
      if (incomingOwner == null) return true

      return ownerMatches(req, incomingOwner)
    },
    update: ({ req }) => (isPlatformBasicUser({ req }) ? true : (ownerFilter(req) ?? false)),
    delete: ({ req }) => (isPlatformBasicUser({ req }) ? true : (ownerFilter(req) ?? false)),
  },
  trash: true,
  hooks: {
    afterChange: [revalidateUserProfileMediaPlatformAuthorPosts],
    afterDelete: [revalidateDeletedUserProfileMediaPlatformAuthorPosts],
    afterError: [afterErrorLogMediaUploadError],
    beforeChange: [
      stableIdBeforeChangeHook,
      beforeChangeFreezeRelation({
        relationField: 'user',
        message: 'User ownership cannot be changed once set',
        extractId: extractPolymorphicRelationKey,
      }),
      beforeChangeFreezeRelation({
        relationField: 'createdBy',
        message: 'createdBy cannot be changed once set',
        extractId: extractPolymorphicRelationKey,
      }),
      // Default owner (user) for self-service uploads when omitted by the client.
      async ({ data, operation, req }) => {
        const draft = { ...(data || {}) } as Partial<UserProfileMediaType>

        if (operation !== 'create') return draft

        const requester = req?.user as undefined | null | { id?: unknown; collection?: unknown; userType?: unknown }

        if (!requester) return draft
        if (!['platformStaff', 'clinicStaff', 'patients'].includes(String(requester.collection))) return draft

        const requesterId = normalizeUserId(requester.id)
        if (requesterId == null) return draft

        if (draft.user == null) {
          draft.user = {
            relationTo: requester.collection as 'platformStaff' | 'clinicStaff' | 'patients',
            value: requesterId,
          }
        }

        return draft
      },
      // Stamp createdBy from every direct principal and prevent client-side spoofing.
      async ({ data, operation, req }) => {
        const draft = { ...(data || {}) } as Partial<UserProfileMediaType>
        if (
          operation === 'create' &&
          req?.user &&
          ['platformStaff', 'clinicStaff', 'patients'].includes(req.user.collection)
        ) {
          // Always overwrite on create to prevent client-side spoofing.
          draft.createdBy = {
            relationTo: req.user.collection as 'platformStaff' | 'clinicStaff' | 'patients',
            value: req.user.id,
          }
        }
        return draft
      },
      // Compute storage using hashed folder key under the owning user id
      beforeChangeComputeStorage({
        ownerField: 'user',
        key: { type: 'hash' },
        storagePrefix: 'users',
      }),
    ],
    beforeDelete: [captureUserProfileMediaPlatformAuthorsBeforeDelete],
    beforeOperation: [
      beforeOperationValidateMediaUpload,
      beforeOperationPrepareUploadFilename,
      beforeOperationCaptureMediaUpload({
        ownerField: 'user',
        storagePrefix: 'users',
      }),
    ],
  },
  fields: [
    stableIdField(),
    {
      name: 'user',
      type: 'relationship',
      relationTo: ['platformStaff', 'clinicStaff', 'patients'],
      required: true,
      index: true,
      defaultValue: (args: unknown) => {
        const ctx = args as { user?: unknown }
        const requester = ctx?.user as undefined | null | { id?: unknown; collection?: unknown; userType?: unknown }

        if (!requester) return undefined
        if (!['platformStaff', 'clinicStaff', 'patients'].includes(String(requester.collection))) return undefined
        const requesterId = normalizeUserId(requester.id)
        if (requesterId == null) return undefined

        return { relationTo: requester.collection, value: requesterId }
      },
      admin: { description: 'User who owns this media' },
    },
    buildMediaCreatedByField({
      relationTo: ['platformStaff', 'clinicStaff', 'patients'],
    }),
    buildMediaStoragePathField(),
    buildMediaPrefixField(),
  ],
  upload: buildMediaUploadConfig({
    staticDir: path.resolve(dirname, '../../.local/user-profile-media'),
  }),
}
