import type { CollectionConfig } from 'payload'
import { anyone } from '@/access/anyone'
import { platformOrOwnClinicResource } from '@/access/scopeFilters'
import { FixedToolbarFeature, InlineToolbarFeature, lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { fileURLToPath } from 'url'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export const ClinicMedia: CollectionConfig = {
  slug: 'clinicMedia',
  admin: {
    group: 'Content & Media',
    useAsTitle: 'alt',
    description: 'Media files uploaded and managed by clinics for their own use',
    defaultColumns: ['alt', 'clinic', 'updatedAt'],
  },
  access: {
    read: anyone, // Public read access
    create: platformOrOwnClinicResource, // Platform staff OR Clinic staff for their own clinic
    update: platformOrOwnClinicResource, // Platform staff OR Clinic staff for their own clinic
    delete: platformOrOwnClinicResource, // Platform staff OR Clinic staff for their own clinic
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
      admin: {
        description: 'Alternative text for screen readers',
      },
    },
    {
      name: 'caption',
      type: 'richText',
      admin: {
        description: 'Optional caption displayed with the media',
      },
      editor: lexicalEditor({
        features: ({ rootFeatures }) => {
          return [...rootFeatures, FixedToolbarFeature(), InlineToolbarFeature()]
        },
      }),
    },
    {
      name: 'clinic',
      type: 'relationship',
      relationTo: 'clinics',
      required: true,
      index: true,
      admin: {
        description: 'Clinic that owns this media file',
      },
    },
    {
      name: 'prefix',
      type: 'text',
      admin: {
        readOnly: true,
        hidden: true,
      },
    },
  ],
  upload: {
    staticDir: path.resolve(dirname, '../../public/clinic-media'),
    adminThumbnail: 'thumbnail',
    focalPoint: true,
    imageSizes: [
      {
        name: 'thumbnail',
        width: 300,
      },
      {
        name: 'square',
        width: 500,
        height: 500,
      },
      {
        name: 'small',
        width: 600,
      },
      {
        name: 'medium',
        width: 900,
      },
      {
        name: 'large',
        width: 1400,
      },
      {
        name: 'xlarge',
        width: 1920,
      },
      {
        name: 'og',
        width: 1200,
        height: 630,
        crop: 'center',
      },
    ],
  },
}