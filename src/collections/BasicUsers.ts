import type { CollectionConfig } from \'payload\'

// This is the hidden collection used for authenticating Clinic and Platform Staff
// It links to the Supabase user and determines the staff type.
export const BasicUsers: CollectionConfig = {
  slug: \'basicUsers\',
  auth: {
    // Use this collection for admin authentication
    // Disable Payload\'s local strategy, rely on custom Supabase strategy
    disableLocalStrategy: true,
    // Strategies will be configured globally in payload.config.ts
    // or potentially here if needed, but global is often cleaner
  },
  admin: {
    // Hide this collection from the Admin UI
    hidden: true,
    // Use email for display if ever needed internally
    useAsTitle: \'email\',
  },
  access: {
    // Access should be highly restricted, likely only system/admin
    // Define specific access controls later
    read: () => false, // Example: No direct read access via API
    create: () => false,
    update: () => false,
    delete: () => false,
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
        // Hide from admin UI (though collection is hidden anyway)
        hidden: true,
      },
      index: true,
    },
    {
      name: \'userType\',
      label: \'User Type\',
      type: \'select\',
      required: true,
      options: [
        { label: \'Clinic Staff\', value: \'clinic\' },
        { label: \'Platform Staff\', value: \'platform\' },
      ],
      admin: {
        readOnly: true, // Should be set by the auth strategy
      },
      // Save to JWT so the auth strategy/access controls can use it
      // Note: The Supabase hook should be the primary source for JWT claim,
      // but saving here can be useful for Payload internal checks if needed.
      // Reconsider if this is truly needed vs relying solely on JWT from hook.
      // saveToJWT: true, 
    },
  ],
  timestamps: true,
}

