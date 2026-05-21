import type { CollectionBeforeChangeHook, CollectionConfig } from 'payload'

import { isPlatformBasicUser } from '@/access/isPlatformBasicUser'

export const patientClinicInquiryStatusOptions = [
  { label: 'Submitted', value: 'submitted' },
  { label: 'In Review', value: 'in_review' },
  { label: 'Contacted', value: 'contacted' },
  { label: 'Closed', value: 'closed' },
  { label: 'Spam', value: 'spam' },
] as const

const submissionEvidenceFields = ['consent', 'formUrl', 'sourceMeta'] as const

function normalizeEvidenceValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(normalizeEvidenceValue)

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, nestedValue]) => nestedValue !== undefined)
        .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
        .map(([key, nestedValue]) => [key, normalizeEvidenceValue(nestedValue)]),
    )
  }

  return value
}

function evidenceValuesMatch(left: unknown, right: unknown): boolean {
  return JSON.stringify(normalizeEvidenceValue(left)) === JSON.stringify(normalizeEvidenceValue(right))
}

const freezeSubmissionEvidence: CollectionBeforeChangeHook = ({ data, operation, originalDoc }) => {
  if (operation !== 'update' || !data || !originalDoc) return data

  for (const field of submissionEvidenceFields) {
    if (!Object.prototype.hasOwnProperty.call(data, field)) continue
    if (evidenceValuesMatch(data[field], originalDoc[field])) continue

    throw new Error('Submission evidence cannot be changed after creation.')
  }

  return data
}

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
    description: 'Contact requests submitted from clinic profile pages',
  },
  access: {
    create: isPlatformBasicUser,
    read: isPlatformBasicUser,
    update: isPlatformBasicUser,
    delete: isPlatformBasicUser,
  },
  hooks: {
    beforeChange: [freezeSubmissionEvidence],
  },
  fields: [
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
      name: 'doctor',
      type: 'relationship',
      relationTo: 'doctors',
      admin: {
        description: 'Doctor selected on the clinic profile',
      },
    },
    {
      name: 'treatment',
      type: 'relationship',
      relationTo: 'treatments',
      admin: {
        description: 'Treatment selected on the clinic profile',
      },
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
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'submitted',
      options: [...patientClinicInquiryStatusOptions],
      admin: {
        description: 'Current handling status',
      },
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
  ],
  timestamps: true,
}
