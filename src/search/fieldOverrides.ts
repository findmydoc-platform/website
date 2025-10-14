import { Field } from 'payload'

export const searchFields: Field[] = [
  {
    name: 'slug',
    type: 'text',
    index: true,
    admin: {
      readOnly: true,
    },
  },
  {
    name: 'city',
    label: 'City',
    type: 'relationship',
    relationTo: 'cities',
    admin: {
      readOnly: true,
    },
  },
  {
    name: 'country',
    label: 'Country',
    type: 'text',
    admin: {
      readOnly: true,
    },
  },
  {
    name: 'clinic',
    label: 'Clinic',
    type: 'relationship',
    relationTo: 'clinics',
    admin: {
      readOnly: true,
    },
  },
  {
    name: 'minPrice',
    label: 'Minimum Price',
    type: 'number',
    admin: {
      readOnly: true,
    },
  },
  {
    name: 'maxPrice',
    label: 'Maximum Price',
    type: 'number',
    admin: {
      readOnly: true,
    },
  },
  {
    name: 'treatmentName',
    label: 'Treatment Name',
    type: 'text',
    admin: {
      readOnly: true,
    },
  },
  {
    name: 'meta',
    label: 'Meta',
    type: 'group',
    index: true,
    admin: {
      readOnly: true,
    },
    fields: [
      {
        type: 'text',
        name: 'title',
        label: 'Title',
      },
      {
        type: 'text',
        name: 'description',
        label: 'Description',
      },
      {
        name: 'image',
        label: 'Image',
        type: 'upload',
        relationTo: 'platformContentMedia',
      },
    ],
  },
  {
    label: 'Categories',
    name: 'categories',
    type: 'array',
    admin: {
      readOnly: true,
    },
    fields: [
      {
        name: 'relationTo',
        type: 'text',
      },
      {
        name: 'id',
        type: 'text',
      },
      {
        name: 'title',
        type: 'text',
      },
    ],
  },
]
