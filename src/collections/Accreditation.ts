import { CollectionConfig } from 'payload'
import { anyone } from '@/access/anyone'
import { isPlatformBasicUser } from '@/access/isPlatformBasicUser'
import { stableIdBeforeChangeHook, stableIdField } from './common/stableIdField'

export const Accreditation: CollectionConfig = {
  slug: 'accreditation',
  admin: {
    group: 'Platform Management',
    useAsTitle: 'name',
    defaultColumns: ['name', 'abbreviation'],
    description: 'Clinic accreditations and certificates',
  },
  access: {
    read: anyone,
    create: isPlatformBasicUser,
    update: isPlatformBasicUser,
    delete: isPlatformBasicUser,
  },
  hooks: {
    beforeChange: [stableIdBeforeChangeHook],
  },
  fields: [
    stableIdField(),
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
        description: 'Country that issues this accreditation',
      },
    },
    {
      name: 'description',
      type: 'richText',
      admin: {
        description: 'What this accreditation covers',
      },
      required: true,
    },
    {
      name: 'icon',
      type: 'upload',
      relationTo: 'platformContentMedia',
      required: false,
      admin: {
        description: 'Logo or symbol for this accreditation',
      },
    },
  ],
}
