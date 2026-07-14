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
      name: 'supabaseUserId',
      label: 'Supabase User ID',
      type: 'text',
      unique: true,
      index: true,
      access: {
        create: () => false,
        read: () => false,
        update: () => false,
      },
      admin: {
        hidden: true,
        readOnly: true,
      },
    },
    {
      name: 'email',
      type: 'email',
      label: 'Email',
      access: {
        create: () => false,
        read: () => false,
        update: () => false,
      },
      admin: {
        hidden: true,
        readOnly: true,
      },
    },
    {
      name: 'firstName',
      type: 'text',
      label: 'First Name',
      access: {
        create: () => false,
        read: () => false,
        update: () => false,
      },
      admin: {
        hidden: true,
        readOnly: true,
      },
    },
    {
      name: 'lastName',
      type: 'text',
      label: 'Last Name',
      access: {
        create: () => false,
        read: () => false,
        update: () => false,
      },
      admin: {
        hidden: true,
        readOnly: true,
      },
    },
    {
      name: 'profileImage',
      type: 'upload',
      relationTo: 'userProfileMedia',
      access: {
        create: () => false,
        read: () => false,
        update: () => false,
      },
      admin: {
        hidden: true,
        readOnly: true,
      },
    },
    {
      name: 'user',
      type: 'relationship',
      label: 'User',
      relationTo: 'basicUsers',
      required: true,
      unique: true,
      hasMany: false,
      admin: {
        description: 'Select the account for this staff member',
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
        description: 'Choose the access level for this staff member',
      },
    },
  ],
  timestamps: true,
}
