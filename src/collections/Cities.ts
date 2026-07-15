import { CollectionConfig } from 'payload'
import { isPlatformStaff } from '@/access/isPlatformStaff'
import { anyone } from '@/access/anyone'
import { stableIdBeforeChangeHook, stableIdField } from './common/stableIdField'
import { revalidateCityChange, revalidateCityDelete } from '@/hooks/revalidateClinicSurfaces'

export const Cities: CollectionConfig = {
  slug: 'cities',
  admin: {
    group: 'Location Data',
    useAsTitle: 'name',
    defaultColumns: ['name', 'airportcode', 'coordinates', 'country'],
    description: 'Cities used for clinic addresses',
  },
  access: {
    read: anyone,
    create: isPlatformStaff,
    update: isPlatformStaff,
    delete: isPlatformStaff,
  },
  hooks: {
    beforeChange: [stableIdBeforeChangeHook],
    afterChange: [revalidateCityChange],
    afterDelete: [revalidateCityDelete],
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
        description: 'IATA airport code',
      },
    },
    {
      name: 'coordinates',
      type: 'point',
      required: true,
      admin: {
        description: 'Latitude and longitude for maps and distance checks',
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
