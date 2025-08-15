import { CollectionConfig } from 'payload'
import { anyone } from '@/access/anyone'
import { isPlatformBasicUser } from '@/access/isPlatformBasicUser'

export const Accreditation: CollectionConfig = {
  slug: 'accreditation',
  admin: {
    group: 'Platform Management',
    useAsTitle: 'name',
    defaultColumns: ['name', 'abbreviation'],
    description: 'Certifications that clinics can hold to prove quality standards',
  },
  access: {
    read: anyone,
    create: isPlatformBasicUser,
    update: isPlatformBasicUser,
    delete: isPlatformBasicUser,
  },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'name',
          type: 'text',
          required: true,
          admin: {
            width: '70%',
          },
        },
        {
          name: 'abbreviation',
          type: 'text',
          required: true,
          admin: {
            width: '30%',
          },
        },
      ],
    },
    {
      name: 'country',
      type: 'text',
      required: true,
      admin: {
        description: 'Country issuing this accreditation',
      },
    },
    {
      name: 'description',
      type: 'richText',
      admin: {
        description: 'Details about what this accreditation covers',
      },
      required: true,
    },
    {
      name: 'validFrom',
      type: 'date',
      required: false,
      admin: {
        description: 'Date when this accreditation becomes valid',
      },
    },
    {
      name: 'validUntil',
      type: 'date',
      required: false,
      admin: {
        description: 'Date when this accreditation expires',
      },
    },
    {
      name: 'issuingOrganization',
      type: 'text',
      required: false,
      admin: {
        description: 'Organization that issued this accreditation',
      },
    },
    {
      name: 'website',
      type: 'text',
      required: false,
      admin: {
        description: 'Website URL for more information about this accreditation',
      },
    },
    {
      name: 'icon',
      type: 'upload',
      relationTo: 'media',
      required: false,
    },
  ],
}
