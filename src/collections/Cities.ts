import { CollectionConfig } from 'payload'
import { isPlatformBasicUser } from '@/access/isPlatformBasicUser'
import { anyone } from '@/access/anyone'
import { stableIdBeforeChangeHook, stableIdField } from './common/stableIdField'

export const Cities: CollectionConfig = {
  slug: 'cities',
  admin: {
    group: 'Location Data',
    useAsTitle: 'name',
    defaultColumns: ['name', 'airportcode', 'coordinates', 'country'],
    description: 'Cities for clinic addresses',
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
        description: 'City name',
      },
    },
    {
      name: 'airportcode',
      type: 'text',
      required: false,
      admin: {
        description: 'Airport code',
      },
    },
    {
      name: 'coordinates',
      type: 'point',
      required: true,
      admin: {
        description: 'Map coordinates',
      },
    },
    {
      name: 'country',
      type: 'relationship',
      relationTo: 'countries',
      hasMany: false,
      required: true,
      admin: {
        description: 'Country',
      },
    },
  ],
}
