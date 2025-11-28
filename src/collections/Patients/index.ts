import type { CollectionConfig } from 'payload'
import { supabaseStrategy } from '@/auth/strategies/supabaseStrategy'
import { isPatient, isOwnPatient } from '@/access/isPatient'
import { isPlatformBasicUser } from '@/access/isPlatformBasicUser'
import { patientSupabaseCreateHook } from './hooks/patientSupabaseCreate'
import { patientSupabaseDeleteHook } from './hooks/patientSupabaseDelete'

// Authentication-enabled collection for Patients (API access only)
export const Patients: CollectionConfig = {
  slug: 'patients',
  auth: {
    useSessions: false,
    disableLocalStrategy: true,
    strategies: [supabaseStrategy],
  },
  admin: {
    hidden: false,
    group: 'User Management',
    useAsTitle: 'email',
    defaultColumns: ['email', 'firstName', 'lastName'],
    description: 'Profiles of patients for appointments and reviews. Only staff can view them here.',
  },
  access: {
    read: ({ req }) => {
      if (isPlatformBasicUser({ req })) return true

      if (isPatient({ req })) {
        return {
          id: {
            equals: req.user?.id,
          },
        }
      }

      return false
    },
    create: isPlatformBasicUser,
    update: ({ req, id }) => {
      if (isPlatformBasicUser({ req })) return true
      return isOwnPatient({ req, id })
    },
    delete: isPlatformBasicUser,
  },
  hooks: {
    beforeChange: [patientSupabaseCreateHook],
    beforeDelete: [patientSupabaseDeleteHook],
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
      required: false,
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
      admin: {
        description: 'First name',
      },
    },
    {
      name: 'lastName',
      type: 'text',
      label: 'Last Name',
      required: true,
      admin: {
        description: 'Last name',
      },
    },
  ],
  timestamps: true,
}
