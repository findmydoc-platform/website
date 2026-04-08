import type { CollectionConfig } from 'payload'

import { platformOnlyOrPublished } from '../../access/scopeFilters'
import { Archive } from '../../blocks/ArchiveBlock/config'
import { BlogHero } from '../../blocks/BlogHero/config'
import { CallToAction } from '../../blocks/CallToAction/config'
import { Content } from '../../blocks/Content/config'
import { FormBlock } from '../../blocks/Form/config'
import { MediaBlock } from '../../blocks/MediaBlock/config'
import { slugField } from 'payload'
import { isPlatformBasicUser } from '@/access/isPlatformBasicUser'
import { populatePublishedAt } from './hooks/populatePublishedAt'
import { generatePreviewPath } from '../../utilities/generatePreviewPath'
import { revalidateDelete, revalidatePage } from './hooks/revalidatePage'
import { enforceManagedLegalPagesBeforeChange, preventManagedLegalPageDeletion } from './legalPages'
import {
  MetaDescriptionField,
  MetaImageField,
  MetaTitleField,
  OverviewField,
  PreviewField,
} from '@payloadcms/plugin-seo/fields'

export const Pages: CollectionConfig<'pages'> = {
  slug: 'pages',
  access: {
    create: ({ req }) => isPlatformBasicUser({ req }),
    delete: ({ req }) => isPlatformBasicUser({ req }),
    read: ({ req }) => platformOnlyOrPublished({ req }),
    update: ({ req }) => isPlatformBasicUser({ req }),
  },
  // This config controls what's populated by default when a page is referenced
  // https://payloadcms.com/docs/queries/select#defaultpopulate-collection-config-property
  // Type safe if the collection slug generic is passed to `CollectionConfig` - `CollectionConfig<'pages'>
  defaultPopulate: {
    title: true,
    slug: true,
  },
  admin: {
    group: 'Content & Media',
    defaultColumns: ['title', 'slug', 'updatedAt'],
    description: 'Static pages such as contact and about',
    livePreview: {
      url: ({ data, req }) => {
        const path = generatePreviewPath({
          slug: typeof data?.slug === 'string' ? data.slug : '',
          collection: 'pages',
          req,
        })

        return path
      },
    },
    preview: (data, { req }) =>
      generatePreviewPath({
        slug: typeof data?.slug === 'string' ? data.slug : '',
        collection: 'pages',
        req,
      }),
    useAsTitle: 'title',
  },
  trash: true, // Enable soft delete - records are marked as deleted instead of permanently removed
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      admin: {
        description: 'Page title',
      },
    },
    {
      type: 'tabs',
      tabs: [
        {
          fields: [
            {
              name: 'layout',
              type: 'blocks',
              blocks: [BlogHero, CallToAction, Content, MediaBlock, Archive, FormBlock],
              required: true,
              admin: {
                initCollapsed: true,
                description: 'Content blocks for this page',
              },
            },
          ],
          label: 'Content',
          description: 'Main content for this page',
        },
        {
          name: 'meta',
          label: 'SEO',
          fields: [
            OverviewField({
              titlePath: 'meta.title',
              descriptionPath: 'meta.description',
              imagePath: 'meta.image',
            }),
            MetaTitleField({
              hasGenerateFn: true,
            }),
            MetaImageField({
              relationTo: 'platformContentMedia',
            }),

            MetaDescriptionField({}),
            PreviewField({
              // if the `generateUrl` function is configured
              hasGenerateFn: true,

              // field paths to match the target field for data
              titlePath: 'meta.title',
              descriptionPath: 'meta.description',
            }),
          ],
        },
      ],
    },
    {
      name: 'publishedAt',
      type: 'date',
      admin: {
        position: 'sidebar',
      },
    },
    slugField({
      required: false,
      name: 'slug',
      fieldToUse: 'title',
    }),
  ],
  hooks: {
    afterChange: [revalidatePage],
    beforeChange: [enforceManagedLegalPagesBeforeChange, populatePublishedAt],
    beforeDelete: [preventManagedLegalPageDeletion],
    afterDelete: [revalidateDelete],
  },
  versions: {
    drafts: {
      autosave: {
        interval: 100, // We set this interval for optimal live preview
      },
      schedulePublish: true,
    },
    maxPerDoc: 50,
  },
}
