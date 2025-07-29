import type { CollectionConfig } from 'payload'
import { supabaseStrategy } from '@/auth/strategies/supabaseStrategy'
import { isPatient, isOwnPatient } from '@/access/isPatient'
import { isPlatformBasicUser } from '@/access/isPlatformBasicUser'
import { deletePatientHook } from '@/hooks/userLifecycle/deleteUserHooks'

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
    beforeDelete: [deletePatientHook],
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
    {
      name: 'dateOfBirth',
      type: 'date',
      label: 'Date of Birth',
      admin: {
        description: "Patient's birth date",
      },
    },
    {
      name: 'gender',
      type: 'select',
      label: 'Gender',
      options: [
        { label: 'Male', value: 'male' },
        { label: 'Female', value: 'female' },
        { label: 'Other', value: 'other' },
        { label: 'Not specified', value: 'not_specified' },
      ],
      admin: {
        description: "Patient's gender identity",
      },
    },
    {
      name: 'phoneNumber',
      type: 'text',
      label: 'Phone Number',
      admin: {
        description: 'Contact phone number',
      },
    },
    {
      name: 'address',
      type: 'text',
      label: 'Address',
      admin: {
        description: 'Residential address',
      },
    },
    {
      name: 'country',
      type: 'relationship',
      label: 'Country',
      relationTo: 'countries',
      admin: {
        description: 'Country of residence',
      },
    },
    {
      name: 'language',
      type: 'select',
      label: 'Preferred Language',
      options: [
        { label: 'English', value: 'en' },
        { label: 'German', value: 'de' },
        { label: 'French', value: 'fr' },
        { label: 'Spanish', value: 'es' },
        { label: 'Arabic', value: 'ar' },
        { label: 'Russian', value: 'ru' },
        { label: 'Chinese', value: 'zh' },
      ],
      defaultValue: 'en',
      admin: {
        description: 'Preferred language for communication',
      },
    },
    {
      name: 'profileImage',
      type: 'upload',
      label: 'Profile Image',
      relationTo: 'media',
      admin: {
        description: 'Optional profile picture',
      },
    },
  ],
  timestamps: true,
}
