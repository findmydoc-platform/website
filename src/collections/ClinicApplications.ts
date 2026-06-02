import { CollectionConfig, PayloadRequest } from 'payload'
import { isPlatformBasicUser } from '@/access/isPlatformBasicUser'

// Platform-controlled application intake for clinics.
// Public submissions are accepted only through /api/auth/register/clinic.
// Only platform staff can create/read/update/delete records directly.
// Approval workflow: platform sets status to approved; future hook will materialize real Clinic & user.

export const ClinicApplications: CollectionConfig = {
  slug: 'clinicApplications',
  admin: {
    useAsTitle: 'clinicName',
    group: 'Medical Network',
    defaultColumns: ['clinicName', 'status', 'contactEmail', 'clinicWebsite', 'createdAt'],
    description: 'New clinic applications awaiting review',
  },
  access: {
    create: isPlatformBasicUser, // public intake is handled by /api/auth/register/clinic
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
          admin: {
            description: 'First name of the main contact, if provided separately',
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
      name: 'contactRole',
      type: 'select',
      required: true,
      options: [
        { label: 'Medical Director', value: 'Medical Director' },
        { label: 'Clinic Management', value: 'Clinic Management' },
        { label: 'International Office', value: 'International Office' },
      ],
      admin: {
        description: 'Role of the main contact',
      },
    },
    {
      name: 'clinicWebsite',
      type: 'text',
      required: true,
      index: true,
      admin: {
        description: 'Official clinic website URL',
      },
      validate: (value: string | string[] | null | undefined) => {
        if (!value || typeof value !== 'string') {
          return 'Enter a valid clinic website URL.'
        }

        try {
          const url = new URL(value)

          if (!['http:', 'https:'].includes(url.protocol) || !url.hostname.includes('.')) {
            return 'Enter a valid clinic website URL.'
          }
        } catch {
          return 'Enter a valid clinic website URL.'
        }

        return true
      },
    },
    {
      name: 'medicalSpecialties',
      type: 'relationship',
      relationTo: 'medical-specialties',
      hasMany: true,
      required: true,
      admin: {
        description: 'Top-level medical specialty categories selected in the registration funnel',
      },
      filterOptions: () => ({
        parentSpecialty: {
          exists: false,
        },
      }),
      validate: (value: unknown) => {
        if (!Array.isArray(value) || value.length === 0) {
          return 'Select at least one medical specialty.'
        }

        return true
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
