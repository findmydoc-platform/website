'use client'

import { SelectField, useDocumentInfo, useFormFields } from '@payloadcms/ui'
import type { SelectFieldClientProps } from 'payload'

import { LifecycleStatusPanel } from '@/app/(payload)/components/LifecycleStatusPanel'
import {
  clinicStaffStatusOptions,
  getClinicStaffLifecyclePresentation,
  getClinicStaffSelectableStatuses,
  isClinicStaffStatus,
  type ClinicStaffAuthSyncErrorCode,
  type ClinicStaffAuthSyncStatus,
} from '@/collections/clinicStaff/lifecycle'

const authSyncStatuses: readonly ClinicStaffAuthSyncStatus[] = ['pending', 'synced', 'failed', 'deleted']
const authSyncErrorCodes: readonly ClinicStaffAuthSyncErrorCode[] = [
  'missing_identity',
  'account_update_failed',
  'account_delete_failed',
]

const readAuthSyncStatus = (value: unknown): ClinicStaffAuthSyncStatus | null =>
  authSyncStatuses.includes(value as ClinicStaffAuthSyncStatus) ? (value as ClinicStaffAuthSyncStatus) : null

const readAuthSyncErrorCode = (value: unknown): ClinicStaffAuthSyncErrorCode | null =>
  authSyncErrorCodes.includes(value as ClinicStaffAuthSyncErrorCode) ? (value as ClinicStaffAuthSyncErrorCode) : null

export function ClinicStaffStatusField(props: SelectFieldClientProps) {
  const { initialData } = useDocumentInfo()
  const persistedStatus = isClinicStaffStatus(initialData?.status) ? initialData.status : 'pending'
  const selectableStatuses = getClinicStaffSelectableStatuses(persistedStatus)
  const field = {
    ...props.field,
    admin: {
      ...props.field.admin,
      readOnly: props.field.admin?.readOnly || persistedStatus === 'offboarded',
    },
    options: clinicStaffStatusOptions.filter((option) => selectableStatuses.includes(option.value)),
  } as SelectFieldClientProps['field']

  return <SelectField {...props} field={field} />
}

export function ClinicStaffLifecyclePanel() {
  const { initialData } = useDocumentInfo()
  const persistedStatus = isClinicStaffStatus(initialData?.status) ? initialData.status : 'pending'
  const formState = useFormFields(([fields]) => ({
    authSyncErrorCode: fields['authSync.errorCode']?.value,
    authSyncStatus: fields['authSync.status']?.value,
    selectedStatus: fields.status?.value,
  }))
  const selectedStatus = isClinicStaffStatus(formState.selectedStatus) ? formState.selectedStatus : persistedStatus
  const presentation = getClinicStaffLifecyclePresentation({
    authSyncErrorCode: readAuthSyncErrorCode(formState.authSyncErrorCode),
    authSyncStatus: readAuthSyncStatus(formState.authSyncStatus),
    persistedStatus,
    selectedStatus,
  })

  return <LifecycleStatusPanel {...presentation} title="Lifecycle impact" />
}
