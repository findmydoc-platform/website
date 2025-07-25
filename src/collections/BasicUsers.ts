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
    defaultColumns: ['email', 'userType'],
    description: 'Authentication accounts - managed automatically when creating staff profiles.',
  },
  access: {
    read: isPlatformBasicUser,
    create: () => false, // Prevent direct creation - use PlatformStaff/ClinicStaff instead
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
        description: 'User type determines access level. Platform staff have admin access.',
      },
    },
  ],
  timestamps: true,
}
