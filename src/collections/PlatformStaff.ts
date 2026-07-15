import type { CollectionConfig } from 'payload'
import { isPlatformBasicUser } from '@/access/isPlatformBasicUser'
import { enforceSupabaseIdentityInvariant } from '@/auth/hooks/enforceSupabaseIdentityInvariant'
import { supabaseStrategy } from '@/auth/strategies/supabaseStrategy'
import { guardPlatformStaffRoleChange } from './PlatformStaff/hooks/guardRoleChange'
import { revalidatePlatformAuthorPosts } from './PlatformStaff/hooks/revalidatePlatformAuthorPosts'
import { stableIdBeforeChangeHook, stableIdField } from './common/stableIdField'

// Direct authentication principal for platform operations and Payload Admin.
export const PlatformStaff: CollectionConfig = {
  slug: 'platformStaff',
  auth: {
    useSessions: false,
    disableLocalStrategy: true,
    strategies: [supabaseStrategy],
  },
  admin: {
    group: 'User Management',
    useAsTitle: 'email',
    defaultColumns: ['email', 'firstName', 'lastName', 'role'],
    description: 'Platform staff authentication principals',
  },
  access: {
    read: isPlatformBasicUser,
    create: () => false,
    update: isPlatformBasicUser,
    delete: () => false,
  },
  hooks: {
    afterChange: [revalidatePlatformAuthorPosts],
    beforeChange: [stableIdBeforeChangeHook, enforceSupabaseIdentityInvariant, guardPlatformStaffRoleChange],
  },
  fields: [
    stableIdField(),
    {
      name: 'supabaseUserId',
      label: 'Supabase User ID',
      type: 'text',
      unique: true,
      index: true,
      access: {
        create: () => false,
        read: () => false,
        update: () => false,
      },
      admin: {
        hidden: true,
        readOnly: true,
      },
    },
    {
      name: 'email',
      type: 'email',
      label: 'Email',
      access: {
        create: () => false,
        read: () => false,
        update: () => false,
      },
      admin: {
        hidden: true,
        readOnly: true,
      },
    },
    {
      name: 'firstName',
      type: 'text',
      label: 'First Name',
      access: {
        create: () => false,
        read: () => false,
        update: () => false,
      },
      admin: {
        hidden: true,
        readOnly: true,
      },
    },
    {
      name: 'lastName',
      type: 'text',
      label: 'Last Name',
      access: {
        create: () => false,
        read: () => false,
        update: () => false,
      },
      admin: {
        hidden: true,
        readOnly: true,
      },
    },
    {
      name: 'profileImage',
      type: 'upload',
      relationTo: 'userProfileMedia',
      access: {
        create: () => false,
        read: () => false,
        update: () => false,
      },
      admin: {
        hidden: true,
        readOnly: true,
      },
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
      admin: {
        description: 'Choose the access level for this staff member',
      },
    },
  ],
  timestamps: true,
}
