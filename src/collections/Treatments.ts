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
    description: 'Medical treatments offered by clinics, including pricing and ratings',
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
          description: 'Read-only list; use Clinics collection to modify pricing and availability',
          fields: [
            {
              name: 'Clinics',
              type: 'join',
              collection: 'clinictreatments',
              on: 'treatment',
              admin: {
                defaultColumns: ['clinic', 'price'],
                description: 'Shows clinics offering this treatment - edit prices in individual Clinic records',
                allowCreate: true,
              },
            },
          ],
        },
        {
          label: 'Associated Doctors',
          description: 'Read-only list; use Doctors collection to modify specialization and expertise',
          fields: [
            {
              name: 'Doctors',
              type: 'join',
              collection: 'doctortreatments',
              on: 'treatment',
              admin: {
                defaultColumns: ['doctor', 'specializationLevel'],
                description:
                  'Shows doctors specialized in this treatment - edit expertise in individual Doctor records',
                allowCreate: true,
              },
            },
          ],
        },
      ],
    },
  ],
}
