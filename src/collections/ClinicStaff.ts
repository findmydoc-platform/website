import type { CollectionConfig } from 'payload'
import { isClinicBasicUser, isOwnClinicStaffProfile } from '@/access/isClinicBasicUser'
import { isPlatformBasicUser, isPlatformStaffOrSelf } from '@/access/isPlatformBasicUser'

// Profile collection for Clinic Staff members
export const ClinicStaff: CollectionConfig = {
  slug: 'clinicStaff',
  auth: false,
  admin: {
    group: 'User Management',
    useAsTitle: 'firstName',
    defaultColumns: ['firstName', 'lastName', 'email', 'status'],
    description:
      'Clinic staff members who manage clinic operations and patient interactions. These users have access to clinic-specific administrative functions.',
  },
  access: {
    read: ({ req }) => {
      if (isPlatformBasicUser({ req })) return true

      if (isClinicBasicUser({ req })) {
        return isOwnClinicStaffProfile({ req })
      }

      return false
    },
    create: ({ req }) => {
      // Platform staff can create or clinic staff can self-register
      if (isPlatformBasicUser({ req })) return true
      if (
        req.user?.collection === 'basicUsers' &&
        'userType' in req.user &&
        req.user.userType === 'clinic'
      )
        return true
      return false
    },
    update: isPlatformStaffOrSelf,
    delete: isPlatformBasicUser,
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
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Approved', value: 'approved' },
        { label: 'Rejected', value: 'rejected' },
      ],
      defaultValue: 'pending',
      required: true,
      admin: {
        description: 'Approval status for this clinic staff member',
      },
    },
  ],
  timestamps: true,
}
