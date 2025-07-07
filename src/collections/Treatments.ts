import { CollectionConfig } from 'payload'
import { anyone } from '@/access/anyone'
import { isPlatformBasicUser } from '@/access/isPlatformBasicUser'
import { isClinicBasicUser } from '@/access/isClinicBasicUser'

export const Treatments: CollectionConfig = {
  slug: 'treatments',
  admin: {
    group: 'Medical Network',
    useAsTitle: 'name',
    defaultColumns: ['name', 'description', 'averagePrice'],
  },
  access: {
    read: anyone,
    create: ({ req }) => isPlatformBasicUser({ req }) || isClinicBasicUser({ req }),
    update: ({ req }) => isPlatformBasicUser({ req }) || isClinicBasicUser({ req }),
    delete: isPlatformBasicUser,
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
        description:
          'Average price of this treatment across all clinics (computed from clinic treatments)',
      },
    },
    {
      name: 'averageRating',
      type: 'number',
      min: 0,
      max: 5,
      admin: {
        description: 'Average rating of this treatment',
        readOnly: true,
      },
    },
    {
      name: 'Clinics',
      type: 'join',
      collection: 'clinictreatments',
      on: 'treatment',
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
      on: 'treatment',
      admin: {
        defaultColumns: ['doctor', 'specializationLevel'],
        description: 'Link this treatment to one or more Doctors with their specialization level.',
        allowCreate: true,
      },
    },
  ],
}
