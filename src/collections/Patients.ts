import { CollectionConfig } from 'payload'
import { slugField } from '@/fields/slug'
import { languageOptions } from './common/selectionOptions'

export const Patients: CollectionConfig = {
  slug: 'patients',
  admin: {
    group: 'Medical Network', // Assuming this group is still relevant
    useAsTitle: 'fullName',
    defaultColumns: ['fullName', 'email', 'dateOfBirth', 'gender', 'language'],
  },
  access: {
    read: () => true, // Assuming default read access
  },
  fields: [
    {
      name: 'email',
      label: 'E-Mail',
      type: 'email',
      required: true,
      unique: true,
    },
    {
      name: 'firstName',
      label: 'First name',
      type: 'text',
      required: true,
    },
    {
      name: 'lastName',
      label: 'Last name',
      type: 'text',
      required: true,
    },
    {
      name: 'dateOfBirth',
      label: 'Date of birth',
      type: 'date',
    },
    {
      name: 'gender',
      label: 'Gender',
      type: 'select',
      options: [
        { label: 'Male', value: 'male' },
        { label: 'Female', value: 'female' },
        { label: 'Other', value: 'other' },
        { label: 'Not Specified', value: 'not_specified' },
      ],
    },
    {
      name: 'phoneNumber',
      label: 'Phone number',
      type: 'text',
    },
    {
      name: 'address',
      label: 'Address',
      type: 'text',
    },
    {
      name: 'country',
      label: 'Country',
      type: 'relationship',
      relationTo: 'countries',
      hasMany: false,
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
      name: 'profileImage',
      label: 'Profile Image',
      type: 'upload',
      relationTo: 'media',
      required: false,
    },
    ...slugField('fullName'), // Generates a slug from fullName
  ],
}
