import { CollectionConfig } from 'payload'
import { anyone } from '@/access/anyone'
import { isPlatformBasicUser } from '@/access/isPlatformBasicUser'
import { stableIdBeforeChangeHook, stableIdField } from './common/stableIdField'

export const Countries: CollectionConfig = {
  slug: 'countries',
  admin: {
    group: 'Location Data',
    useAsTitle: 'name',
    defaultColumns: ['name', 'isoCode'],
    description: 'Countries for addresses and pricing',
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
      name: 'name',
      type: 'text',
      required: true,
      admin: {
        description: 'Country name',
      },
    },
    {
      name: 'isoCode',
      type: 'text',
      required: true,
      admin: {
        description: 'Two-letter country code',
      },
    },
    {
      name: 'language',
      type: 'text',
      required: true,
      admin: {
        description: 'Primary language',
      },
    },
    {
      name: 'currency',
      type: 'text',
      required: true,
      admin: {
        description: 'Currency code',
      },
    },
  ],
}
