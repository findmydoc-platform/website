import { CollectionConfig } from 'payload'
import { anyone } from '@/access/anyone'
import { isPlatformBasicUser } from '@/access/isPlatformBasicUser'
import { stableIdBeforeChangeHook, stableIdField } from './common/stableIdField'

export const Treatments: CollectionConfig = {
  slug: 'treatments',
  admin: {
    group: 'Medical Network',
    useAsTitle: 'name',
    defaultColumns: ['name', 'description', 'averagePrice'],
    description: 'Treatments offered by clinics, with pricing and ratings',
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
  timestamps: true,
  trash: true, // Enable soft delete - records are marked as deleted instead of permanently removed
  fields: [
    stableIdField(),
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
                description: 'Treatment tags',
              },
            },
            {
              name: 'description',
              type: 'richText',
              required: true,
              admin: {
                description: 'Short explanation',
              },
            },
            {
              name: 'medicalSpecialty',
              type: 'relationship',
              relationTo: 'medical-specialties',
              required: true,
              admin: {
                description: 'Parent specialty',
              },
            },
            {
              name: 'averagePrice',
              type: 'number',
              required: false,
              admin: {
                readOnly: true,
                description: 'Average price',
              },
            },
            {
              name: 'averageRating',
              type: 'number',
              min: 0,
              max: 5,
              admin: {
                description: 'Average rating',
                readOnly: true,
              },
            },
          ],
        },
        {
          label: 'Associated Clinics',
          description: 'Clinics with prices',
          fields: [
            {
              name: 'Clinics',
              type: 'join',
              collection: 'clinictreatments',
              on: 'treatment',
              admin: {
                defaultColumns: ['clinic', 'price'],
                description: 'Clinics with prices',
                allowCreate: true,
              },
            },
          ],
        },
        {
          label: 'Associated Doctors',
          description: 'Doctors with expertise',
          fields: [
            {
              name: 'Doctors',
              type: 'join',
              collection: 'doctortreatments',
              on: 'treatment',
              admin: {
                defaultColumns: ['doctor', 'specializationLevel'],
                description: 'Doctors with expertise',
                allowCreate: true,
              },
            },
          ],
        },
      ],
    },
  ],
}
