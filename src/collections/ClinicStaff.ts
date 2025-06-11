import type { CollectionConfig } from 'payload'
import {
  isClinicStaff,
  isPlatformStaff,
  isOwnClinicStaffProfile,
  isPlatformStaffOrSelf,
} from '@/access/isStaff'

// Profile collection for Clinic Staff members
export const ClinicStaff: CollectionConfig = {
  slug: 'clinicStaff',
  auth: false,
  admin: {
    group: 'User Management',
    useAsTitle: 'firstName',
    defaultColumns: ['firstName', 'lastName', 'email'],
  },
  access: {
    read: ({ req }) => {
      if (isPlatformStaff({ req })) return true

      if (isClinicStaff({ req })) {
        return isOwnClinicStaffProfile({ req })
      }

      return false
    },
    create: isPlatformStaff,
    update: isPlatformStaffOrSelf,
    delete: isPlatformStaff,
  },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'basicUsers',
      required: true,
      unique: true,
      hasMany: false,
      admin: {
        position: 'sidebar',
      },
      filterOptions: ({ relationTo: _relationTo, siblingData: _siblingData }) => {
        return {
          userType: { equals: 'clinic' },
        }
      },
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
      name: 'email',
      type: 'email',
      label: 'Contact Email',
      required: false,
    },
  ],
  timestamps: true,
}
