import { CollectionConfig } from 'payload'

export const Treatments: CollectionConfig = {
  slug: 'treatments',
  admin: {
    group: 'Medical Network',
    useAsTitle: 'name',
    defaultColumns: ['name', 'description', 'averagePrice'],
    description: 'Medical treatments and procedures offered by clinics and doctors. Manage treatment information, pricing, descriptions, and associated medical specialties.',
  },
  access: {
    read: () => true,
  },
  timestamps: true,
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'tags',
      type: 'relationship',
      relationTo: 'tags',
      hasMany: true,
      admin: {
        description: 'Link this treatment to one or more Tags',
      },
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
      name: 'averagePrice',
      type: 'number',
      required: false,
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'Clinics',
      type: 'join',
      collection: 'clinictreatments',
      on: 'clinic',
      admin: {
        defaultColumns: ['clinic', 'price'],
        description: 'Link this clinic to one or more Clinic Treatments',
        allowCreate: true,
      },
    },
    {
      name: 'Doctors',
      type: 'join',
      collection: 'doctortreatments',
      on: 'doctor',
      admin: {
        defaultColumns: ['doctor', 'specializationLevel'],
        description: 'Link this treatment to one or more Doctors with their specialization level.',
        allowCreate: true,
      },
    },
  ],
}
