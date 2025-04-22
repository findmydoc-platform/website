import type { CollectionConfig } from 'payload'
import { authenticated } from '../../access/authenticated'
import { createSupabaseStrategy } from '../../auth/supabaseStrategy'

export const PlattformStaff: CollectionConfig = {
  slug: 'plattformStaff',
  auth: {
    disableLocalStrategy: true,
    strategies: [createSupabaseStrategy({ collection: 'plattformStaff', defaultRole: 'admin' })],
  },
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'firstName', 'lastName', 'role'],
  },
  access: {
    admin: authenticated,
    create: authenticated,
    delete: authenticated,
    read: authenticated,
    update: authenticated,
  },
  fields: [
    {
      name: 'email',
      type: 'email',
      required: true,
      unique: true,
    },
    {
      name: 'firstName',
      type: 'text',
      required: true,
    },
    {
      name: 'lastName',
      type: 'text',
      required: true,
    },
    {
      name: 'role',
      type: 'select',
      required: true,
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'User', value: 'user' },
      ],
      defaultValue: 'user',
      saveToJWT: true,
    },
    {
      name: 'profileImage',
      type: 'upload',
      relationTo: 'media',
      required: false,
    },
    {
      name: 'supabaseId',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        readOnly: true,
        hidden: true,
      },
    },
  ],
  timestamps: true,
}
