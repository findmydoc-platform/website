import { CollectionConfig } from 'payload'

export const Cities: CollectionConfig = {
  slug: 'cities',
  admin: {
    group: 'Location Data',
    useAsTitle: 'name',
    defaultColumns: ['name', 'airportcode', 'coordinates', 'country'],
    description: 'Cities and urban areas where clinics and doctors are located. Helps patients find nearby medical services and plan medical travel.',
  },
  access: {
    read: () => true,
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
