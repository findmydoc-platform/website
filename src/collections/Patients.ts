import type { CollectionConfig } from 'payload'
import { supabaseStrategy } from '@/auth/supabaseStrategy' // Import the strategy
import { isPatient, isOwnPatient } from '@/access/isPatient'
import { isPlatformStaff } from '@/access/isStaff'

// This is the standalone authentication collection for Patients.
// It is visible in the Admin UI for management by Platform Staff.
export const Patients: CollectionConfig = {
  slug: 'patients',
  auth: {
    // Patients use this collection for authentication via the custom strategy
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
    // Visible in the Admin UI
    hidden: false,
    group: 'User Management',
    useAsTitle: 'email',
    defaultColumns: ['email', 'firstName', 'lastName'],
  },
  access: {
    // Patients can only access their own records
    // Platform Staff can manage all patient records
    read: ({ req: { user } }) => {
      // Platform staff can read all patients
      if (isPlatformStaff({ req: { user } })) return true
      
      // Patients can only read their own record
      if (isPatient({ req: { user } })) {
        return {
          id: {
            equals: user.id,
          },
        }
      }
      
      // No access for others
      return false
    },
    create: isPlatformStaff, // Only platform staff can create patients manually
    update: ({ req, id }) => {
      // Platform staff can update any patient
      if (isPlatformStaff({ req })) return true
      
      // Patients can update their own record
      return isOwnPatient({ req, id })
    },
    delete: isPlatformStaff, // Only platform staff can delete patients
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
    // ... Add other patient-specific fields here (e.g., dateOfBirth, phone)
  ],
  timestamps: true,
}
