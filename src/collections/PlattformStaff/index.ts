import type { CollectionConfig } from 'payload'
import { isPlatformStaff, isPlatformStaffOrSelf } from '@/access/isStaff' // Import used access controls

// This is now a profile collection for Platform Staff members.
// It links to the hidden basicUsers collection for authentication details.
export const PlattformStaff: CollectionConfig = {
  slug: 'plattformStaff',
  auth: false, // Not an authentication collection itself
  admin: {
    group: 'Platform Management',
    useAsTitle: 'firstName',
    defaultColumns: ['firstName', 'lastName', 'email', 'role'],
  },
  access: {
    // Platform staff can manage all platform staff profiles
    // Each platform staff member can view/edit their own profile
    read: isPlatformStaff, // Only platform staff can read platform staff profiles
    create: isPlatformStaff, // Only platform staff can create platform staff profiles
    update: isPlatformStaffOrSelf, // Platform staff or self can update
    delete: isPlatformStaff, // Only platform staff can delete platform staff profiles
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
      // Prefix unused arguments with underscore to satisfy linter
      filterOptions: ({ relationTo: _relationTo, siblingData: _siblingData }) => {
        // When creating/editing PlattformStaff, only allow linking to basicUsers
        // where userType is 'platform'.
        return {
          userType: { equals: 'platform' },
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
      label: 'Email',
      required: true,
    },
    {
      name: 'role',
      type: 'select',
      label: 'Role',
      required: true,
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'Support', value: 'support' },
        { label: 'Content Manager', value: 'content-manager' },
      ],
      defaultValue: 'support',
    },
    {
      name: 'profileImage',
      type: 'upload',
      relationTo: 'media',
      required: false,
    },
  ],
  timestamps: true,
}
