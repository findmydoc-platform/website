import type { CollectionConfig } from 'payload'
import { supabaseStrategy } from '@/auth/strategies/supabaseStrategy'
import { isPlatformBasicUser } from '@/access/isPlatformBasicUser'
import { createUserProfileHook } from './hooks/createUserProfile'
import { createSupabaseUserHook } from './hooks/createSupabaseUser'
import { deleteSupabaseUserHook } from './hooks/deleteSupabaseUser'
import { stableIdBeforeChangeHook, stableIdField } from '../common/stableIdField'

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
    useAsTitle: 'firstName',
    description: 'Accounts for people who can sign in to the admin area',
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
    beforeChange: [stableIdBeforeChangeHook, createSupabaseUserHook],
    afterChange: [createUserProfileHook],
    beforeDelete: [deleteSupabaseUserHook],
  },
  fields: [
    stableIdField(),
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
            description: 'Given name',
          },
        },
        {
          name: 'lastName',
          type: 'text',
          label: 'Last Name',
          required: true,
          admin: {
            width: '50%',
            description: 'Family name',
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
        description: 'Email used to sign in',
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
        description: 'Choose clinic staff or platform staff',
      },
    },
    {
      name: 'profileImage',
      type: 'upload',
      relationTo: 'userProfileMedia',
      required: false,
      admin: {
        description: 'Profile photo shown in the admin area',
      },
    },
  ],
  timestamps: true,
}
