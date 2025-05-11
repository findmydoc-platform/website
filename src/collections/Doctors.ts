import { CollectionConfig } from 'payload'
import { slugField } from '@/fields/slug'
import { languageOptions } from './common/selectionOptions'
import { generateFullName } from '@/utilities/nameUtils'

export const Doctors: CollectionConfig = {
  slug: 'doctors',
  admin: {
    group: 'Medical Network',
    useAsTitle: 'fullName',
    defaultColumns: ['fullName', 'specialization', 'clinic', 'active'],
  },
  access: {
    read: () => true,
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
      },
      hooks: {
        beforeValidate: [
          ({ siblingData }) => {
            return generateFullName(siblingData?.firstName, siblingData?.lastName)
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
      name: 'rating', //TODO: Calculate rating from reviews
      type: 'number',
      required: false,
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
    ...slugField('fullName'),
  ],
}
