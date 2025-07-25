import type { CollectionConfig } from 'payload'

// Profile collection for Platform Staff members
export const PlatformStaff: CollectionConfig = {
  slug: 'platformStaff',
  auth: false,
  admin: {
    group: 'User Management',
    useAsTitle: 'firstName',
    defaultColumns: ['firstName', 'lastName', 'user', 'role'],
    description:
      'Staff members who manage the platform or provide customer support',
  },
  access: {
    read: () => true, //
  },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'firstName',
          type: 'text',
          label: 'First Name',
          required: true,
          admin: {
            width: '50%',
          },
        },
        {
          name: 'lastName',
          type: 'text',
          label: 'Last Name',
          required: true,
          admin: {
            width: '50%',
          },
        },
      ],
    },
    {
      name: 'user',
      type: 'relationship',
      label: 'Email',
      relationTo: 'basicUsers',
      required: true,
      unique: true,
      hasMany: false,
      filterOptions: ({ relationTo: _relationTo, siblingData: _siblingData }) => {
        return {
          userType: { equals: 'platform' },
        }
      },
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
