import type { CollectionConfig } from 'payload'
import { authenticated } from '../access/authenticated'

export const ClinicStaff: CollectionConfig = {
  slug: 'clinicStaff',
  admin: {
    group: 'Medical Network',
    useAsTitle: 'email',
    defaultColumns: ['email', 'firstName', 'lastName', 'role', 'isPrimary'],
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
      label: 'Email',
      unique: true,
      admin: {
        description: 'Email address of the clinic staff member',
      },
    },
    {
      name: 'firstName',
      type: 'text',
      label: 'First Name',
      required: true,
      admin: {
        description: 'First name of the clinic staff member',
      },
    },
    {
      name: 'lastName',
      type: 'text',
      label: 'Last Name',
      required: true,
      admin: {
        description: 'Last name of the clinic staff member',
      },
    },
    {
      name: 'role',
      type: 'select',
      label: 'Role',
      required: true,
      options: [
        { label: 'Clinic Admin', value: 'clinic_admin' },
        { label: 'Clinic Manager', value: 'clinic_manager' },
        { label: 'Clinic Staff', value: 'clinic_staff' },
        { label: 'Receptionist', value: 'receptionist' },
      ],
      defaultValue: 'clinic_staff',
      admin: {
        description: 'Role of the staff member within the clinic',
      },
    },
    {
      name: 'clinics',
      type: 'relationship',
      relationTo: 'clinics',
      hasMany: true,
      required: false,
      admin: {
        description: 'Clinics this staff member is associated with',
      },
    },
    {
      name: 'isPrimary',
      type: 'checkbox',
      label: 'Is Primary Contact',
      defaultValue: false,
      admin: {
        description: 'Whether this staff member is the primary contact for their clinic(s)',
      },
    },
    {
      name: 'profileImage',
      type: 'upload',
      relationTo: 'media',
      required: false,
      admin: {
        description: 'Profile image of the clinic staff member',
      },
    },
    {
      name: 'authId',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        readOnly: true,
        hidden: true,
        description: 'External authentication system identifier',
      },
    },
  ],
  timestamps: true,
}