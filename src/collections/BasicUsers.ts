import type { CollectionConfig } from 'payload'
import { supabaseStrategy } from '@/auth/strategies/supabaseStrategy'
import { isPlatformBasicUser } from '@/access/isPlatformBasicUser'
import { createUserProfileHook } from '@/hooks/userProfileManagement'
import { createSupabaseUserHook } from '@/hooks/userLifecycle/basicUserSupabaseHook'
import { deleteSupabaseUserHook } from '@/hooks/userLifecycle/basicUserDeletionHook'

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
    },
    {
      name: 'password',
      label: 'Password',
      type: 'text',
      virtual: true,
      required: true,
      admin: {
        description: 'Password for the new user.',
        condition: (_data, _siblingData, context) => context?.operation === 'create',
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
        description: 'Defines whether the user is clinic staff or platform staff of findmydoc',
      },
    },
    {
      name: 'profileImage',
      type: 'upload',
      relationTo: 'media',
      required: false,
      admin: {
        description: 'Optional profile image for this user.',
      },
    },
  ],
  timestamps: true,
}
