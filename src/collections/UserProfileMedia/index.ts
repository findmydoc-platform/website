import type { CollectionConfig, PayloadRequest, Where } from 'payload'
import path from 'path'
import { fileURLToPath } from 'url'

import { isPlatformBasicUser } from '@/access/isPlatformBasicUser'
import { beforeChangeComputeStorage } from '@/hooks/media/computeStorage'
import { beforeChangeFreezeRelation } from '@/hooks/ownership'
import type { UserProfileMedia as UserProfileMediaType } from '@/payload-types'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const imageMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'image/svg+xml']

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
  if (user.collection !== 'basicUsers' && user.collection !== 'patients') return null
  // NOTE: The `user` field on this collection is a polymorphic relationship stored
  // by Payload as an object with `{ relationTo, value }`. To scope queries to
  // media owned by the current authenticated user, we must match BOTH:
  // - `user.relationTo`: the underlying collection slug (`basicUsers` | `patients`)
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
    | string
    | number
    | { relationTo?: string; collection?: string; value?: string | number; id?: string | number },
) => {
  const user = req?.user
  if (!user) return false
  if (user.collection !== 'basicUsers' && user.collection !== 'patients') return false

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

export const UserProfileMedia: CollectionConfig = {
  slug: 'userProfileMedia',
  admin: {
    group: 'User Management',
    description: 'Profile images and personal media owned by users (accepts JPEG, PNG, WebP, AVIF, GIF, SVG)',
    defaultColumns: ['user', 'createdBy'],
  },
  access: {
    read: ({ req }) => (isPlatformBasicUser({ req }) ? true : (ownerFilter(req) ?? false)),
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

      // NOTE: When creating media via an `upload` field (e.g. BasicUsers.profileImage),
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
    beforeChange: [
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
        if (requester.collection !== 'basicUsers' && requester.collection !== 'patients') return draft

        const requesterId = normalizeUserId(requester.id)
        if (requesterId == null) return draft

        if (draft.user == null) {
          draft.user = { relationTo: requester.collection, value: requesterId }
        }

        return draft
      },
      // Stamp createdBy for both basicUsers and patients
      async ({ data, operation, req }) => {
        const draft = { ...(data || {}) } as Partial<UserProfileMediaType>
        if (
          operation === 'create' &&
          req?.user &&
          (req.user.collection === 'basicUsers' || req.user.collection === 'patients')
        ) {
          // Always overwrite on create to prevent client-side spoofing.
          draft.createdBy = { relationTo: req.user.collection, value: req.user.id }
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
  },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: ['basicUsers', 'patients'],
      required: true,
      index: true,
      defaultValue: (args: unknown) => {
        const ctx = args as { user?: unknown }
        const requester = ctx?.user as undefined | null | { id?: unknown; collection?: unknown; userType?: unknown }

        if (!requester) return undefined
        if (requester.collection !== 'basicUsers' && requester.collection !== 'patients') return undefined
        const requesterId = normalizeUserId(requester.id)
        if (requesterId == null) return undefined

        return { relationTo: requester.collection, value: requesterId }
      },
      admin: { description: 'Owning user (clinic staff or patient)' },
    },
    {
      name: 'createdBy',
      type: 'relationship',
      relationTo: ['basicUsers', 'patients'],
      required: true,
      admin: {
        description: 'Who performed the upload (auto-set)',
        condition: () => false,
      },
    },
    {
      name: 'storagePath',
      type: 'text',
      required: true,
      admin: { description: 'Resolved storage path used in storage', readOnly: true, hidden: true },
    },
    {
      name: 'prefix',
      type: 'text',
      admin: {
        hidden: true,
        readOnly: true,
        description: 'S3 storage prefix (managed by plugin)',
      },
      access: {
        read: () => true,
        update: () => false,
      },
    },
  ],
  upload: {
    staticDir: path.resolve(dirname, '../../public/user-profile-media'),
    adminThumbnail: 'thumbnail',
    focalPoint: true,
    mimeTypes: imageMimeTypes,
    imageSizes: [
      { name: 'thumbnail', width: 300 },
      { name: 'square', width: 500, height: 500 },
      { name: 'small', width: 600 },
      { name: 'medium', width: 900 },
      { name: 'large', width: 1400 },
      { name: 'xlarge', width: 1920 },
      { name: 'og', width: 1200, height: 630, crop: 'center' },
    ],
  },
}
