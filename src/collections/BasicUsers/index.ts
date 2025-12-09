import type { CollectionConfig } from 'payload'
import { supabaseStrategy } from '@/auth/strategies/supabaseStrategy'
import { isPlatformBasicUser } from '@/access/isPlatformBasicUser'
import { createUserProfileHook } from './hooks/createUserProfile'
import { createSupabaseUserHook } from './hooks/createSupabaseUser'
import { deleteSupabaseUserHook } from './hooks/deleteSupabaseUser'

// Authentication collection for Clinic and Platform Staff (Admin UI access)
export const BasicUsers: CollectionConfig = {
  slug: 'basicUsers',
  auth: {
    useSessions: false,
    disableLocalStrategy: true,
    strategies: [supabaseStrategy],
  },
  admin: {
    group: 'User Management',
    useAsTitle: 'email',
    description: 'Accounts for users who have access to the admin UI',
    defaultColumns: ['email', 'firstName', 'lastName', 'userType'],
    groupBy: true,
  },
  access: {
    read: isPlatformBasicUser,
    create: isPlatformBasicUser,
    update: isPlatformBasicUser,
    delete: isPlatformBasicUser,
  },
  hooks: {
    beforeChange: [createSupabaseUserHook],
    afterChange: [createUserProfileHook],
    beforeDelete: [deleteSupabaseUserHook],
  },
  fields: [
    {
      name: 'supabaseUserId',
      label: 'Supabase User ID',
      type: 'text',
      required: false,
      unique: true,
      admin: {
        readOnly: true,
        hidden: true,
      },
      index: true,
    },
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
            description: 'User given name',
          },
        },
        {
          name: 'lastName',
          type: 'text',
          label: 'Last Name',
          required: true,
          admin: {
            width: '50%',
            description: 'User family name',
          },
        },
      ],
    },
    {
      name: 'email',
      type: 'email',
      label: 'Email',
      required: true,
      unique: true,
      admin: {
        description: 'Login email address for accessing the admin interface',
      },
    },
    {
      name: 'userType',
      label: 'User Type',
      type: 'select',
      required: true,
      options: [
        { label: 'Clinic Staff', value: 'clinic' },
        { label: 'Platform Staff', value: 'platform' },
      ],
      admin: {
        description: 'Determines admin permissions - Clinic: limited to own clinic, Platform: full access',
      },
    },
    {
      name: 'profileImage',
      type: 'upload',
      relationTo: 'userProfileMedia',
      required: false,
      admin: {
        description: 'Profile photo displayed in admin interface (recommended: square format, min 200px)',
      },
    },
  ],
  timestamps: true,
}
