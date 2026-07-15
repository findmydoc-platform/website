import type { CollectionConfig } from 'payload'
import { stableIdField } from '../common/stableIdField'

// Temporary, fully locked legacy data retained until the separate contract migration.
export const BasicUsers: CollectionConfig = {
  slug: 'basicUsers',
  admin: {
    hidden: true,
  },
  access: {
    read: () => false,
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    stableIdField(),
    {
      name: 'supabaseUserId',
      label: 'Supabase User ID',
      type: 'text',
      required: false,
      unique: true,
      admin: {
        readOnly: true,
        hidden: true,
      },
      index: true,
    },
    {
      type: 'row',
      fields: [
        {
          name: 'firstName',
          type: 'text',
          label: 'First Name',
          required: true,
          admin: {
            width: '50%',
            description: 'Given name',
          },
        },
        {
          name: 'lastName',
          type: 'text',
          label: 'Last Name',
          required: true,
          admin: {
            width: '50%',
            description: 'Family name',
          },
        },
      ],
    },
    {
      name: 'email',
      type: 'email',
      label: 'Email',
      required: true,
      unique: true,
      admin: {
        description: 'Email used to sign in',
      },
    },
    {
      name: 'userType',
      label: 'User Type',
      type: 'select',
      required: true,
      options: [
        { label: 'Clinic Staff', value: 'clinic' },
        { label: 'Platform Staff', value: 'platform' },
      ],
      admin: {
        description: 'Choose clinic staff or platform staff',
      },
    },
    {
      name: 'profileImage',
      type: 'upload',
      relationTo: 'userProfileMedia',
      required: false,
      admin: {
        description: 'Admin profile photo',
      },
    },
  ],
  timestamps: true,
}
