import { CollectionConfig, PayloadRequest } from 'payload'
import { isPlatformBasicUser } from '@/access/isPlatformBasicUser'

// Basic public -> platform controlled application intake for clinics.
// Public can create, only platform staff can read/update/delete.
// Approval workflow: platform sets status to approved; future hook will materialize real Clinic & user.

export const ClinicApplications: CollectionConfig = {
  slug: 'clinicApplications',
  admin: {
    useAsTitle: 'clinicName',
    group: 'Medical Network',
    defaultColumns: ['clinicName', 'status', 'contactEmail', 'websiteOrPublicProfile', 'createdAt'],
    description: 'New clinic applications awaiting review',
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
      admin: {
        description: 'Official clinic name',
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'contactFirstName',
          type: 'text',
          required: true,
          admin: {
            description: 'First name of the main contact',
            width: '50%',
          },
        },
        {
          name: 'contactLastName',
          type: 'text',
          required: true,
          admin: {
            description: 'Last name of the main contact',
            width: '50%',
          },
        },
      ],
    },
    {
      name: 'contactEmail',
      type: 'email',
      required: true,
      index: true,
      admin: {
        description: 'Email we use to contact the clinic',
      },
    },
    {
      name: 'contactPhone',
      type: 'text',
      admin: {
        description: 'Phone number with country code',
      },
    },
    {
      name: 'websiteOrPublicProfile',
      type: 'text',
      index: true,
      admin: {
        description: 'Clinic website or public profile URL',
      },
      validate: (value: string | string[] | null | undefined) => {
        if (!value || typeof value !== 'string') {
          return true
        }

        try {
          const url = new URL(value)

          if (!['http:', 'https:'].includes(url.protocol) || !url.hostname.includes('.')) {
            return 'Enter a valid website or public profile URL.'
          }
        } catch {
          return 'Enter a valid website or public profile URL.'
        }

        return true
      },
    },
    {
      name: 'address',
      type: 'group',
      admin: {
        description: 'Clinic address',
      },
      fields: [
        {
          name: 'street',
          type: 'text',
          required: true,
          admin: {
            description: 'Street name',
          },
        },
        {
          name: 'houseNumber',
          type: 'text',
          required: true,
          admin: {
            description: 'Building or suite number',
          },
        },
        {
          name: 'zipCode',
          type: 'number',
          required: true,
          admin: {
            description: 'Postal code',
          },
        },
        {
          name: 'city',
          type: 'text',
          required: true,
          admin: {
            description: 'City name',
          },
        },
        {
          name: 'country',
          type: 'text',
          required: true,
          defaultValue: 'Turkey',
          admin: {
            description: 'Country',
          },
        },
      ],
    },
    {
      name: 'additionalNotes',
      type: 'textarea',
      admin: {
        description: 'Anything else we should know about the clinic',
      },
    },
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
      admin: { description: 'Application review status' },
    },
    {
      name: 'reviewNotes',
      type: 'textarea',
      admin: { description: 'Notes about this application' },
      access: {
        update: ({ req }: { req: PayloadRequest }) => {
          const u = req.user
          return Boolean(u && u.collection === 'basicUsers' && u.userType === 'platform')
        },
      },
    },
    {
      name: 'linkedRecords',
      type: 'group',
      label: 'Created clinic records',
      admin: {
        description: 'Clinic, user, and staff records created from this application',
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
      admin: { description: 'IP address and browser info', readOnly: true, position: 'sidebar' },
      fields: [
        { name: 'ip', type: 'text' },
        { name: 'userAgent', type: 'text' },
      ],
    },
    {
      name: 'privacyNotice',
      type: 'group',
      admin: { description: 'Privacy notice text', readOnly: true, position: 'sidebar' },
      fields: [
        { name: 'acknowledgedAt', type: 'date', admin: { readOnly: true } },
        { name: 'url', type: 'text', admin: { readOnly: true } },
      ],
    },
  ],
  timestamps: true,
}
