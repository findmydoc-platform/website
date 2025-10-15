import type { CollectionConfig } from 'payload'
import path from 'path'
import { fileURLToPath } from 'url'

import { isPlatformBasicUser } from '@/access/isPlatformBasicUser'
import { beforeChangeComputeStorage } from '@/hooks/media/computeStorage'
import { beforeChangeFreezeRelation } from '@/hooks/ownership'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const imageMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'image/svg+xml']

const ownerFilter = (req: any) => {
  const user = req?.user
  if (!user) return null
  if (user.collection !== 'basicUsers' && user.collection !== 'patients') return null
  return { [`user.${user.collection}.id`]: { equals: user.id } }
}

const ownerMatches = (req: any, ownerValue: any) => {
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
    defaultColumns: ['user', 'alt', 'createdBy'],
  },
  access: {
    read: ({ req }) => (isPlatformBasicUser({ req }) ? true : (ownerFilter(req) ?? false)),
    create: ({ req, data }) => {
      if (isPlatformBasicUser({ req })) return true
      const filter = ownerFilter(req)
      if (!filter) return false
      return ownerMatches(req, (data as any)?.user)
    },
    update: ({ req }) => (isPlatformBasicUser({ req }) ? true : (ownerFilter(req) ?? false)),
    delete: ({ req }) => (isPlatformBasicUser({ req }) ? true : (ownerFilter(req) ?? false)),
  },
  trash: true,
  hooks: {
    beforeChange: [
      beforeChangeFreezeRelation({ relationField: 'user', message: 'User ownership cannot be changed once set' }),
      // Stamp createdBy for both basicUsers and patients
      async ({ data, operation, req }) => {
        const draft: any = { ...(data || {}) }
        if (
          operation === 'create' &&
          req?.user &&
          (req.user.collection === 'basicUsers' || req.user.collection === 'patients')
        ) {
          if (draft.createdBy == null) {
            draft.createdBy = { relationTo: req.user.collection, value: req.user.id }
          }
        }
        return draft
      },
      // Compute storage using hashed folder key under the owning user id
      beforeChangeComputeStorage({ ownerField: 'user', key: { type: 'hash' }, storagePrefix: 'users' }),
    ],
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
      admin: {
        description: "Alternative text for screen readers (describe what's in the image)",
      },
    },
    {
      name: 'caption',
      type: 'richText',
      required: false,
      admin: { description: 'Optional caption displayed with the media' },
    },
    {
      name: 'user',
      type: 'relationship',
      relationTo: ['basicUsers', 'patients'],
      required: true,
      index: true,
      admin: { description: 'Owning user (clinic staff or patient)' },
    },
    {
      name: 'createdBy',
      type: 'relationship',
      relationTo: ['basicUsers', 'patients'],
      required: true,
      admin: { description: 'Who performed the upload (auto-set)' },
    },
    {
      name: 'storagePath',
      type: 'text',
      required: true,
      admin: { description: 'Resolved storage path used in storage', readOnly: true },
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
