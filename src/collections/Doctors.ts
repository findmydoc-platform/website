import { CollectionConfig } from 'payload'
import { slugField } from '@/fields/slug'
import { languageOptions } from './common/selectionOptions'
import { generateFullName } from '@/utilities/nameUtils'
import { isPlatformBasicUser } from '@/access/isPlatformBasicUser'
import { anyone } from '@/access/anyone'
import { platformOrOwnClinicResource } from '@/access/scopeFilters'

export const Doctors: CollectionConfig = {
  slug: 'doctors',
  admin: {
    group: 'Medical Network',
    useAsTitle: 'fullName',
    defaultColumns: ['fullName', 'specialization', 'clinic', 'active'],
    description: 'Doctor profiles including experience, languages and specialties',
  },
  access: {
    read: anyone, // Public read access for all users
    create: platformOrOwnClinicResource, // Platform: all, Clinic: only their clinic
    update: platformOrOwnClinicResource, // Platform: all, Clinic: only their clinic  
    delete: isPlatformBasicUser, // Only Platform can delete
  },
  trash: true, // Enable soft delete - records are marked as deleted instead of permanently removed
  fields: [
    {
      name: 'title',
      type: 'select',
      options: [
        { label: 'Dr.', value: 'dr' },
        { label: 'Specialist Dr.', value: 'specialist' },
        { label: 'Surgeon Dr.', value: 'surgeon' },
        { label: 'Assoc. Prof. Dr.', value: 'assoc_prof' },
        { label: 'Prof. Dr.', value: 'prof_dr' },
      ],
      admin: {
        description: 'Professional title displayed before the doctor\'s name',
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'firstName',
          type: 'text',
          required: true,
          admin: {
            width: '50%',
          },
        },
        {
          name: 'lastName',
          type: 'text',
          required: true,
          admin: {
            width: '50%',
          },
        },
      ],
    },
    {
      name: 'fullName',
      type: 'text',
      required: true,
      admin: {
        readOnly: true,
        description: 'Full name combined from the title and names above',
        hidden: true,
      },
      hooks: {
        beforeValidate: [
          ({ siblingData }) => {
            return generateFullName(
              siblingData?.title,
              siblingData?.firstName,
              siblingData?.lastName,
            )
          },
        ],
      },
    },
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Profile & Biography',
          fields: [
            {
              name: 'biography',
              type: 'richText',
              required: false,
              admin: {
                description: 'Short professional biography shown to patients on the doctor\'s profile',
              },
            },
            {
              name: 'profileImage',
              type: 'upload',
              relationTo: 'doctorMedia',
              required: false,
              admin: {
                description: 'Professional headshot (recommended minimum 600px width for best quality)',
              },
            },
          ],
        },
        {
          label: 'Qualifications & Clinic',
          fields: [
            {
              name: 'clinic',
              type: 'relationship',
              relationTo: 'clinics',
              required: true,
              hasMany: false,
              admin: {
                description: 'The clinic where this doctor primarily works',
              },
            },
            {
              name: 'qualifications',
              type: 'text',
              hasMany: true,
              required: true,
              admin: {
                description: 'Qualifications of this doctor such as MD, PhD, etc.',
              },
            },
            {
              name: 'experienceYears',
              label: 'Years of Experience',
              type: 'number',
              required: false,
              admin: {
                description: 'Number of years practicing medicine professionally',
              },
            },
            {
              name: 'languages',
              type: 'select',
              options: languageOptions,
              hasMany: true,
              required: true,
              admin: {
                description: 'Languages spoken by this doctor',
              },
            },
            {
              name: 'averageRating',
              type: 'number',
              min: 0,
              max: 5,
              admin: {
                description: 'Average rating of this doctor',
                readOnly: true,
              },
            },
          ],
        },
        {
          label: 'Specialties & Treatments',
          fields: [
            {
              name: 'treatments',
              type: 'join',
              collection: 'doctortreatments',
              on: 'treatment',
              admin: {
                defaultColumns: ['treatment', 'specializationLevel'],
                description:
                  'Link this doctor to one or more Treatments with their specialization level.',
                allowCreate: true,
              },
            },
            {
              name: 'specialties',
              type: 'join',
              collection: 'doctorspecialties',
              on: 'medicalSpecialty',
              admin: {
                defaultColumns: ['medicalSpecialty', 'specializationLevel', 'certifications'],
                description:
                  'Link this doctor to one or more Medical Specialties with their specialization level and certifications.',
                allowCreate: true,
              },
            },
          ],
        },
      ],
    },
    ...slugField('fullName'),
  ],
}
