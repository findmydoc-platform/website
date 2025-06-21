import type { CollectionConfig } from 'payload'
import { supabaseStrategy } from '@/auth/strategies/supabaseStrategy'
import { isPlatformBasicUser } from '@/access/isPlatformBasicUser'

// Authentication collection for Clinic and Platform Staff (Admin UI access)
export const BasicUsers: CollectionConfig = {
  slug: 'basicUsers',
  auth: {
    disableLocalStrategy: true,
    strategies: [supabaseStrategy],
  },
  admin: {
    group: 'User Management',
    hidden: true,
    useAsTitle: 'email',
    description: 'Authentication collection for staff members. Used for Admin UI login.',
  },
  access: {
    read: isPlatformBasicUser,
    create: isPlatformBasicUser,
    update: isPlatformBasicUser,
    delete: isPlatformBasicUser,
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
        readOnly: true, // Should be set by the auth strategy
      },
    },
  ],
  timestamps: true,
}
