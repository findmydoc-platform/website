import type { CollectionConfig } from 'payload'
import path from 'path'
import { fileURLToPath } from 'url'

import { anyone } from '@/access/anyone'
import { isPlatformBasicUser } from '@/access/isPlatformBasicUser'
import { beforeChangePlatformContentMedia } from './hooks/beforeChangePlatformContentMedia'
import { stableIdBeforeChangeHook, stableIdField } from '@/collections/common/stableIdField'
import {
  buildMediaAltField,
  buildMediaCaptionField,
  buildMediaCreatedByField,
  buildMediaPrefixField,
  buildMediaStoragePathField,
  buildMediaUploadConfig,
} from '@/collections/common/mediaCollection'
import { afterErrorLogMediaUploadError, beforeOperationCaptureMediaUpload } from '@/hooks/media/uploadLogging'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export const PlatformContentMedia: CollectionConfig = {
  slug: 'platformContentMedia',
  admin: {
    group: 'Content & Media',
    description: 'Media used on public pages and blocks',
    defaultColumns: ['alt', 'createdBy'],
  },
  access: {
    read: anyone,
    create: ({ req }) => isPlatformBasicUser({ req }),
    update: ({ req }) => isPlatformBasicUser({ req }),
    delete: ({ req }) => isPlatformBasicUser({ req }),
  },
  trash: true,
  hooks: {
    afterError: [afterErrorLogMediaUploadError],
    beforeChange: [stableIdBeforeChangeHook, beforeChangePlatformContentMedia],
    beforeOperation: [
      beforeOperationCaptureMediaUpload({
        storagePrefix: 'platform',
      }),
    ],
  },
  fields: [
    stableIdField(),
    buildMediaAltField(),
    buildMediaCaptionField(),
    buildMediaCreatedByField({
      relationTo: 'basicUsers',
    }),
    buildMediaStoragePathField(),
    buildMediaPrefixField(),
  ],
  upload: buildMediaUploadConfig({
    staticDir: path.resolve(dirname, '../../public/platform-media'),
  }),
}
