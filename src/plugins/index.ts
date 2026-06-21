import { formBuilderPlugin } from '@payloadcms/plugin-form-builder'
import { nestedDocsPlugin } from '@payloadcms/plugin-nested-docs'
import { redirectsPlugin } from '@payloadcms/plugin-redirects'
import { seoPlugin } from '@payloadcms/plugin-seo'
import { searchPlugin } from '@payloadcms/plugin-search'
import { s3Storage } from '@payloadcms/storage-s3'
import { importExportPlugin } from '@payloadcms/plugin-import-export'
import { Plugin, slugField, type Field } from 'payload'
import { revalidateRedirects } from '@/hooks/revalidateRedirects'
import { GenerateTitle, GenerateURL } from '@payloadcms/plugin-seo/types'
import { FixedToolbarFeature, HeadingFeature, lexicalEditor } from '@payloadcms/richtext-lexical'
import { searchFields } from '@/search/fieldOverrides'
import { beforeSyncWithSearch } from '@/search/beforeSync'
import { createMcpPlugin } from './mcp'
import { shouldUseCloudStorage } from './storageConfig'

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

// In development, prefer cloud storage when a complete S3 configuration is present.
// Set USE_S3_IN_DEV=false to force local storage for isolated local work.
const useCloudStorage = shouldUseCloudStorage(process.env)

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
  enabled: useCloudStorage,
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
  bucket: process.env.S3_BUCKET || '',
  config: {
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
    },
    region: process.env.S3_REGION || '',
    endpoint: process.env.S3_ENDPOINT,
  },
})

export const plugins: Plugin[] = [
  redirectsPlugin({
    collections: ['pages', 'posts'],
    overrides: {
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
      admin: {
        group: 'Platform Management',
      },
    },
  }),
  searchPlugin({
    collections: ['posts', 'clinics', 'treatments', 'doctors'],
    localize: false,
    beforeSync: beforeSyncWithSearch,
    // Seed operations write a lot of documents in bulk; disable search sync there
    // and rely on regular writes / manual reindex afterwards.
    skipSync: ({ req }) => Boolean(req.context?.disableSearchSync),
    searchOverrides: {
      admin: {
        group: 'Settings',
      },
      fields: ({ defaultFields }) => {
        return [...defaultFields, ...searchFields]
      },
    },
  }),
  createMcpPlugin(),
  importExportPlugin({
    collections: [
      { slug: 'pages' },
      { slug: 'posts' },
      { slug: 'platformContentMedia' },
      { slug: 'clinicMedia' },
      { slug: 'clinicGalleryMedia' },
      { slug: 'clinicGalleryEntries' },
      { slug: 'doctorMedia' },
      { slug: 'userProfileMedia' },
      { slug: 'categories' },
      { slug: 'basicUsers' },
      { slug: 'patients' },
      { slug: 'clinicStaff' },
      { slug: 'platformStaff' },
      { slug: 'clinicApplications', import: false },
      { slug: 'patientClinicInquiries', import: false },
      { slug: 'clinics' },
      { slug: 'doctors' },
      { slug: 'accreditation' },
      { slug: 'medical-specialties' },
      { slug: 'treatments' },
      { slug: 'clinictreatments' },
      { slug: 'doctortreatments' },
      { slug: 'doctorspecialties' },
      { slug: 'favoriteclinics' },
      { slug: 'reviews' },
      { slug: 'countries' },
      { slug: 'cities' },
      { slug: 'tags' },
      { slug: 'redirects' },
      { slug: 'forms' },
      { slug: 'form-submissions', import: false },
    ],
  }),
  s3StoragePlugin,
]
