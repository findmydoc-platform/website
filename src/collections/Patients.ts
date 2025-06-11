import type { CollectionConfig } from 'payload'
import { supabaseStrategy } from '@/auth/supabaseStrategy'
import { isPatient, isOwnPatient } from '@/access/isPatient'
import { isPlatformStaff } from '@/access/isStaff'

// Authentication-enabled collection for Patients (API access only)
export const Patients: CollectionConfig = {
  slug: 'patients',
  auth: {
    disableLocalStrategy: true,
    strategies: [supabaseStrategy],
  },
  admin: {
    hidden: false,
    group: 'User Management',
    useAsTitle: 'email',
    defaultColumns: ['email', 'firstName', 'lastName'],
    description:
      'Patient accounts for API access. Admin UI access is restricted to BasicUsers only.',
  },
  access: {
    read: ({ req }) => {
      if (isPlatformStaff({ req })) return true

      if (isPatient({ req })) {
        return {
          id: {
            equals: req.user?.id,
          },
        }
      }

      return false
    },
    create: isPlatformStaff,
    update: ({ req, id }) => {
      if (isPlatformStaff({ req })) return true
      return isOwnPatient({ req, id })
    },
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
  ],
  timestamps: true,
}
