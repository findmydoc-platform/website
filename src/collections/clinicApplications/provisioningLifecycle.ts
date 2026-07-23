import type { ClinicApplication } from '@/payload-types'

export type ClinicApplicationProvisioningInputField =
  'clinicName' | 'clinicWebsite' | 'contactEmail' | 'contactFirstName' | 'contactLastName' | 'contactRole'

export const clinicApplicationProvisioningInputFields = [
  'clinicName',
  'clinicWebsite',
  'contactFirstName',
  'contactLastName',
  'contactEmail',
  'contactRole',
] as const satisfies readonly ClinicApplicationProvisioningInputField[]

export const clinicApplicationProvisioningErrorLabels = {
  record_failed: 'Record failed',
  auth_failed: 'Authentication failed',
  binding_failed: 'Identity binding failed',
} as const

export const hasClinicApplicationProvisioningInputChanged = (
  doc: Partial<ClinicApplication>,
  previousDoc: Partial<ClinicApplication>,
): boolean => clinicApplicationProvisioningInputFields.some((field) => doc[field] !== previousDoc[field])

type RelationshipValue =
  | null
  | number
  | string
  | {
      email?: string | null
      id?: number | string
      name?: string | null
    }

type ClinicApplicationLifecyclePresentationInput = Readonly<{
  currentData: Partial<ClinicApplication>
  persistedData: Partial<ClinicApplication>
}>

export type ClinicApplicationLifecyclePresentation = Readonly<{
  details: ReadonlyArray<Readonly<{ label: string; value: string }>>
  guidance: string
  stateLabel: 'Awaiting review' | 'Completed' | 'Failed' | 'Provisioning pending' | 'Rejected'
  summary: string
  tone: 'error' | 'info' | 'success' | 'warning'
}>

const formatRelationship = (value: RelationshipValue | undefined): string => {
  if (value === null || value === undefined) return 'Not available'
  if (typeof value === 'number' || typeof value === 'string') return String(value)

  return value.name || value.email || (value.id === undefined ? 'Not available' : String(value.id))
}

const formatProcessedAt = (value: string | null | undefined): string => {
  if (!value) return 'Not available'

  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) return value

  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export const getClinicApplicationLifecyclePresentation = ({
  currentData,
  persistedData,
}: ClinicApplicationLifecyclePresentationInput): ClinicApplicationLifecyclePresentation => {
  const status = currentData.status ?? persistedData.status ?? 'submitted'
  const provisioningStatus = persistedData.provisioningStatus ?? 'not_started'
  const provisioningErrorCode = persistedData.provisioningErrorCode
  const inputChanged = hasClinicApplicationProvisioningInputChanged(currentData, persistedData)
  const commonDetails = [
    {
      label: 'Review status',
      value: status === 'approved' ? 'Approved' : status === 'rejected' ? 'Rejected' : 'Submitted',
    },
    {
      label: 'Provisioning result',
      value:
        provisioningStatus === 'completed' ? 'Completed' : provisioningStatus === 'failed' ? 'Failed' : 'Not started',
    },
  ]

  if (provisioningStatus === 'completed') {
    return {
      details: [
        ...commonDetails,
        ...(provisioningErrorCode
          ? [
              {
                label: 'Error category',
                value: clinicApplicationProvisioningErrorLabels[provisioningErrorCode],
              },
            ]
          : []),
        ...(persistedData.linkedRecords?.clinic
          ? [
              {
                label: 'Created clinic',
                value: formatRelationship(persistedData.linkedRecords.clinic as RelationshipValue),
              },
            ]
          : []),
        ...(persistedData.linkedRecords?.clinicStaff
          ? [
              {
                label: 'Created clinic staff',
                value: formatRelationship(persistedData.linkedRecords.clinicStaff as RelationshipValue),
              },
            ]
          : []),
        ...(persistedData.linkedRecords?.processedAt
          ? [
              {
                label: 'Processed',
                value: formatProcessedAt(persistedData.linkedRecords.processedAt),
              },
            ]
          : []),
      ],
      guidance: 'The linked clinic and clinic staff records are available for the remaining review steps.',
      stateLabel: 'Completed',
      summary: 'Automatic clinic and clinic staff creation completed.',
      tone: 'success',
    }
  }

  if (provisioningStatus === 'failed') {
    return {
      details: [
        ...commonDetails,
        ...(provisioningErrorCode
          ? [
              {
                label: 'Error category',
                value: clinicApplicationProvisioningErrorLabels[provisioningErrorCode],
              },
            ]
          : []),
      ],
      guidance: inputChanged
        ? 'Saving starts another provisioning attempt.'
        : 'Change at least the clinic name, website, contact first name, contact last name, email, or role, then save.',
      stateLabel: 'Failed',
      summary: inputChanged
        ? 'A provisioning input changed and the application is ready to retry.'
        : 'The last automatic provisioning attempt failed.',
      tone: 'error',
    }
  }

  if (status === 'rejected') {
    return {
      details: commonDetails,
      guidance: 'Saving keeps the application rejected and does not start provisioning.',
      stateLabel: 'Rejected',
      summary: 'This application is rejected.',
      tone: 'warning',
    }
  }

  if (status === 'approved') {
    return {
      details: commonDetails,
      guidance:
        persistedData.status === 'approved'
          ? 'Provisioning is waiting for the existing automatic process to complete.'
          : 'Saving Approved starts automatic clinic and clinic staff creation.',
      stateLabel: 'Provisioning pending',
      summary: 'This application is approved and awaiting automatic provisioning.',
      tone: 'warning',
    }
  }

  return {
    details: commonDetails,
    guidance: 'Review the application and select Approved or Rejected.',
    stateLabel: 'Awaiting review',
    summary: 'This application is waiting for a review decision.',
    tone: 'info',
  }
}
