import type { CollectionConfig } from 'payload'

import { authenticated } from '../../access/authenticated'

export const Users: CollectionConfig = {
  slug: 'users',
  access: {
    admin: authenticated,
    create: authenticated,
    delete: authenticated,
    read: authenticated,
    update: authenticated,
  },
  admin: {
    defaultColumns: ['firstname', 'email'],
    useAsTitle: 'firstname',
  },
  auth: true,
  fields: [
    {
      name: 'firstname',
      type: 'text',
      required: true,
    },
    {
      name: 'lastname',
      type: 'text',
      required: true,
    },
    {
      name: 'username',
      type: 'text',
      unique: true,
      required: true,
    },
    {
      name: 'email',
      type: 'email',
      unique: true,
      required: true,
    },
    {
      name: 'phone',
      type: 'text',
      required: false,
    },
    {
      name: 'street',
      type: 'text',
      required: false,
    },
    {
      name: 'city',
      type: 'text',
      required: false,
    },
    {
      name: 'country',
      type: 'text',
      required: false,
    },
  ],
  timestamps: true,
}
