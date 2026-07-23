import { CollectionConfig, PayloadRequest } from 'payload'
import { isPlatformStaff } from '@/access/isPlatformStaff'
import { computedOnlyFieldAccess } from '@/access/fieldAccess'
import { CLINIC_ONBOARDING_ERROR_CODES } from '@/features/clinicOnboarding/provisionClinicOnboarding'
import { provisionApprovedClinicApplication } from '@/hooks/clinicApplicationProvisioning'
import { clinicContactRoleOptions } from './common/selectionOptions'
import { clinicApplicationProvisioningErrorLabels } from './clinicApplications/provisioningLifecycle'

// Platform-controlled application intake for clinics.
// Public submissions are accepted only through /api/auth/register/clinic.
// Only platform staff can create/read/update/delete records directly.
// Approval workflow: platform sets status to approved; provisioning creates the pending clinic and initial staff access.

export const ClinicApplications: CollectionConfig = {
  slug: 'clinicApplications',
  admin: {
    useAsTitle: 'clinicName',
    group: 'Medical Network',
    defaultColumns: ['clinicName', 'status', 'provisioningStatus', 'contactEmail', 'createdAt'],
    description: 'New clinic applications awaiting review',
  },
  access: {
    create: isPlatformStaff, // public intake is handled by /api/auth/register/clinic
    read: isPlatformStaff, // only platform staff can view
    update: isPlatformStaff,
    delete: isPlatformStaff,
  },
  hooks: {
    afterChange: [provisionApprovedClinicApplication],
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
      options: clinicContactRoleOptions,
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
        description: 'Main specialties selected during registration',
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
      name: 'lifecycleGuidance',
      type: 'ui',
      admin: {
        components: {
          Field: '@/app/(payload)/components/ClinicApplicationLifecycle#ClinicApplicationLifecyclePanel',
        },
      },
    },
    {
      name: 'reviewNotes',
      type: 'textarea',
      admin: { description: 'Notes about this application' },
      access: {
        update: ({ req }: { req: PayloadRequest }) => {
          const u = req.user
          return Boolean(u && u.collection === 'platformStaff')
        },
      },
    },
    {
      name: 'provisioningStatus',
      type: 'select',
      defaultValue: 'not_started',
      options: [
        { label: 'Not started', value: 'not_started' },
        { label: 'Failed', value: 'failed' },
        { label: 'Completed', value: 'completed' },
      ],
      access: {
        create: computedOnlyFieldAccess,
        update: computedOnlyFieldAccess,
      },
      admin: {
        description: 'Provisioning result; saving a failed approved application retries the process',
        position: 'sidebar',
        readOnly: true,
      },
    },
    {
      name: 'provisioningErrorCode',
      type: 'select',
      options: CLINIC_ONBOARDING_ERROR_CODES.map((value) => ({
        label: clinicApplicationProvisioningErrorLabels[value],
        value,
      })),
      access: {
        create: computedOnlyFieldAccess,
        update: computedOnlyFieldAccess,
      },
      admin: {
        description: 'Stable failure category for retry and support',
        position: 'sidebar',
        readOnly: true,
      },
    },
    {
      name: 'linkedRecords',
      type: 'group',
      label: 'Created records',
      access: {
        create: computedOnlyFieldAccess,
        update: computedOnlyFieldAccess,
      },
      admin: {
        description: 'Clinic and staff records created after approval',
        readOnly: true,
        condition: (data) => data?.status !== 'submitted',
      },
      fields: [
        { name: 'clinic', type: 'relationship', relationTo: 'clinics' },
        { name: 'clinicStaff', type: 'relationship', relationTo: 'clinicStaff' },
        { name: 'processedAt', type: 'date' },
      ],
    },
    {
      name: 'sourceMeta',
      type: 'group',
      admin: { description: 'Request IP address and browser details', readOnly: true, position: 'sidebar' },
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
