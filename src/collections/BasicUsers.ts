import type { CollectionConfig } from 'payload'
import { supabaseStrategy } from '@/auth/supabaseStrategy' // Import the strategy
import { isPlatformStaff } from '@/access/isStaff' // Import only the used access control

// This is the hidden collection used for authenticating Clinic and Platform Staff
// It links to the Supabase user and determines the staff type.
export const BasicUsers: CollectionConfig = {
  slug: 'basicUsers',
  auth: {
    // Use this collection for admin authentication
    disableLocalStrategy: true,
    // Apply the custom Supabase strategy directly to this collection
    strategies: [
      {
        name: 'supabase', // Strategy name (can be anything)
        strategy: supabaseStrategy, // The imported strategy function
      },
    ],
  },
  admin: {
    // Hide this collection from the Admin UI
    hidden: true,
    // Use email for display if ever needed internally
    useAsTitle: 'email',
  },
  access: {
    // Access should be highly restricted
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
        // Hide from admin UI (though collection is hidden anyway)
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
