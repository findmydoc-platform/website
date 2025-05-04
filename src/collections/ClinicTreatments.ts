import { CollectionConfig } from 'payload'

export const ClinicTreatments: CollectionConfig = {
  slug: 'clinictreatments',
  labels: {
    singular: 'Clinic Treatment',
    plural: 'Clinic Treatments',
  },
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['clinic', 'treatment', 'price'],
  },
  access: {
    read: () => true,
  },
  timestamps: true,
  fields: [
    {
      name: 'price',
      type: 'number',
      required: true,
    },
    {
      name: 'clinic',
      type: 'join',
      collection: 'clinics',
      on: 'clinictreatments',
      required: true,
      admin: {
        defaultColumns: ['name'],
        description: 'Link to the clinic',
        allowCreate: false,
      },
    },
    {
      name: 'treatment',
      type: 'join',
      collection: 'treatments',
      on: 'clinictreatments',
      required: true,
      admin: {
        defaultColumns: ['name'],
        description: 'Link to the treatment',
        allowCreate: false,
      },
    },
  ],
}
