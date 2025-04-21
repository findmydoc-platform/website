import type { CollectionConfig } from 'payload'
import { authenticated } from '../../access/authenticated'
import { createSupabaseStrategy } from '../../auth/supabaseStrategy'

export const PlattformStaff: CollectionConfig = {
  slug: 'plattformStaff',
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
    strategies: [createSupabaseStrategy({ collection: 'plattformStaff', defaultRole: 'admin' })],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'email',
      type: 'email',
      unique: true,
      required: true,
    },
    {
      name: 'supabaseId',
      type: 'text',
      required: true,
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
      required: true,
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
