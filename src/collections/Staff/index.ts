import type { CollectionConfig } from 'payload'
import { authenticated } from '../../access/authenticated'
import { createSupabaseStrategy } from '../../auth/supabaseStrategy'

export const Staff: CollectionConfig = {
  slug: 'staff',
  access: {
    admin: authenticated,
    create: authenticated,
    delete: authenticated,
    read: authenticated,
    update: authenticated,
  },
  admin: {
    defaultColumns: ['name', 'email', 'supabaseId', 'roles'],
    useAsTitle: 'name',
  },
  auth: {
    disableLocalStrategy: true,
    strategies: [createSupabaseStrategy({ collection: 'staff', defaultRole: 'admin' })],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
    },
    {
      name: 'email',
      type: 'email',
      unique: true,
    },
    {
      name: 'supabaseId',
      type: 'text',
      unique: true,
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'roles',
      type: 'select',
      hasMany: true,
      saveToJWT: true,
      options: [
        {
          label: 'Admin',
          value: 'admin',
        },
        {
          label: 'Editor',
          value: 'editor',
        },
        {
          label: 'CustomerSupport',
          value: 'customerSupport',
        },
      ],
    },
  ],
  timestamps: true,
}
