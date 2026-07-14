import type { CollectionConfig } from 'payload'
import { isClinicBasicUser, isOwnClinicStaffProfile } from '@/access/isClinicBasicUser'
import { isPlatformBasicUser } from '@/access/isPlatformBasicUser'
import { getUserAssignedClinicId } from '@/access/utils/getClinicAssignment'
import { platformOnlyFieldAccess } from '@/access/fieldAccess'

// Profile collection for Clinic Staff members
export const ClinicStaff: CollectionConfig = {
  slug: 'clinicStaff',
  auth: false,
  admin: {
    group: 'User Management',
    useAsTitle: 'user',
    defaultColumns: ['user', 'email', 'clinic', 'status'],
    description: 'Clinic staff profiles',
  },
  access: {
    read: async ({ req }) => {
      if (isPlatformBasicUser({ req })) return true

      // Clinic Staff: Can only see ClinicStaff from their own clinic
      if (isClinicBasicUser({ req })) {
        const assignedClinicId = await getUserAssignedClinicId(req.user, req.payload)
        if (!assignedClinicId) return false

        return {
          clinic: { equals: assignedClinicId },
        }
      }

      return false
    },
    create: () => false,
    update: ({ req }) => {
      if (isPlatformBasicUser({ req })) return true
      return isOwnClinicStaffProfile({ req })
    },
    delete: () => false,
  },
  fields: [
    {
      name: 'stableId',
      type: 'text',
      unique: true,
      index: true,
      access: {
        create: () => false,
        read: () => false,
        update: () => false,
      },
      admin: {
        hidden: true,
        disableListColumn: true,
      },
    },
    {
      name: 'supabaseUserId',
      label: 'Supabase User ID',
      type: 'text',
      unique: true,
      index: true,
      access: {
        create: () => false,
        read: () => false,
        update: () => false,
      },
      admin: {
        hidden: true,
        readOnly: true,
      },
    },
    {
      name: 'email',
      type: 'email',
      label: 'Email',
      access: {
        create: () => false,
        read: () => false,
        update: () => false,
      },
      admin: {
        hidden: true,
        readOnly: true,
      },
    },
    {
      name: 'firstName',
      type: 'text',
      label: 'First Name',
      access: {
        create: () => false,
        read: () => false,
        update: () => false,
      },
      admin: {
        hidden: true,
        readOnly: true,
      },
    },
    {
      name: 'lastName',
      type: 'text',
      label: 'Last Name',
      access: {
        create: () => false,
        read: () => false,
        update: () => false,
      },
      admin: {
        hidden: true,
        readOnly: true,
      },
    },
    {
      name: 'profileImage',
      type: 'upload',
      relationTo: 'userProfileMedia',
      access: {
        create: () => false,
        read: () => false,
        update: () => false,
      },
      admin: {
        hidden: true,
        readOnly: true,
      },
    },
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'basicUsers',
      required: true,
      unique: true,
      hasMany: false,
      access: {
        // Identity linkage controls authorization and may only be reassigned by Platform Staff.
        create: platformOnlyFieldAccess,
        update: platformOnlyFieldAccess,
      },
      admin: {
        position: 'sidebar',
        description: 'Login account for this staff member',
      },
      filterOptions: ({ relationTo: _relationTo, siblingData: _siblingData }) => {
        return {
          userType: { equals: 'clinic' },
        }
      },
    },
    {
      name: 'clinic',
      type: 'relationship',
      relationTo: 'clinics',
      required: false, // Allow staff registration without immediate clinic assignment (assigned by Platform staff)
      hasMany: false,
      access: {
        // Clinic assignment defines tenant access and may only be changed by Platform Staff.
        create: platformOnlyFieldAccess,
        update: platformOnlyFieldAccess,
      },
      admin: {
        position: 'sidebar',
        description: 'Clinic this staff member belongs to',
      },
      index: true,
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
      access: {
        // Only Platform Staff can change staff approval status
        create: platformOnlyFieldAccess,
        update: platformOnlyFieldAccess,
      },
      admin: {
        description: 'Staff approval status',
        condition: (data, siblingData, { user }) => {
          // Hide status field from non-platform users in admin UI
          return Boolean(user && user.collection === 'basicUsers' && user.userType === 'platform')
        },
      },
    },
  ],
  timestamps: true,
}
