import { CollectionConfig } from 'payload'
import { slugField } from '@/fields/slug'
import { languageOptions } from './common/selectionOptions'
import { generateFullName } from '@/utilities/nameUtils'
import { isPlatformBasicUser } from '@/access/isPlatformBasicUser'
import { isClinicBasicUser } from '@/access/isClinicBasicUser'
import { anyone } from '@/access/anyone'

export const Doctors: CollectionConfig = {
  slug: 'doctors',
  admin: {
    group: 'Medical Network',
    useAsTitle: 'fullName',
    defaultColumns: ['fullName', 'specialization', 'clinic', 'active'],
  },
  access: {
    read: anyone,
    create: ({ req }) => isPlatformBasicUser({ req }) || isClinicBasicUser({ req }),
    update: ({ req }) => isPlatformBasicUser({ req }) || isClinicBasicUser({ req }),
    delete: isPlatformBasicUser,
  },
  fields: [
    {
      name: 'firstName',
      type: 'text',
      required: true,
    },
    {
      name: 'lastName',
      type: 'text',
      required: true,
    },
    {
      name: 'fullName',
      type: 'text',
      required: true,
      admin: {
        readOnly: true,
        description: 'Automatically generated from First Name and Last Name.',
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
      name: 'title',
      type: 'select',
      options: [
        { label: 'Dr.', value: 'dr' },
        { label: 'Specialist Dr.', value: 'specialist' },
        { label: 'Surgeon Dr.', value: 'surgeon' },
        { label: 'Assoc. Prof. Dr.', value: 'assoc_prof' },
        { label: 'Prof. Dr.', value: 'prof_dr' },
      ],
    },
    {
      name: 'biography',
      type: 'richText',
      required: false,
    },
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
        description: 'Average rating of this doctor (computed from approved reviews)',
        readOnly: true,
      },
    },
    {
      name: 'profileImage',
      type: 'upload',
      relationTo: 'media',
      required: false,
    },
    {
      name: 'treatments',
      type: 'join',
      collection: 'doctortreatments',
      on: 'treatment',
      admin: {
        defaultColumns: ['treatment', 'specializationLevel'],
        description: 'Link this doctor to one or more Treatments with their specialization level.',
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
    ...slugField('fullName'),
  ],
}
