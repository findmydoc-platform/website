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
      name: 'icon',
      type: 'upload',
      relationTo: 'platformContentMedia',
      required: false,
    },
  ],
}
