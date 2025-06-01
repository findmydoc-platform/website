import type { CollectionConfig } from 'payload'
import { isStaff, isClinicStaff, isPlatformStaff, isOwnClinicStaffProfile, isPlatformStaffOrSelf } from '@/access/isStaff'

// This is the profile collection for Clinic Staff members.
// It links to the hidden basicUsers collection for authentication details.
export const ClinicStaff: CollectionConfig = {
  slug: 'clinicStaff',
  auth: false, // Not an authentication collection itself
  admin: {
    group: 'Clinic Management',
    useAsTitle: 'firstName',
    defaultColumns: ['firstName', 'lastName', 'email'],
  },
  access: {
    // Platform staff can manage all clinic staff profiles
    // Clinic staff can only view/edit their own profile
    read: ({ req }) => {
      // Platform staff can read all clinic staff profiles
      if (isPlatformStaff({ req })) return true
      
      // Clinic staff can only read their own profile
      if (isClinicStaff({ req })) {
        return isOwnClinicStaffProfile({ req })
      }
      
      // No access for others
      return false
    },
    create: isPlatformStaff, // Only platform staff can create clinic staff profiles
    update: isPlatformStaffOrSelf, // Platform staff or self can update
    delete: isPlatformStaff, // Only platform staff can delete clinic staff profiles
  },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'basicUsers', // Link to the hidden auth user
      required: true,
      unique: true, // Each profile links to one unique basic user
      hasMany: false,
      admin: {
        position: 'sidebar',
      },
      filterOptions: ({ relationTo, siblingData }) => {
        // When creating/editing ClinicStaff, only allow linking to basicUsers
        // where userType is 'clinic'.
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
      label: 'Contact Email', // Optional contact email, primary is in basicUsers
      required: false,
    },
    // ... Add other clinic-staff-specific fields here
  ],
  timestamps: true,
}
