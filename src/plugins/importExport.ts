import { importExportPlugin } from '@payloadcms/plugin-import-export'
import type { ImportExportPluginConfig } from '@payloadcms/plugin-import-export/types'
import type { CollectionSlug } from 'payload'

import { securePlatformManagedPluginCollection } from '@/security/generatedCollectionAccess'

export const importExportTargetSlugs = [
  'pages',
  'posts',
  'platformContentMedia',
  'categories',
  'accreditation',
  'medical-specialties',
  'treatments',
  'countries',
  'cities',
  'tags',
  'redirects',
  'forms',
] as const satisfies readonly CollectionSlug[]

export const importExportPluginConfig = {
  collections: importExportTargetSlugs.map((slug) => ({ slug })),
  overrideExportCollection: securePlatformManagedPluginCollection,
  overrideImportCollection: securePlatformManagedPluginCollection,
} satisfies ImportExportPluginConfig

export const importExport = importExportPlugin(importExportPluginConfig)
