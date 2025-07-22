import type { CollectionConfig } from 'payload'
import { isClinicBasicUser } from '@/access/isClinicBasicUser'
import { isPlatformBasicUser } from '@/access/isPlatformBasicUser'
import { getUserAssignedClinicId } from '@/access/utils/getClinicAssignment'

// Profile collection for Clinic Staff members
export const ClinicStaff: CollectionConfig = {
  slug: 'clinicStaff',
  auth: false,
  admin: {
    group: 'User Management',
    useAsTitle: 'firstName',
    defaultColumns: ['firstName', 'lastName', 'email', 'clinic', 'status'],
    description: 'Profiles for staff working at a clinic who handle day-to-day operations and patient care',
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
    create: isPlatformBasicUser,
    update: isPlatformBasicUser,
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
        description: 'Select the login account linked to this staff member',
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
      admin: {
        position: 'sidebar',
        description: 'The clinic this staff member belongs to',
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
