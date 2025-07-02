import { CollectionConfig } from 'payload'
import { anyone } from '@/access/anyone'
import { isPlatformBasicUser } from '@/access/isPlatformBasicUser'

export const Countries: CollectionConfig = {
  slug: 'countries',
  admin: {
    group: 'Location Data',
    useAsTitle: 'name',
    defaultColumns: ['name', 'isoCode'],
  },
  access: {
    read: anyone, // Public read access for geographic reference data
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
      name: 'isoCode',
      type: 'text',
      required: true,
    },
    {
      name: 'language',
      type: 'text',
      required: true,
    },
    {
      name: 'currency',
      type: 'text',
      required: true,
    },
  ],
}
