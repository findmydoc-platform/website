import type { CollectionConfig } from 'payload'
import { supabaseStrategy } from '@/auth/supabaseStrategy'
import { isPlatformStaff } from '@/access/isStaff'

// Hidden collection for authenticating Clinic and Platform Staff
export const BasicUsers: CollectionConfig = {
  slug: 'basicUsers',
  auth: {
    disableLocalStrategy: true,
    strategies: [supabaseStrategy],
  },
  admin: {
    // Hide this collection from the Admin UI
    hidden: true,
    useAsTitle: 'email',
  },
  access: {
    // Only platform staff can directly access basicUsers records
    read: isPlatformStaff,
    create: isPlatformStaff,
    update: isPlatformStaff,
    delete: isPlatformStaff,
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
