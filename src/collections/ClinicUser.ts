import { CollectionConfig } from 'payload'

export const ClinicUsers: CollectionConfig = {
  slug: 'clinic-users',
  admin: {
    defaultColumns: ['user', 'clinic', 'role'],
    useAsTitle: 'user',
  },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users', // Links to the Users collection
      required: true,
    },
    {
      name: 'clinic',
      type: 'relationship',
      relationTo: 'clinics', // Links to the Clinics collection
      required: true,
    },
    {
      name: 'role',
      type: 'select',
      options: [
        {
          label: 'Owner',
          value: 'owner',
        },
        {
          label: 'Contributor',
          value: 'contributor',
        },
      ],
      required: true,
    },
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Is this user currently active in this clinic?',
      },
    },
  ],
  timestamps: true,
}
