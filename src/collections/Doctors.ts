import { CollectionConfig } from 'payload'
import { slugField } from '@/fields/slug'

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
      name: 'fullName',
      type: 'text',
      required: true,
    },
    {
      name: 'title',
      type: 'select',
      options: [
        { label: 'Dr. med.', value: 'dr_med' },
        { label: 'Prof. Dr. med.', value: 'prof_dr_med' },
        { label: 'PD Dr. med.', value: 'pd_dr_med' },
      ],
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
      name: 'specialization',
      type: 'select',
      required: true,
      options: [
        { label: 'Orthopädie', value: 'orthopedics' },
        { label: 'Sportmedizin', value: 'sports_medicine' },
        { label: 'Chirurgie', value: 'surgery' },
        { label: 'Physiotherapie', value: 'physiotherapy' },
      ],
    },
    {
      name: 'languages',
      type: 'relationship',
      relationTo: 'languages',
      hasMany: true,
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
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      required: false,
    },
    {
      name: 'biography',
      type: 'richText',
      required: false,
    },
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Ist dieser Arzt aktuell tätig?',
      },
    },
    ...slugField('fullName'), // Add slug field that uses the 'fullName' field as source
  ],
  timestamps: true,
}
