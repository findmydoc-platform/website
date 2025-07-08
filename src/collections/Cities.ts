import { CollectionConfig } from 'payload'
import { isPlatformBasicUser } from '@/access/isPlatformBasicUser'
import { anyone } from '@/access/anyone'

export const Cities: CollectionConfig = {
  slug: 'cities',
  admin: {
    group: 'Location Data',
    useAsTitle: 'name',
    defaultColumns: ['name', 'airportcode', 'coordinates', 'country'],
    description: 'Cities available when entering clinic addresses',
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
        description: 'Name of the city',
      },
    },
    {
      name: 'airportcode',
      type: 'text',
      required: true,
      admin: {
        description: 'IATA airport code for the city',
      },
    },
    {
      name: 'coordinates',
      type: 'point',
      required: true,
      admin: {
        description: 'Coordinates of the city',
      },
    },
    {
      name: 'country',
      type: 'relationship',
      relationTo: 'countries',
      hasMany: false,
      required: true,
      admin: {
        description: 'Country this city belongs to',
      },
    },
  ],
}
