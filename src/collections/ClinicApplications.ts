import { CollectionConfig } from 'payload'
import { isPlatformBasicUser } from '@/access/isPlatformBasicUser'

// Basic public -> platform controlled application intake for clinics.
// Public can create, only platform staff can read/update/delete.
// Approval workflow: platform sets status to approved; future hook will materialize real Clinic & user.

export const ClinicApplications: CollectionConfig = {
  slug: 'clinicApplications',
  admin: {
    useAsTitle: 'clinicName',
    group: 'Medical Network',
    defaultColumns: ['clinicName', 'status', 'contactEmail', 'createdAt'],
    description: 'Inbound clinic registration submissions awaiting review',
  },
  access: {
    create: () => true, // public intake
    read: isPlatformBasicUser, // only platform staff can view
    update: isPlatformBasicUser,
    delete: isPlatformBasicUser,
  },
  fields: [
    {
      name: 'clinicName',
      type: 'text',
      required: true,
      index: true,
    },
    {
      type: 'row',
      fields: [
        { name: 'contactFirstName', type: 'text', required: true },
        { name: 'contactLastName', type: 'text', required: true },
      ],
    },
    { name: 'contactEmail', type: 'email', required: true, index: true },
    { name: 'contactPhone', type: 'text' },
    {
      name: 'address',
      type: 'group',
      fields: [
        { name: 'street', type: 'text', required: true },
        { name: 'houseNumber', type: 'text', required: true },
        { name: 'zipCode', type: 'number', required: true },
        { name: 'city', type: 'text', required: true },
        { name: 'country', type: 'text', required: true, defaultValue: 'Turkey' },
      ],
    },
    { name: 'additionalNotes', type: 'textarea' },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'submitted',
      required: true,
      options: [
        { label: 'Submitted', value: 'submitted' },
        { label: 'Approved', value: 'approved' },
        { label: 'Rejected', value: 'rejected' },
      ],
      admin: { description: 'Review lifecycle status' },
    },
    {
      name: 'reviewNotes',
      type: 'textarea',
      admin: { description: 'Internal reviewer notes' },
      access: {
        update: ({ req }) => {
          const u: any = req.user
          return Boolean(u && u.collection === 'basicUsers' && u.userType === 'platform')
        },
      },
    },
    {
      name: 'linkedRecords',
      type: 'group',
      admin: {
        description: 'Traceability: records linked to this application',
        condition: (data) => data?.status !== 'submitted',
      },
      fields: [
        { name: 'clinic', type: 'relationship', relationTo: 'clinics' },
        { name: 'basicUser', type: 'relationship', relationTo: 'basicUsers' },
        { name: 'clinicStaff', type: 'relationship', relationTo: 'clinicStaff' },
        { name: 'processedAt', type: 'date' },
      ],
    },
    {
      name: 'sourceMeta',
      type: 'group',
      admin: { description: 'Captured metadata', readOnly: true, position: 'sidebar' },
      fields: [
        { name: 'ip', type: 'text' },
        { name: 'userAgent', type: 'text' },
      ],
    },
  ],
  timestamps: true,
}
