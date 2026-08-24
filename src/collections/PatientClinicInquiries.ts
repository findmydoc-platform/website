import { ValidationError } from 'payload'
import type { CollectionBeforeChangeHook, CollectionConfig, FieldAccess } from 'payload'

import { platformOnlyFieldAccess } from '@/access/fieldAccess'
import { isClinicStaff } from '@/access/isClinicStaff'
import type { PatientClinicInquiry } from '@/payload-types'

export const patientClinicInquiryStatusOptions = [
  { label: 'Submitted', value: 'submitted' },
  { label: 'In Review', value: 'in_review' },
  { label: 'Contacted', value: 'contacted' },
  { label: 'Closed', value: 'closed' },
  { label: 'Spam', value: 'spam' },
] as const

export const patientClinicInquiryHandlingStatusOptions = [
  { label: 'Submitted', value: 'submitted' },
  { label: 'In Review', value: 'in_review' },
  { label: 'Contacted', value: 'contacted' },
  { label: 'Spam', value: 'spam' },
] as const

export const patientClinicInquiryLifecycleOptions = [
  { label: 'Open', value: 'open' },
  { label: 'Closed', value: 'closed' },
] as const

type PatientClinicInquiryStatus = (typeof patientClinicInquiryStatusOptions)[number]['value']

const privateInquiryDomainFieldAccess: FieldAccess = () => false
const inquiryDomainFields = [
  'patient',
  'handlingStatus',
  'lifecycle',
  'previousHandlingStatus',
  'revision',
  'activitySequence',
  'externalSequence',
  'clinicNotificationSequence',
  'clinicUnreadFloor',
  'clinicUnreadEpoch',
  'lastActivityAt',
  'lastExternalActivityAt',
  'creationActorKey',
  'creationIdempotencyKey',
  'creationRequestHash',
] as const

export const patientClinicInquiryStatusTransitions = {
  submitted: ['in_review', 'contacted', 'closed', 'spam'],
  in_review: ['contacted', 'closed', 'spam'],
  contacted: ['closed'],
  closed: [],
  spam: [],
} as const satisfies Record<PatientClinicInquiryStatus, readonly PatientClinicInquiryStatus[]>

export const patientClinicInquiryTreatmentTimelineValues = [
  'as_soon_as_possible',
  'within_two_weeks',
  'within_one_month',
  'flexible',
] as const

export const patientClinicInquiryTreatmentTimelineOptions = [
  { label: 'As soon as possible', value: 'as_soon_as_possible' },
  { label: 'Within two weeks', value: 'within_two_weeks' },
  { label: 'Within one month', value: 'within_one_month' },
  { label: 'Flexible', value: 'flexible' },
] as const

export const patientClinicInquiryContactWindowValues = [
  'as_soon_as_possible',
  'morning',
  'afternoon',
  'evening',
  'no_preference',
] as const

export const patientClinicInquiryContactWindowOptions = [
  { label: 'As soon as possible', value: 'as_soon_as_possible' },
  { label: 'Morning', value: 'morning' },
  { label: 'Afternoon', value: 'afternoon' },
  { label: 'Evening', value: 'evening' },
  { label: 'No preference', value: 'no_preference' },
] as const

const submissionEvidenceFields = ['consent'] as const
const immutableSubmissionFields = [
  'patient',
  'clinic',
  'fullName',
  'email',
  'phoneNumber',
  'treatmentTimeline',
  'preferredContactWindow',
  'doctor',
  'treatment',
  'message',
  'consent',
  'status',
] as const

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

const freezeOriginalSubmission: CollectionBeforeChangeHook = ({ data, operation, originalDoc }) => {
  if (operation !== 'update' || !data || !originalDoc) return data
  for (const field of immutableSubmissionFields) {
    if (!Object.prototype.hasOwnProperty.call(data, field)) continue
    if (evidenceValuesMatch(data[field], originalDoc[field])) continue
    throw new Error(`${field} cannot be changed after inquiry submission.`)
  }
  return data
}

const validateClinicStaffStatusTransition: CollectionBeforeChangeHook<PatientClinicInquiry> = ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  if (operation !== 'update' || !originalDoc?.status || !isClinicStaff({ req })) return data

  const previousStatus = originalDoc.status
  const nextStatus = data.status ?? previousStatus
  if (nextStatus === previousStatus) return data

  if (!patientClinicInquiryStatusTransitions[previousStatus].includes(nextStatus as never)) {
    throw new ValidationError({
      collection: 'patientClinicInquiries',
      errors: [
        {
          label: 'Status',
          message: `Clinic inquiry status transition ${previousStatus} -> ${nextStatus} is not allowed.`,
          path: 'status',
        },
      ],
      id: originalDoc.id,
      req,
    })
  }

  return data
}

const protectInquiryDomainFields: CollectionBeforeChangeHook = ({ data, operation, originalDoc, req }) => {
  if (!data) return data
  const touchesDomain = inquiryDomainFields.some((field) => {
    if (!Object.prototype.hasOwnProperty.call(data, field)) return false
    if (operation !== 'update' || !originalDoc) return true
    return !evidenceValuesMatch(data[field], originalDoc[field])
  })
  if (!touchesDomain) return data
  if (req.context?.inquiryCommunicationCommand === true) return data

  throw new ValidationError({
    collection: 'patientClinicInquiries',
    errors: [
      {
        message: `Inquiry communication domain fields cannot be changed through a direct ${operation} operation.`,
        path:
          inquiryDomainFields.find(
            (field) =>
              Object.prototype.hasOwnProperty.call(data, field) &&
              (operation !== 'update' || !originalDoc || !evidenceValuesMatch(data[field], originalDoc[field])),
          ) ?? 'id',
      },
    ],
    req,
  })
}

export const PatientClinicInquiries: CollectionConfig = {
  slug: 'patientClinicInquiries',
  labels: {
    singular: 'Clinic Contact Request',
    plural: 'Clinic Contact Requests',
  },
  admin: {
    hidden: true,
    group: 'Platform Management',
    useAsTitle: 'fullName',
    defaultColumns: ['fullName', 'clinic', 'status', 'email', 'createdAt'],
    description: 'Contact requests submitted from clinic profile pages',
  },
  access: {
    create: () => false,
    read: () => false,
    update: () => false,
    delete: () => false,
    admin: () => false,
  },
  endpoints: false,
  graphQL: false,
  hooks: {
    beforeChange: [
      protectInquiryDomainFields,
      freezeOriginalSubmission,
      freezeSubmissionEvidence,
      validateClinicStaffStatusTransition,
    ],
  },
  fields: [
    {
      name: 'patient',
      type: 'relationship',
      relationTo: 'patients',
      index: true,
      access: {
        create: privateInquiryDomainFieldAccess,
        read: privateInquiryDomainFieldAccess,
        update: privateInquiryDomainFieldAccess,
      },
      admin: {
        description: 'Verified patient identity bound by an authenticated server request',
        readOnly: true,
      },
    },
    {
      name: 'clinic',
      type: 'relationship',
      relationTo: 'clinics',
      required: true,
      index: true,
      admin: {
        description: 'Clinic profile the request was sent from',
      },
      access: {
        create: privateInquiryDomainFieldAccess,
        read: privateInquiryDomainFieldAccess,
        update: privateInquiryDomainFieldAccess,
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'fullName',
          type: 'text',
          required: true,
          access: {
            update: platformOnlyFieldAccess,
          },
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
          access: {
            update: platformOnlyFieldAccess,
          },
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
      access: {
        create: privateInquiryDomainFieldAccess,
        read: privateInquiryDomainFieldAccess,
        update: privateInquiryDomainFieldAccess,
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'treatmentTimeline',
          type: 'select',
          options: [...patientClinicInquiryTreatmentTimelineOptions],
          access: {
            update: platformOnlyFieldAccess,
          },
          admin: {
            description: 'How soon the requester is considering treatment',
            width: '50%',
          },
        },
        {
          name: 'preferredContactWindow',
          type: 'select',
          options: [...patientClinicInquiryContactWindowOptions],
          access: {
            update: platformOnlyFieldAccess,
          },
          admin: {
            description: 'When the requester prefers to be contacted',
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
      access: {
        create: privateInquiryDomainFieldAccess,
        read: privateInquiryDomainFieldAccess,
        update: privateInquiryDomainFieldAccess,
      },
    },
    {
      name: 'treatment',
      type: 'relationship',
      relationTo: 'treatments',
      access: {
        create: privateInquiryDomainFieldAccess,
        read: privateInquiryDomainFieldAccess,
        update: privateInquiryDomainFieldAccess,
      },
      admin: {
        description: 'Treatment selected on the clinic profile',
      },
    },
    {
      name: 'message',
      type: 'textarea',
      required: true,
      access: {
        create: privateInquiryDomainFieldAccess,
        read: privateInquiryDomainFieldAccess,
        update: privateInquiryDomainFieldAccess,
      },
      admin: {
        description: 'Message entered by the requester',
      },
    },
    {
      name: 'consent',
      type: 'group',
      access: {
        create: privateInquiryDomainFieldAccess,
        read: privateInquiryDomainFieldAccess,
        update: privateInquiryDomainFieldAccess,
      },
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
        description: 'Legacy combined state retained until the additive cutover is complete',
        hidden: true,
        readOnly: true,
      },
      access: {
        create: privateInquiryDomainFieldAccess,
        read: privateInquiryDomainFieldAccess,
        update: privateInquiryDomainFieldAccess,
      },
    },
    {
      name: 'handlingStatus',
      type: 'select',
      options: [...patientClinicInquiryHandlingStatusOptions],
      index: true,
      admin: {
        description: 'Current inquiry handling status',
        readOnly: true,
      },
      access: {
        create: privateInquiryDomainFieldAccess,
        read: privateInquiryDomainFieldAccess,
        update: privateInquiryDomainFieldAccess,
      },
    },
    {
      name: 'lifecycle',
      type: 'select',
      options: [...patientClinicInquiryLifecycleOptions],
      index: true,
      admin: {
        description: 'Whether external communication is open or closed',
        readOnly: true,
      },
      access: {
        create: privateInquiryDomainFieldAccess,
        read: privateInquiryDomainFieldAccess,
        update: privateInquiryDomainFieldAccess,
      },
    },
    {
      name: 'previousHandlingStatus',
      type: 'select',
      options: patientClinicInquiryHandlingStatusOptions.filter((option) => option.value !== 'spam'),
      admin: {
        hidden: true,
        readOnly: true,
      },
      access: {
        create: privateInquiryDomainFieldAccess,
        read: privateInquiryDomainFieldAccess,
        update: privateInquiryDomainFieldAccess,
      },
    },
    {
      name: 'revision',
      type: 'number',
      min: 0,
      index: true,
      admin: {
        readOnly: true,
      },
      access: {
        create: privateInquiryDomainFieldAccess,
        read: privateInquiryDomainFieldAccess,
        update: privateInquiryDomainFieldAccess,
      },
    },
    {
      name: 'activitySequence',
      type: 'number',
      min: 0,
      admin: { hidden: true, readOnly: true },
      access: {
        create: privateInquiryDomainFieldAccess,
        read: privateInquiryDomainFieldAccess,
        update: privateInquiryDomainFieldAccess,
      },
    },
    {
      name: 'externalSequence',
      type: 'number',
      min: 0,
      admin: { hidden: true, readOnly: true },
      access: {
        create: privateInquiryDomainFieldAccess,
        read: privateInquiryDomainFieldAccess,
        update: privateInquiryDomainFieldAccess,
      },
    },
    {
      name: 'clinicNotificationSequence',
      type: 'number',
      min: 0,
      admin: { hidden: true, readOnly: true },
      access: {
        create: privateInquiryDomainFieldAccess,
        read: privateInquiryDomainFieldAccess,
        update: privateInquiryDomainFieldAccess,
      },
    },
    {
      name: 'clinicUnreadFloor',
      type: 'number',
      min: 0,
      admin: { hidden: true, readOnly: true },
      access: {
        create: privateInquiryDomainFieldAccess,
        read: privateInquiryDomainFieldAccess,
        update: privateInquiryDomainFieldAccess,
      },
    },
    {
      name: 'clinicUnreadEpoch',
      type: 'number',
      min: 0,
      admin: { hidden: true, readOnly: true },
      access: {
        create: privateInquiryDomainFieldAccess,
        read: privateInquiryDomainFieldAccess,
        update: privateInquiryDomainFieldAccess,
      },
    },
    {
      name: 'lastActivityAt',
      type: 'date',
      index: true,
      admin: { hidden: true, readOnly: true },
      access: {
        create: privateInquiryDomainFieldAccess,
        read: privateInquiryDomainFieldAccess,
        update: privateInquiryDomainFieldAccess,
      },
    },
    {
      name: 'lastExternalActivityAt',
      type: 'date',
      index: true,
      admin: { hidden: true, readOnly: true },
      access: {
        create: privateInquiryDomainFieldAccess,
        read: privateInquiryDomainFieldAccess,
        update: privateInquiryDomainFieldAccess,
      },
    },
    {
      name: 'creationActorKey',
      type: 'text',
      index: true,
      access: {
        create: privateInquiryDomainFieldAccess,
        read: privateInquiryDomainFieldAccess,
        update: privateInquiryDomainFieldAccess,
      },
      admin: { hidden: true, readOnly: true },
    },
    {
      name: 'creationIdempotencyKey',
      type: 'text',
      index: true,
      access: {
        create: privateInquiryDomainFieldAccess,
        read: privateInquiryDomainFieldAccess,
        update: privateInquiryDomainFieldAccess,
      },
      admin: { hidden: true, readOnly: true },
    },
    {
      name: 'creationRequestHash',
      type: 'text',
      access: {
        create: privateInquiryDomainFieldAccess,
        read: privateInquiryDomainFieldAccess,
        update: privateInquiryDomainFieldAccess,
      },
      admin: { hidden: true, readOnly: true },
    },
    {
      name: 'assignedTo',
      type: 'relationship',
      relationTo: 'platformStaff',
      access: {
        read: platformOnlyFieldAccess,
        update: platformOnlyFieldAccess,
      },
      admin: {
        description: 'Platform user handling this request',
      },
    },
  ],
  indexes: [{ fields: ['patient', 'creationIdempotencyKey'], unique: true }],
  timestamps: true,
  trash: true,
}
