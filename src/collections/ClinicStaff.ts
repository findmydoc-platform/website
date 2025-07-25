import type { CollectionConfig } from 'payload'
import { isClinicBasicUser, isOwnClinicStaffProfile } from '@/access/isClinicBasicUser'
import { isPlatformBasicUser, isPlatformStaffOrSelf } from '@/access/isPlatformBasicUser'
import { deleteClinicStaffUserHook } from '@/hooks/userDeletion'

// Profile collection for Clinic Staff members
export const ClinicStaff: CollectionConfig = {
  slug: 'clinicStaff',
  auth: false,
  admin: {
    group: 'User Management',
    useAsTitle: 'firstName',
    defaultColumns: ['firstName', 'lastName', 'email', 'status'],
    description:
      'Profiles for staff working at a clinic who handle day-to-day operations and patient care',
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
  hooks: {
    beforeDelete: [deleteClinicStaffUserHook],
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
        description: 'Select the login account linked to this staff member',
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
      admin: {
        description: 'Optional email address for contacting this staff member',
      },
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
