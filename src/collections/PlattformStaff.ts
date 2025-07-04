import type { CollectionConfig } from 'payload'

// Profile collection for Platform Staff members
export const PlattformStaff: CollectionConfig = {
  slug: 'plattformStaff',
  auth: false,
  admin: {
    group: 'User Management',
    useAsTitle: 'firstName',
    defaultColumns: ['firstName', 'lastName', 'user', 'role'],
    description:
      'Platform administrators and support staff who manage the overall medical platform. These users have full access to all system functions.',
  },
  access: {
    read: () => true, //
  },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      label: 'Email',
      relationTo: 'basicUsers',
      required: true,
      unique: true,
      hasMany: false,
      admin: {
        position: 'sidebar',
      },
      filterOptions: ({ relationTo: _relationTo, siblingData: _siblingData }) => {
        return {
          userType: { equals: 'platform' },
        }
      },
    },
    {
      name: 'firstName',
      type: 'text',
      label: 'First Name',
      required: true,
    },
    {
      name: 'lastName',
      type: 'text',
      label: 'Last Name',
      required: true,
    },
    {
      name: 'role',
      type: 'select',
      label: 'Role',
      required: true,
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'Support', value: 'support' },
        { label: 'Content Manager', value: 'content-manager' },
      ],
      defaultValue: 'support',
    },
    {
      name: 'profileImage',
      type: 'upload',
      relationTo: 'media',
      required: false,
    },
  ],
  timestamps: true,
}
