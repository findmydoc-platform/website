import { formBuilderPlugin } from '@payloadcms/plugin-form-builder'
import { nestedDocsPlugin } from '@payloadcms/plugin-nested-docs'
import { redirectsPlugin } from '@payloadcms/plugin-redirects'
import { seoPlugin } from '@payloadcms/plugin-seo'
import { searchPlugin } from '@payloadcms/plugin-search'
import { s3Storage } from '@payloadcms/storage-s3'
import { importExportPlugin } from '@payloadcms/plugin-import-export'
import { Plugin } from 'payload'
import { revalidateRedirects } from '@/hooks/revalidateRedirects'
import { GenerateTitle, GenerateURL } from '@payloadcms/plugin-seo/types'
import { FixedToolbarFeature, HeadingFeature, lexicalEditor } from '@payloadcms/richtext-lexical'
import { searchFields } from '@/search/fieldOverrides'
import { beforeSyncWithSearch } from '@/search/beforeSync'
import { createMcpPlugin } from './mcp'

import { Page, Post } from '@/payload-types'
import { getServerSideURL } from '@/utilities/getURL'

const generateTitle: GenerateTitle<Post | Page> = ({ doc }) => {
  return doc?.title ? `${doc.title} | findmydoc` : 'findmydoc'
}

const generateURL: GenerateURL<Post | Page> = ({ doc }) => {
  const url = getServerSideURL()

  return doc?.slug ? `${url}/${doc.slug}` : url
}

// In development, local storage is used by default. Set USE_S3_IN_DEV to 'true' to enable cloud storage in development.
const useCloudStorage =
  process.env.NODE_ENV === 'production' ||
  (process.env.USE_S3_IN_DEV === 'true' && process.env.NODE_ENV === 'development')

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
        return defaultFields.map((field) => {
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
    beforeSync: beforeSyncWithSearch,
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
      { slug: 'doctorMedia' },
      { slug: 'userProfileMedia' },
      { slug: 'categories' },
      { slug: 'basicUsers' },
      { slug: 'patients' },
      { slug: 'clinicStaff' },
      { slug: 'platformStaff' },
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
    ],
  }),
  s3StoragePlugin,
]
