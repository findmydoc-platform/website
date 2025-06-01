import type { CollectionConfig } from \'payload\'

// This is the profile collection for Clinic Staff members.
// It links to the hidden basicUsers collection for authentication details.
export const ClinicStaff: CollectionConfig = {
  slug: \'clinicStaff\',
  auth: false, // Not an authentication collection itself
  admin: {
    group: \'Clinic Management\',
    useAsTitle: \'firstName\',
    defaultColumns: [\'firstName\', \'lastName\', \'email\'], // Add email if relevant
  },
  access: {
    // TODO: Define specific access controls.
    // Platform Staff should likely manage these.
    // Clinic Staff might only update their own profile.
    read: () => true, // Placeholder
    create: () => true, // Placeholder - Should likely be restricted
    update: () => true, // Placeholder - Should likely be restricted
    delete: () => true, // Placeholder - Should likely be restricted
  },
  fields: [
    {
      name: \'user\',
      type: \'relationship\',
      relationTo: \'basicUsers\', // Link to the hidden auth user
      required: true,
      unique: true, // Each profile links to one unique basic user
      hasMany: false,
      admin: {
        position: \'sidebar\',
        // Ensure this field is filterable if needed for access control
      },
      filterOptions: ({ relationTo, siblingData }) => {
        // When creating/editing ClinicStaff, only allow linking to basicUsers
        // where userType is \'clinic\'.
        return {
          userType: { equals: \'clinic\' },
        }
      },
    },
    {
      name: \'firstName\',
      type: \'text\',
      label: \'First Name\',
      required: true,
    },
    {
      name: \'lastName\',
      type: \'text\',
      label: \'Last Name\',
      required: true,
    },
    {
      name: \'email\',
      type: \'email\',
      label: \'Contact Email\', // Optional contact email, primary is in basicUsers
      required: false,
    },
    // ... Add other clinic-staff-specific fields here (e.g., job title, associated clinic relationship)
  ],
  timestamps: true,
}

