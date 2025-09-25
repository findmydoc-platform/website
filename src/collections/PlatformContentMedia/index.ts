import type { CollectionConfig } from 'payload'
import path from 'path'
import { fileURLToPath } from 'url'

import { anyone } from '@/access/anyone'
import { isPlatformBasicUser } from '@/access/isPlatformBasicUser'
import { beforeChangePlatformContentMedia } from './hooks/beforeChangePlatformContentMedia'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const imageMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'image/svg+xml']

export const PlatformContentMedia: CollectionConfig = {
  slug: 'platformContentMedia',
  admin: {
    group: 'Content & Media',
    description: 'Platform-managed media for marketing pages and blocks',
    defaultColumns: ['alt', 'createdBy'],
  },
  access: {
    read: anyone,
    create: ({ req }) => isPlatformBasicUser({ req }),
    update: ({ req }) => isPlatformBasicUser({ req }),
    delete: ({ req }) => isPlatformBasicUser({ req }),
  },
  trash: true,
  hooks: { beforeChange: [beforeChangePlatformContentMedia] },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
      admin: { description: 'Screen-reader alternative text' },
    },
    {
      name: 'caption',
      type: 'text',
      required: false,
      admin: { description: 'Optional caption displayed with the media' },
    },
    {
      name: 'createdBy',
      type: 'relationship',
      relationTo: 'basicUsers',
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
    staticDir: path.resolve(dirname, '../../public/platform-media'),
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
