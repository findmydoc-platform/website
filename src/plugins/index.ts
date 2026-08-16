import { formBuilderPlugin } from '@payloadcms/plugin-form-builder'
import { nestedDocsPlugin } from '@payloadcms/plugin-nested-docs'
import { redirectsPlugin } from '@payloadcms/plugin-redirects'
import { seoPlugin } from '@payloadcms/plugin-seo'
import { searchPlugin } from '@payloadcms/plugin-search'
import { s3Storage } from '@payloadcms/storage-s3'
import { Plugin, slugField, type Field } from 'payload'
import { revalidateRedirects } from '@/hooks/revalidateRedirects'
import { GenerateTitle, GenerateURL } from '@payloadcms/plugin-seo/types'
import { FixedToolbarFeature, HeadingFeature, lexicalEditor } from '@payloadcms/richtext-lexical'
import { searchFields } from '@/search/fieldOverrides'
import { beforeSyncWithSearch } from '@/search/beforeSync'
import { createMcpPlugin } from './mcp'
import { resolveS3StorageConfig } from './storageConfig'
import { importExport } from './importExport'
import { generatedCollectionAccess, searchPluginCollectionAccessOverrides } from '@/security/generatedCollectionAccess'

import { Page, Post } from '@/payload-types'
import { getServerSideURL } from '@/utilities/getURL'

type PluginConfigField = Field & {
  blocks?: Array<Record<string, unknown> & { fields?: Field[] }>
  fields?: Field[]
  localized?: boolean
  tabs?: Array<Record<string, unknown> & { fields?: Field[] }>
}

const generateTitle: GenerateTitle<Post | Page> = ({ doc }) => {
  return doc?.title ? `${doc.title} | findmydoc` : 'findmydoc'
}

const generateURL: GenerateURL<Post | Page> = ({ doc }) => {
  const url = getServerSideURL()

  return doc?.slug ? `${url}/${doc.slug}` : url
}

const s3StorageConfig = resolveS3StorageConfig(process.env)

const disableLocalizationForPluginField = (field: Field): Field => {
  const nextField: PluginConfigField = {
    ...field,
  }

  if ('localized' in nextField) {
    nextField.localized = false
  }

  if (Array.isArray(nextField.fields)) {
    nextField.fields = nextField.fields.map(disableLocalizationForPluginField)
  }

  if (Array.isArray(nextField.blocks)) {
    nextField.blocks = nextField.blocks.map((block) => ({
      ...block,
      fields: Array.isArray(block.fields) ? block.fields.map(disableLocalizationForPluginField) : block.fields,
    }))
  }

  if (Array.isArray(nextField.tabs)) {
    nextField.tabs = nextField.tabs.map((tab) => ({
      ...tab,
      fields: Array.isArray(tab.fields) ? tab.fields.map(disableLocalizationForPluginField) : tab.fields,
    }))
  }

  return nextField
}

const s3StoragePlugin = s3Storage({
  collections: {
    platformContentMedia: {
      disableLocalStorage: true,
      prefix: 'platform',
    },
    clinicMedia: {
      disableLocalStorage: true,
      prefix: 'clinics',
    },
    doctorMedia: {
      disableLocalStorage: true,
      prefix: 'doctors',
    },
    userProfileMedia: {
      disableLocalStorage: true,
      prefix: 'users',
    },
    clinicGalleryMedia: {
      disableLocalStorage: true,
      prefix: 'clinics-gallery',
    },
  },
  bucket: s3StorageConfig.bucket,
  config: s3StorageConfig.clientConfig,
})

export const plugins: Plugin[] = [
  redirectsPlugin({
    collections: ['pages', 'posts'],
    overrides: {
      access: generatedCollectionAccess.redirects,
      admin: {
        group: 'Settings',
      },
      // @ts-expect-error - This is a valid override, mapped fields don't resolve to the same type
      fields: ({ defaultFields }) => {
        return defaultFields.map((field) => {
          if ('name' in field && field.name === 'from') {
            return {
              ...field,
              admin: {
                description: 'You will need to rebuild the website when changing this field.',
              },
            }
          }
          return field
        })
      },
      hooks: {
        afterChange: [revalidateRedirects],
      },
    },
  }),
  nestedDocsPlugin({
    collections: ['categories', 'pages'],
    generateURL: (docs) => docs.reduce((url, doc) => `${url}/${doc.slug}`, ''),
    generateLabel: (_, doc) => doc.title as string,
  }),
  nestedDocsPlugin({
    collections: ['medical-specialties'],
    parentFieldSlug: 'parentSpecialty',
    generateLabel: (_, doc) => (typeof doc.name === 'string' ? doc.name : ''),
  }),
  seoPlugin({
    generateTitle,
    generateURL,
  }),
  formBuilderPlugin({
    fields: {
      payment: false,
    },
    formOverrides: {
      access: generatedCollectionAccess.forms,
      admin: {
        group: 'Settings',
      },
      fields: ({ defaultFields }) => {
        const mappedFields = defaultFields.map((field) => {
          if ('name' in field && field.name === 'confirmationMessage') {
            return {
              ...field,
              editor: lexicalEditor({
                features: ({ rootFeatures }) => {
                  return [
                    ...rootFeatures,
                    FixedToolbarFeature(),
                    HeadingFeature({ enabledHeadingSizes: ['h1', 'h2', 'h3', 'h4'] }),
                  ]
                },
              }),
            }
          }
          return field
        })
        const nonLocalizedFields = mappedFields.map(disableLocalizationForPluginField)
        const generatedSlugField = slugField({
          name: 'slug',
          fieldToUse: 'title',
          required: false,
        })

        return [
          ...nonLocalizedFields,
          {
            ...generatedSlugField,
            unique: true,
            index: true,
          },
        ]
      },
    },
    formSubmissionOverrides: {
      access: generatedCollectionAccess['form-submissions'],
      admin: {
        group: 'Platform Management',
      },
    },
  }),
  searchPlugin({
    collections: ['posts', 'clinics', 'treatments', 'doctors'],
    localize: false,
    beforeSync: beforeSyncWithSearch,
    // Explicit maintenance operations may suppress synchronization. Seed writes
    // intentionally keep it enabled so reset and upsert flows leave the index current.
    skipSync: ({ req }) => Boolean(req.context?.disableSearchSync),
    searchOverrides: {
      access: searchPluginCollectionAccessOverrides,
      admin: {
        group: 'Settings',
      },
      fields: ({ defaultFields }) => {
        return [...defaultFields, ...searchFields]
      },
    },
  }),
  createMcpPlugin(),
  importExport,
  s3StoragePlugin,
]
