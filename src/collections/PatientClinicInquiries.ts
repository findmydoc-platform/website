import type { CollectionConfig } from 'payload'

import { isPlatformBasicUser } from '@/access/isPlatformBasicUser'
import { stableIdBeforeChangeHook, stableIdField } from './common/stableIdField'

export const patientClinicInquiryStatusOptions = [
  { label: 'Submitted', value: 'submitted' },
  { label: 'In Review', value: 'in_review' },
  { label: 'Contacted', value: 'contacted' },
  { label: 'Closed', value: 'closed' },
  { label: 'Spam', value: 'spam' },
] as const

export const patientClinicInquiryNextStepOptions = [
  { label: 'Platform review', value: 'platform-review' },
  { label: 'Follow up with patient', value: 'patient-follow-up' },
  { label: 'Follow up with clinic', value: 'clinic-follow-up' },
  { label: 'No action needed', value: 'no-action' },
] as const

export const patientClinicInquirySourceOptions = [
  { label: 'Clinic profile', value: 'clinic_profile' },
  { label: 'Admin manual', value: 'admin_manual' },
  { label: 'CRM import', value: 'crm_import' },
  { label: 'API', value: 'api' },
] as const

export const patientClinicInquirySyncStatusOptions = [
  { label: 'Not configured', value: 'not_configured' },
  { label: 'Pending', value: 'pending' },
  { label: 'Synced', value: 'synced' },
  { label: 'Failed', value: 'failed' },
] as const

export const PatientClinicInquiries: CollectionConfig = {
  slug: 'patientClinicInquiries',
  labels: {
    singular: 'Clinic Contact Request',
    plural: 'Clinic Contact Requests',
  },
  admin: {
    group: 'Platform Management',
    useAsTitle: 'fullName',
    defaultColumns: ['fullName', 'clinic', 'status', 'email', 'createdAt'],
    description: 'Patient requests submitted from clinic profile pages',
  },
  access: {
    create: isPlatformBasicUser,
    read: isPlatformBasicUser,
    update: isPlatformBasicUser,
    delete: isPlatformBasicUser,
  },
  hooks: {
    beforeChange: [stableIdBeforeChangeHook],
  },
  fields: [
    stableIdField(),
    {
      name: 'clinic',
      type: 'relationship',
      relationTo: 'clinics',
      required: true,
      index: true,
      admin: {
        description: 'Clinic profile the request was sent from',
      },
    },
    {
      name: 'clinicNameSnapshot',
      type: 'text',
      required: true,
      admin: {
        description: 'Clinic name at submission time',
        readOnly: true,
      },
    },
    {
      name: 'patient',
      type: 'relationship',
      relationTo: 'patients',
      admin: {
        description: 'Patient account, when the request is linked to a signed-in patient',
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'fullName',
          type: 'text',
          required: true,
          admin: {
            description: 'Name entered by the requester',
            width: '50%',
          },
        },
        {
          name: 'email',
          type: 'email',
          required: true,
          index: true,
          admin: {
            description: 'Email address for follow-up',
            width: '50%',
          },
        },
      ],
    },
    {
      name: 'phoneNumber',
      type: 'text',
      required: true,
      admin: {
        description: 'Phone number for follow-up',
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'preferredDate',
          type: 'date',
          admin: {
            description: 'Requested appointment date, if provided',
            width: '50%',
          },
        },
        {
          name: 'preferredTime',
          type: 'text',
          admin: {
            description: 'Requested appointment time, if provided',
            width: '50%',
          },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'doctor',
          type: 'relationship',
          relationTo: 'doctors',
          admin: {
            description: 'Doctor selected on the clinic profile',
            width: '50%',
          },
        },
        {
          name: 'doctorNameSnapshot',
          type: 'text',
          admin: {
            description: 'Doctor name at submission time',
            readOnly: true,
            width: '50%',
          },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'treatment',
          type: 'relationship',
          relationTo: 'treatments',
          admin: {
            description: 'Treatment selected on the clinic profile',
            width: '50%',
          },
        },
        {
          name: 'treatmentNameSnapshot',
          type: 'text',
          admin: {
            description: 'Treatment name at submission time',
            readOnly: true,
            width: '50%',
          },
        },
      ],
    },
    {
      name: 'message',
      type: 'textarea',
      required: true,
      admin: {
        description: 'Message entered by the requester',
      },
    },
    {
      name: 'consent',
      type: 'group',
      admin: {
        description: 'Consent captured at submission time',
        readOnly: true,
      },
      fields: [
        {
          name: 'accepted',
          type: 'checkbox',
          required: true,
          defaultValue: false,
        },
        {
          name: 'acceptedAt',
          type: 'date',
        },
        {
          name: 'text',
          type: 'textarea',
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'status',
          type: 'select',
          required: true,
          defaultValue: 'submitted',
          options: [...patientClinicInquiryStatusOptions],
          admin: {
            description: 'Current handling status',
            width: '50%',
          },
        },
        {
          name: 'nextStep',
          type: 'select',
          defaultValue: 'platform-review',
          options: [...patientClinicInquiryNextStepOptions],
          admin: {
            description: 'Next operational step',
            width: '50%',
          },
        },
      ],
    },
    {
      name: 'assignedTo',
      type: 'relationship',
      relationTo: 'basicUsers',
      admin: {
        description: 'Platform user responsible for follow-up',
      },
      filterOptions: () => ({
        userType: { equals: 'platform' },
      }),
    },
    {
      name: 'source',
      type: 'select',
      required: true,
      defaultValue: 'clinic_profile',
      options: [...patientClinicInquirySourceOptions],
      admin: {
        description: 'Origin of this request',
        position: 'sidebar',
      },
    },
    {
      name: 'formUrl',
      type: 'text',
      required: true,
      admin: {
        description: 'URL where the request was submitted',
        position: 'sidebar',
      },
    },
    {
      name: 'sourceMeta',
      type: 'group',
      admin: {
        description: 'Request metadata',
        readOnly: true,
        position: 'sidebar',
      },
      fields: [
        { name: 'ip', type: 'text' },
        { name: 'userAgent', type: 'text' },
      ],
    },
    {
      name: 'syncStatus',
      type: 'select',
      defaultValue: 'not_configured',
      options: [...patientClinicInquirySyncStatusOptions],
      admin: {
        description: 'External CRM sync state',
        position: 'sidebar',
      },
    },
    {
      name: 'lastSyncAttemptAt',
      type: 'date',
      admin: {
        description: 'Most recent CRM sync attempt',
        position: 'sidebar',
      },
    },
    {
      name: 'lastSyncError',
      type: 'textarea',
      admin: {
        description: 'Latest CRM sync error, if any',
        position: 'sidebar',
      },
    },
    {
      name: 'externalReferences',
      type: 'array',
      admin: {
        description: 'CRM records linked to this inquiry',
      },
      fields: [
        {
          name: 'provider',
          type: 'select',
          required: true,
          options: [
            { label: 'HubSpot', value: 'hubspot' },
            { label: 'Salesforce', value: 'salesforce' },
            { label: 'Other', value: 'other' },
          ],
        },
        {
          name: 'objectType',
          type: 'text',
          required: true,
        },
        {
          name: 'externalId',
          type: 'text',
          required: true,
        },
        {
          name: 'externalUrl',
          type: 'text',
        },
        {
          name: 'syncedAt',
          type: 'date',
        },
      ],
    },
  ],
  timestamps: true,
}
