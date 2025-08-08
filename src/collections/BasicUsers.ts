import type { CollectionConfig } from 'payload'
import { supabaseStrategy } from '@/auth/strategies/supabaseStrategy'
import { isPlatformBasicUser } from '@/access/isPlatformBasicUser'
import { createUserProfileHook } from '@/hooks/userProfileManagement'
import { createSupabaseUserHook } from '@/hooks/userLifecycle/basicUserSupabaseHook'
import { displayTemporaryPasswordHook } from '@/hooks/userLifecycle/displayTemporaryPasswordHook'
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
    description: 'Accounts for clinic and platform staff to sign in to the admin panel',
  },
  access: {
    read: isPlatformBasicUser,
    create: isPlatformBasicUser, // Allow forms to create BasicUsers - will be handled by hooks
    update: isPlatformBasicUser,
    delete: isPlatformBasicUser,
  },
  hooks: {
    beforeChange: [createSupabaseUserHook],
    afterChange: [displayTemporaryPasswordHook, createUserProfileHook],
    beforeDelete: [deleteSupabaseUserHook],
    // afterDelete hook removed - everything is handled in beforeDelete to avoid foreign key constraints
  },
  fields: [
    {
      name: 'email',
      type: 'email',
      label: 'Email',
      required: true,
      unique: true,
    },
    {
      name: 'supabaseUserId',
      label: 'Supabase User ID',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        readOnly: true,
        hidden: true,
      },
      index: true,
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
        description: 'Defines whether the staff member works for a clinic or the platform',
      },
    },
    {
      name: 'temporaryPassword',
      label: 'Temporary Password',
      type: 'text',
      admin: {
        readOnly: true,
        description: 'Auto-generated temporary password for new users. Share this securely with the user.',
        condition: (data) => Boolean(data.temporaryPassword), // Only show if password exists
      },
    },
  ],
  timestamps: true,
}
