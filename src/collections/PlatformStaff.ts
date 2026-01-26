import type { CollectionConfig } from 'payload'
import { isPlatformBasicUser } from '@/access/isPlatformBasicUser'
import { stableIdBeforeChangeHook, stableIdField } from './common/stableIdField'

// Profile collection for Platform Staff members
export const PlatformStaff: CollectionConfig = {
  slug: 'platformStaff',
  auth: false,
  admin: {
    group: 'User Management',
    useAsTitle: 'user',
    defaultColumns: ['user', 'role'],
    description: 'Platform staff profiles',
  },
  access: {
    read: isPlatformBasicUser,
    create: () => false,
    update: isPlatformBasicUser,
    delete: () => false,
  },
  hooks: {
    beforeChange: [stableIdBeforeChangeHook],
  },
  fields: [
    stableIdField(),
    {
      name: 'user',
      type: 'relationship',
      label: 'Email',
      relationTo: 'basicUsers',
      required: true,
      unique: true,
      hasMany: false,
      admin: {
        description: 'Choose the Supabase user account for this platform staff member',
      },
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
      admin: {
        description:
          'Determines platform permissions - Admin: full access, Support: limited to applications, Content Manager: posts/pages only',
      },
    },
  ],
  timestamps: true,
}
