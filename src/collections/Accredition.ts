import { CollectionConfig } from 'payload'
import { anyone } from '@/access/anyone'
import { isPlatformBasicUser } from '@/access/isPlatformBasicUser'

export const Accreditation: CollectionConfig = {
  slug: 'accreditation',
  admin: {
    group: 'Platform Management',
    useAsTitle: 'name',
    defaultColumns: ['name', 'abbreviation'],
  },
  access: {
    read: anyone,
    create: isPlatformBasicUser,
    update: isPlatformBasicUser,
    delete: isPlatformBasicUser,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'abbreviation',
      type: 'text',
      required: true,
    },
    {
      name: 'country',
      type: 'text',
      required: true,
      admin: {
        description: 'Country where the accreditation is from',
      },
    },
    {
      name: 'description',
      type: 'richText',
      admin: {
        description: 'Description of the accreditation',
      },
      required: true,
    },
    {
      name: 'icon',
      type: 'upload',
      relationTo: 'media',
      required: false,
    },
  ],
}
