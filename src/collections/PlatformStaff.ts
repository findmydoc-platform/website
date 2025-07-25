import type { CollectionConfig } from 'payload'
import { isPlatformBasicUser } from '@/access/isPlatformBasicUser'
import { createBasicUserForPlatformStaffHook, cleanupTempPasswordHook } from '@/hooks/syncUserWithSupabase'
import { deletePlatformStaffUserHook } from '@/hooks/userDeletion'

// Profile collection for Platform Staff members
export const PlatformStaff: CollectionConfig = {
  slug: 'platformStaff',
  auth: false,
  admin: {
    group: 'User Management',
    useAsTitle: 'firstName',
    defaultColumns: ['firstName', 'lastName', 'email', 'role', 'tempPassword'],
    description:
      'Platform administrators and support staff. Create new admin users here - this will automatically set up their authentication and access.',
  },
  access: {
    read: isPlatformBasicUser,
    create: isPlatformBasicUser,
    update: isPlatformBasicUser,
    delete: isPlatformBasicUser,
  },
  hooks: {
    beforeChange: [createBasicUserForPlatformStaffHook],
    afterChange: [cleanupTempPasswordHook],
    beforeDelete: [deletePlatformStaffUserHook],
  },
  fields: [
    {
      name: 'email',
      type: 'email',
      label: 'Email',
      required: true,
      unique: true,
      admin: {
        description: 'Email address for login. This will create a new admin user account.',
      },
    },
    {
      name: 'user',
      type: 'relationship',
      label: 'Basic User Account',
      relationTo: 'basicUsers',
      required: false,
      hasMany: false,
      admin: {
        readOnly: true,
        hidden: true,
        description: 'Linked authentication account (auto-created)',
      },
      filterOptions: ({ relationTo: _relationTo, siblingData: _siblingData }) => {
        return {
          userType: { equals: 'platform' },
        }
      },
    },
    {
      name: 'tempPassword',
      label: 'Temporary Password',
      type: 'text',
      admin: {
        readOnly: true,
        description: 'Temporary password for the new user. Share this securely with them.',
        condition: (data) => !!data.tempPassword,
      },
      access: {
        read: ({ req }) =>
          Boolean(req.user && req.user.collection === 'basicUsers' && req.user.userType === 'platform'),
        create: () => false, // Only set by hooks
        update: () => false, // Only set by hooks
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
