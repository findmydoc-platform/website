import type { CollectionConfig } from 'payload'
import { authenticated } from '../../access/authenticated' // Keep for now, may need adjustment

// This is now a profile collection, not an auth collection
export const PlattformStaff: CollectionConfig = {
  slug: 'plattformStaff',
  // Removed auth: true and the auth block
  auth: false,
  admin: {
    group: 'Platform Management',
    // Keep email for display, but uniqueness enforced by BasicUsers
    useAsTitle: 'email',
    defaultColumns: ['email', 'firstName', 'lastName', 'role'],
  },
  access: {
    // TODO: Review access controls. Platform staff should likely manage these.
    // For now, keeping authenticated, but this needs refinement based on roles.
    admin: authenticated,
    create: authenticated, // Should likely be restricted
    delete: authenticated, // Should likely be restricted
    read: authenticated,
    update: authenticated, // Should likely be restricted to self or admin
  },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'basicUsers', // Link to the hidden auth user
      required: true,
      unique: true, // Each profile should link to one unique basic user
      hasMany: false,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'email',
      type: 'email',
      required: true,
      label: 'Email',
      // Removed unique: true - uniqueness enforced by basicUsers.email
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
      name: 'role',
      type: 'select',
      label: 'Role',
      required: true,
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'Support', value: 'support' }, // Example roles
        { label: 'Content Manager', value: 'content-manager' },
      ],
      defaultValue: 'support',
      // Removed saveToJWT: true - JWT claims come from basicUsers via hook
    },
    // Removed userCollection field
    {
      name: 'profileImage',
      type: 'upload',
      relationTo: 'media',
      required: false,
    },
    // Removed supabaseId field - it belongs in basicUsers
  ],
  timestamps: true,
}

