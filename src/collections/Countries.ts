import { CollectionConfig } from 'payload'
import { anyone } from '@/access/anyone'
import { isPlatformBasicUser } from '@/access/isPlatformBasicUser'

export const Countries: CollectionConfig = {
  slug: 'countries',
  admin: {
    group: 'Location Data',
    useAsTitle: 'name',
    defaultColumns: ['name', 'isoCode'],
    description: 'Countries used throughout the platform for addresses and pricing',
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
      admin: {
        description: 'Full country name',
      },
    },
    {
      name: 'isoCode',
      type: 'text',
      required: true,
      admin: {
        description: 'Two-letter ISO country code',
      },
    },
    {
      name: 'language',
      type: 'text',
      required: true,
      admin: {
        description: 'Primary language spoken',
      },
    },
    {
      name: 'currency',
      type: 'text',
      required: true,
      admin: {
        description: 'Local currency code',
      },
    },
  ],
}
