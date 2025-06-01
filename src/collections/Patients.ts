import type { CollectionConfig } from \'payload\'

// This is the standalone authentication collection for Patients.
// It is visible in the Admin UI for management by Platform Staff.
export const Patients: CollectionConfig = {
  slug: \'patients\',
  auth: {
    // Patients use this collection for authentication via the custom strategy
    // Disable Payload\'s local strategy
    disableLocalStrategy: true,
    // Strategies configured globally
  },
  admin: {
    // Visible in the Admin UI
    hidden: false,
    group: \'User Management\',
    useAsTitle: \'email\',
    defaultColumns: [\'email\', \'firstName\', \'lastName\'],
  },
  access: {
    // TODO: Define specific access controls.
    // Patients should only access/modify their own record.
    // Platform Staff should have management access.
    read: () => true, // Placeholder
    create: () => true, // Placeholder - Signup handled via strategy?
    update: () => true, // Placeholder
    delete: () => true, // Placeholder - Restricted to Platform Staff?
  },
  fields: [
    {
      name: \'email\',
      type: \'email\',
      label: \'Email\',
      required: true,
      unique: true,
    },
    {
      name: \'supabaseUserId\',
      label: \'Supabase User ID\',
      type: \'text\',
      required: true,
      unique: true,
      admin: {
        readOnly: true,
        hidden: true,
      },
      index: true,
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
    // ... Add other patient-specific fields here (e.g., dateOfBirth, phone)
  ],
  timestamps: true,
}

