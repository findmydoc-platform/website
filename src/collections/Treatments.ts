import { CollectionConfig } from 'payload'

export const Treatments: CollectionConfig = {
  slug: 'treatments',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'description', 'averagePrice'],
  },
  access: {
    read: () => true,
  },
  timeStamps: true,
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'description',
      type: 'richText',
      required: true,
    },
    {
      name: 'medicalSpecialty',
      type: 'relationship',
      relationTo: 'medical-specialties',
      required: true,
    },
    {
      name: 'tags',
      type: 'text', // TODO: needs to be changed to tags collection relationship once implemented
      required: false,
    },
    {
      name: 'averagePrice',
      type: 'number',
      required: false,
      admin: {
        readOnly: true,
      },
    },
  ],
}
