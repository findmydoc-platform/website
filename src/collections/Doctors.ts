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
      admin: {
        readOnly: true,
        description: 'Automatically generated from First Name and Last Name.',
      },
      hooks: {
        beforeValidate: [({ data }) => generateFullName({ data } as any)],
      },
    },
    {
      name: 'title', //TODO: English only
      type: 'select',
      options: [
        { label: 'Dr.', value: 'dr' }, // Doktor
        { label: 'Uzm. Dr.', value: 'uzm_dr' }, // Uzman Doktor (Specialist Doctor)
        { label: 'Op. Dr.', value: 'op_dr' }, // Operatör Doktor (Surgeon)
        { label: 'Doç. Dr.', value: 'doc_dr' }, // Doçent Doktor (Associate Professor)
        { label: 'Prof. Dr.', value: 'prof_dr' }, // Profesör Doktor (Professor)
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
      name: 'specializations',
      type: 'text',
      hasMany: true,
      required: true,
      admin: {
        description: 'The medical specialty of this doctor in a simplest technical implementation',
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
