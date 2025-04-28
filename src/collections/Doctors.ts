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
      name: 'title',
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
      name: 'specialitys',
      type: 'text',
      hasMany: true,
      required: true,
      admin: {
        description: 'The medical specialty of this doctor in a simplest technical implementation',
      },
    },
    {
      name: 'specializations',
      type: 'array',
      minRows: 0,
      maxRows: 10,
      labels: {
        singular: 'Specialization',
        plural: 'Specializations',
      },
      fields: [
        {
          name: 'name',
          type: 'text',
          required: true,
          label: 'Specialization Name',
        },
      ],
      admin: {
        description: 'Add each specialization manually.',
      },
    },
    {
      name: 'experience',
      label: 'Education and Professional Experience',
      type: 'blocks', // Use blocks to allow multiple entries
      minRows: 0,
      maxRows: 25, // Set a reasonable limit
      required: false, // Make it optional if needed
      blocks: [
        {
          slug: 'experienceItem', // Identifier for this block type
          labels: {
            singular: 'Experience Entry',
            plural: 'Experience Entries',
          },
          fields: [
            // Fields for each experience entry
            {
              name: 'period',
              type: 'text', // Flexible text for dates like "Since 2022" or "2019 - 2022"
              label: 'Time Period',
              required: true,
              admin: {
                description: 'Enter the time frame (e.g., "2019 - 2022", "Since 2022").',
              },
            },
            {
              name: 'locationAndRole',
              type: 'text', // Combine location and role for simplicity based on example
              label: 'Location & Role',
              required: true,
              admin: {
                description:
                  'Enter the place and role (e.g., "Ankara", "Doktor - Dünyagöz Hastanesi").',
              },
            },
            {
              name: 'details',
              type: 'text', // Optional field for more details like department
              label: 'Details (Optional)',
              required: false,
              admin: {
                description: 'Add any further details like department (e.g., "Altersmedizin", "").',
              },
            },
          ],
        },
      ],
      admin: {
        description: 'Add each significant professional experience as a separate entry.',
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
