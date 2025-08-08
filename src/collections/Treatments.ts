import { CollectionConfig } from 'payload'
import { anyone } from '@/access/anyone'
import { isPlatformBasicUser } from '@/access/isPlatformBasicUser'

export const Treatments: CollectionConfig = {
  slug: 'treatments',
  admin: {
    group: 'Medical Network',
    useAsTitle: 'name',
    defaultColumns: ['name', 'description', 'averagePrice'],
    description: 'Medical treatments offered by clinics, including pricing and ratings',
  },
  access: {
    read: anyone,
    create: isPlatformBasicUser,
    update: isPlatformBasicUser,
    delete: isPlatformBasicUser,
  },
  timestamps: true,
  trash: true,
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Treatment Details',
          fields: [
            {
              name: 'name',
              type: 'text',
              required: true,
              admin: {
                description: 'Treatment name',
              },
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
              admin: {
                description: 'Detailed explanation of the treatment',
              },
            },
            {
              name: 'medicalSpecialty',
              type: 'relationship',
              relationTo: 'medical-specialties',
              required: true,
              admin: {
                description: 'Specialty this treatment belongs to',
              },
            },
            {
              name: 'averagePrice',
              type: 'number',
              required: false,
              admin: {
                readOnly: true,
                description: 'Average price of this treatment across all clinics (computed from clinic treatments)',
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
          ],
        },
        {
          label: 'Associated Clinics',
          fields: [
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
          ],
        },
        {
          label: 'Associated Doctors',
          fields: [
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
        },
      ],
    },
  ],
}
