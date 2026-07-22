import type { CollectionConfig } from 'payload'
import { isClinicStaff, isOwnClinicStaffProfile } from '@/access/isClinicStaff'
import { enforceSupabaseIdentityInvariant } from '@/auth/hooks/enforceSupabaseIdentityInvariant'
import { isPlatformStaff } from '@/access/isPlatformStaff'
import { getUserAssignedClinicId } from '@/access/utils/getClinicAssignment'
import { platformOnlyFieldAccess, staffProfileFieldReadAccess } from '@/access/fieldAccess'
import { synchronizeClinicStaffAuthState, validateClinicStaffStatusTransition } from '@/hooks/clinicStaffLifecycle'
import { beforeChangeImmutableField } from '@/hooks/immutability'

// Direct authentication principal for clinic dashboard and API access, never Payload Admin.
export const ClinicStaff: CollectionConfig = {
  slug: 'clinicStaff',
  auth: {
    useSessions: false,
    disableLocalStrategy: true,
  },
  admin: {
    group: 'User Management',
    useAsTitle: 'email',
    defaultColumns: ['email', 'clinic', 'status', 'authSync.status'],
    description: 'Clinic staff authentication principals',
    components: {
      beforeList: ['@/app/(payload)/components/AdminNotice/ClinicStaffAdminGuidance#ClinicStaffAdminGuidance'],
    },
  },
  access: {
    read: async ({ req }) => {
      if (isPlatformStaff({ req })) return true

      // Clinic Staff: Can only see ClinicStaff from their own clinic
      if (isClinicStaff({ req })) {
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
      if (isPlatformStaff({ req })) return true
      return isOwnClinicStaffProfile({ req })
    },
    delete: () => false,
  },
  hooks: {
    beforeChange: [
      validateClinicStaffStatusTransition,
      beforeChangeImmutableField({ field: 'onboardingKey', message: 'onboardingKey cannot be changed once set' }),
      enforceSupabaseIdentityInvariant,
    ],
    afterChange: [synchronizeClinicStaffAuthState],
  },
  fields: [
    {
      name: 'provisioningGuidance',
      type: 'ui',
      admin: {
        components: {
          Field: '@/app/(payload)/components/AdminNotice/ClinicStaffAdminGuidance#ClinicStaffAdminGuidance',
        },
      },
    },
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
      name: 'onboardingKey',
      type: 'text',
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
      name: 'email',
      type: 'email',
      label: 'Email',
      access: {
        create: () => false,
        read: staffProfileFieldReadAccess,
        update: () => false,
      },
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'firstName',
      type: 'text',
      label: 'First Name',
      access: {
        create: () => false,
        read: staffProfileFieldReadAccess,
        update: () => false,
      },
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'lastName',
      type: 'text',
      label: 'Last Name',
      access: {
        create: () => false,
        read: staffProfileFieldReadAccess,
        update: () => false,
      },
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'profileImage',
      type: 'upload',
      relationTo: 'userProfileMedia',
      access: {
        create: () => false,
        read: staffProfileFieldReadAccess,
        update: () => false,
      },
      admin: {
        readOnly: true,
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
        { label: 'Disabled', value: 'disabled' },
        { label: 'Offboarded', value: 'offboarded' },
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
          return Boolean(user && user.collection === 'platformStaff')
        },
      },
    },
    {
      name: 'authSync',
      type: 'group',
      access: {
        create: () => false,
        read: platformOnlyFieldAccess,
        update: () => false,
      },
      admin: {
        description: 'Current consistency between this principal and Supabase Auth',
        position: 'sidebar',
        readOnly: true,
      },
      fields: [
        {
          name: 'status',
          type: 'select',
          defaultValue: 'pending',
          options: [
            { label: 'Pending', value: 'pending' },
            { label: 'Synced', value: 'synced' },
            { label: 'Failed', value: 'failed' },
            { label: 'Deleted', value: 'deleted' },
          ],
        },
        {
          name: 'errorCode',
          type: 'select',
          options: [
            { label: 'Missing identity', value: 'missing_identity' },
            { label: 'Account update failed', value: 'account_update_failed' },
            { label: 'Account deletion failed', value: 'account_delete_failed' },
          ],
        },
      ],
    },
  ],
  timestamps: true,
}
