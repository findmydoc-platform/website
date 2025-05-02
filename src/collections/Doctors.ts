import { CollectionConfig } from 'payload'
import { slugField } from '@/fields/slug'
import { languageOptions } from './common/selectionOptions'
import type { GlobalBeforeValidateHook } from 'payload'

// Hook to automatically generate fullName from firstName and lastName
const generateFullName: GlobalBeforeValidateHook = ({ data }) => {
  if (data.firstName && data.lastName) {
    return `${data.firstName} ${data.lastName}`
  }
  // Return existing data.fullName if first/last name aren't present
  // or handle error/default as needed
  return data.fullName || ''
}

export const Doctors: CollectionConfig = {
  slug: 'doctors',
  admin: {
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
        beforeValidate: [({ data }) => generateFullName({ data } as any)],
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
      required: false,
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
      name: 'contact',
      type: 'group',
      fields: [
        {
          name: 'email',
          type: 'email',
          required: true,
        },
        {
          name: 'phone',
          type: 'text',
        },
      ],
    },
    {
      name: 'rating', //TODO: Calculate rating from reviews
      type: 'number',
      required: false,
    },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      required: false,
    },
    // Spread the slugField into the fields array
    ...slugField('fullName'), // Add slug field that uses the 'fullName' field as source
  ],
}
