import type { ClinicStaff } from '@/payload-types'

export type ClinicStaffStatus = NonNullable<ClinicStaff['status']>
export type ClinicStaffAuthSyncStatus = NonNullable<NonNullable<ClinicStaff['authSync']>['status']>
export type ClinicStaffAuthSyncErrorCode = NonNullable<NonNullable<ClinicStaff['authSync']>['errorCode']>

export const clinicStaffStatusOptions = [
  { label: 'Pending', value: 'pending' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Disabled', value: 'disabled' },
  { label: 'Offboarded', value: 'offboarded' },
] satisfies Array<{ label: string; value: ClinicStaffStatus }>

export const clinicStaffStatusTransitions = {
  pending: ['approved', 'rejected', 'offboarded'],
  approved: ['disabled', 'offboarded'],
  disabled: ['approved', 'offboarded'],
  rejected: ['offboarded'],
  offboarded: [],
} as const satisfies Record<ClinicStaffStatus, readonly ClinicStaffStatus[]>

export const clinicStaffAuthSyncStatusLabels = {
  pending: 'Pending',
  synced: 'Synced',
  failed: 'Failed',
  deleted: 'Deleted',
} as const satisfies Record<ClinicStaffAuthSyncStatus, string>

export const clinicStaffAuthSyncErrorLabels = {
  missing_identity: 'Missing Supabase identity',
  account_update_failed: 'Account update failed',
  account_delete_failed: 'Account deletion failed',
} as const satisfies Record<ClinicStaffAuthSyncErrorCode, string>

export const isClinicStaffStatus = (value: unknown): value is ClinicStaffStatus =>
  clinicStaffStatusOptions.some((option) => option.value === value)

export const getClinicStaffStatusLabel = (status: ClinicStaffStatus): string =>
  clinicStaffStatusOptions.find((option) => option.value === status)?.label ?? status

export const getClinicStaffSelectableStatuses = (persistedStatus: ClinicStaffStatus): readonly ClinicStaffStatus[] => [
  persistedStatus,
  ...clinicStaffStatusTransitions[persistedStatus],
]

export const isClinicStaffStatusTransitionAllowed = (
  persistedStatus: ClinicStaffStatus,
  selectedStatus: ClinicStaffStatus,
): boolean =>
  selectedStatus === persistedStatus || clinicStaffStatusTransitions[persistedStatus].includes(selectedStatus as never)

type ClinicStaffLifecyclePresentationInput = Readonly<{
  authSyncErrorCode?: ClinicStaffAuthSyncErrorCode | null
  authSyncStatus?: ClinicStaffAuthSyncStatus | null
  persistedStatus: ClinicStaffStatus
  selectedStatus: ClinicStaffStatus
}>

export type ClinicStaffLifecyclePresentation = Readonly<{
  details: ReadonlyArray<Readonly<{ label: string; value: string }>>
  guidance: string
  stateLabel: string
  summary: string
  tone: 'error' | 'info' | 'success' | 'warning'
}>

const getTransitionSummary = (
  persistedStatus: ClinicStaffStatus,
  selectedStatus: ClinicStaffStatus,
): Pick<ClinicStaffLifecyclePresentation, 'guidance' | 'stateLabel' | 'summary' | 'tone'> => {
  if (selectedStatus === 'approved') {
    return {
      guidance:
        'Clinic Dashboard access still requires a successful authentication sync and an assigned approved clinic.',
      stateLabel: persistedStatus === 'disabled' ? 'Reactivation selected' : 'Activation selected',
      summary:
        persistedStatus === 'disabled'
          ? 'Saving reactivates the Supabase identity.'
          : 'Saving activates the Supabase identity.',
      tone: 'warning',
    }
  }

  if (selectedStatus === 'offboarded') {
    return {
      guidance: 'Offboarding is terminal. The clinic staff lifecycle cannot be reopened after saving.',
      stateLabel: 'Offboarding selected',
      summary: 'Saving permanently deletes the Supabase identity.',
      tone: 'warning',
    }
  }

  return {
    guidance: 'The status change remains saved even if the subsequent Supabase synchronization fails.',
    stateLabel: 'Access removal selected',
    summary: 'Saving disables the Supabase identity.',
    tone: 'warning',
  }
}

export const getClinicStaffLifecyclePresentation = ({
  authSyncErrorCode,
  authSyncStatus,
  persistedStatus,
  selectedStatus,
}: ClinicStaffLifecyclePresentationInput): ClinicStaffLifecyclePresentation => {
  const details = [
    { label: 'Saved status', value: getClinicStaffStatusLabel(persistedStatus) },
    { label: 'After save', value: getClinicStaffStatusLabel(selectedStatus) },
    {
      label: 'Authentication sync',
      value: authSyncStatus ? clinicStaffAuthSyncStatusLabels[authSyncStatus] : 'Not reported',
    },
    ...(authSyncErrorCode
      ? [{ label: 'Last sync issue', value: clinicStaffAuthSyncErrorLabels[authSyncErrorCode] }]
      : []),
  ]

  if (selectedStatus !== persistedStatus) {
    return {
      details,
      ...getTransitionSummary(persistedStatus, selectedStatus),
    }
  }

  if (authSyncStatus === 'failed') {
    return {
      details,
      guidance: 'Saving this record again retries the same Supabase operation.',
      stateLabel: 'Sync failed',
      summary: 'The last Supabase synchronization failed.',
      tone: 'error',
    }
  }

  if (persistedStatus === 'offboarded') {
    return {
      details,
      guidance: 'No further lifecycle transition is available.',
      stateLabel: 'Terminal',
      summary: 'The Supabase identity is deleted and this lifecycle is terminal.',
      tone: 'success',
    }
  }

  if (persistedStatus === 'pending') {
    return {
      details,
      guidance: 'Choose an allowed status to see its Supabase effect before saving.',
      stateLabel: 'Awaiting decision',
      summary: 'No lifecycle change is selected.',
      tone: 'info',
    }
  }

  return {
    details,
    guidance: 'Saving an unrelated change does not repeat a successful synchronization.',
    stateLabel: 'Synchronized',
    summary: 'Supabase access matches the saved clinic staff status.',
    tone: 'success',
  }
}
