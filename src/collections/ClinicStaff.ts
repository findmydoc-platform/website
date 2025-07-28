import type { CollectionConfig } from 'payload'
import { isClinicBasicUser, isOwnClinicStaffProfile } from '@/access/isClinicBasicUser'
import { isPlatformBasicUser, isPlatformStaffOrSelf } from '@/access/isPlatformBasicUser'
import { deleteClinicStaffUserHook } from '@/hooks/userDeletion'
import { createBasicUserForClinicStaffHook, cleanupClinicStaffTempPasswordHook } from '@/hooks/syncUserWithSupabase'

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
    beforeChange: [createBasicUserForClinicStaffHook],
    afterChange: [cleanupClinicStaffTempPasswordHook],
    beforeDelete: [deleteClinicStaffUserHook],
  },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'basicUsers',
      required: false, // Made optional since hook will create it
      unique: true,
      hasMany: false,
      admin: {
        position: 'sidebar',
        description: 'Login account linked to this staff member (created automatically)',
        readOnly: true, // Make read-only since hook manages this
        hidden: true, // Hide from UI since it's auto-created
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
      required: true, // Made required since this is used to create the user account
      unique: true, // Made unique to prevent duplicate accounts
      admin: {
        description: 'Email address for this staff member (used for login account creation)',
      },
    },
    {
      name: 'tempPassword',
      type: 'text',
      label: 'Temporary Password',
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'Temporary password for the new user account. Share this securely with the user.',
        condition: (data) => !!data.tempPassword, // Only show when it exists
      },
      access: {
        read: ({ req }) =>
          Boolean(req.user && req.user.collection === 'basicUsers' && req.user.userType === 'platform'),
        create: () => false, // Only set by hooks
        update: () => false, // Only set by hooks
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
