import { describe, expect, it } from 'vitest'

import {
  clinicStaffStatusTransitions,
  getClinicStaffLifecyclePresentation,
  getClinicStaffSelectableStatuses,
  isClinicStaffStatusTransitionAllowed,
  type ClinicStaffStatus,
} from '@/collections/clinicStaff/lifecycle'
import {
  clinicApplicationProvisioningInputFields,
  getClinicApplicationLifecyclePresentation,
  hasClinicApplicationProvisioningInputChanged,
} from '@/collections/clinicApplications/provisioningLifecycle'
import type { ClinicApplication } from '@/payload-types'

const clinicStaffStatuses: readonly ClinicStaffStatus[] = ['pending', 'approved', 'rejected', 'disabled', 'offboarded']

describe('Clinic lifecycle rules', () => {
  it('defines the complete ClinicStaff transition matrix', () => {
    const expected = {
      pending: ['approved', 'rejected', 'offboarded'],
      approved: ['disabled', 'offboarded'],
      disabled: ['approved', 'offboarded'],
      rejected: ['offboarded'],
      offboarded: [],
    }

    expect(clinicStaffStatusTransitions).toEqual(expected)

    for (const persistedStatus of clinicStaffStatuses) {
      for (const selectedStatus of clinicStaffStatuses) {
        expect(isClinicStaffStatusTransitionAllowed(persistedStatus, selectedStatus)).toBe(
          selectedStatus === persistedStatus ||
            (expected[persistedStatus] as readonly string[]).includes(selectedStatus),
        )
      }
    }
  })

  it('keeps selectable statuses anchored to the saved value and treats offboarded as terminal', () => {
    expect(getClinicStaffSelectableStatuses('approved')).toEqual(['approved', 'disabled', 'offboarded'])
    expect(getClinicStaffSelectableStatuses('offboarded')).toEqual(['offboarded'])
  })

  it('describes activation, reactivation, disabling, offboarding, and sync retry effects', () => {
    expect(
      getClinicStaffLifecyclePresentation({
        persistedStatus: 'pending',
        selectedStatus: 'approved',
      }).summary,
    ).toBe('Saving activates the Supabase identity.')
    expect(
      getClinicStaffLifecyclePresentation({
        persistedStatus: 'disabled',
        selectedStatus: 'approved',
      }).summary,
    ).toBe('Saving reactivates the Supabase identity.')
    expect(
      getClinicStaffLifecyclePresentation({
        persistedStatus: 'approved',
        selectedStatus: 'disabled',
      }).summary,
    ).toBe('Saving disables the Supabase identity.')
    expect(
      getClinicStaffLifecyclePresentation({
        persistedStatus: 'approved',
        selectedStatus: 'offboarded',
      }).summary,
    ).toBe('Saving permanently deletes the Supabase identity.')
    expect(
      getClinicStaffLifecyclePresentation({
        authSyncErrorCode: 'account_update_failed',
        authSyncStatus: 'failed',
        persistedStatus: 'approved',
        selectedStatus: 'approved',
      }),
    ).toMatchObject({
      guidance: 'Saving this record again retries the same Supabase operation.',
      stateLabel: 'Sync failed',
      tone: 'error',
    })
  })

  it('uses the exact provisioning fields shared with retry detection', () => {
    expect(clinicApplicationProvisioningInputFields).toEqual([
      'clinicName',
      'clinicWebsite',
      'contactFirstName',
      'contactLastName',
      'contactEmail',
      'contactRole',
    ])

    const previousDoc: Partial<ClinicApplication> = {
      clinicName: 'Clinic',
      clinicWebsite: 'https://clinic.example',
      contactFirstName: 'Ada',
      contactLastName: 'Lovelace',
      contactEmail: 'clinic@example.com',
      contactRole: 'Clinic Management',
    }

    expect(hasClinicApplicationProvisioningInputChanged({ ...previousDoc, reviewNotes: 'Changed' }, previousDoc)).toBe(
      false,
    )

    for (const field of clinicApplicationProvisioningInputFields) {
      expect(
        hasClinicApplicationProvisioningInputChanged(
          {
            ...previousDoc,
            [field]: `${String(previousDoc[field])}-changed`,
          },
          previousDoc,
        ),
      ).toBe(true)
    }
  })

  it.each([
    [{ provisioningStatus: 'completed', status: 'rejected' }, 'Completed'],
    [{ provisioningStatus: 'failed', status: 'rejected' }, 'Failed'],
    [{ provisioningStatus: 'not_started', status: 'rejected' }, 'Rejected'],
    [{ provisioningStatus: 'not_started', status: 'approved' }, 'Provisioning pending'],
    [{ provisioningStatus: 'not_started', status: 'submitted' }, 'Awaiting review'],
  ] as const)('applies provisioning state precedence for %o', (persistedData, stateLabel) => {
    expect(
      getClinicApplicationLifecyclePresentation({
        currentData: persistedData,
        persistedData,
      }).stateLabel,
    ).toBe(stateLabel)
  })

  it('distinguishes a failed retry with and without changed provisioning input', () => {
    const persistedData: Partial<ClinicApplication> = {
      clinicName: 'Clinic',
      provisioningErrorCode: 'auth_failed',
      provisioningStatus: 'failed',
      status: 'approved',
    }

    expect(
      getClinicApplicationLifecyclePresentation({
        currentData: persistedData,
        persistedData,
      }).guidance,
    ).toContain('Change at least')
    expect(
      getClinicApplicationLifecyclePresentation({
        currentData: { ...persistedData, clinicName: 'Updated Clinic' },
        persistedData,
      }).guidance,
    ).toBe('Saving starts another provisioning attempt.')
  })

  it('explains that the first Approved save starts automatic provisioning', () => {
    const persistedData: Partial<ClinicApplication> = {
      provisioningStatus: 'not_started',
      status: 'submitted',
    }

    expect(
      getClinicApplicationLifecyclePresentation({
        currentData: { ...persistedData, status: 'approved' },
        persistedData,
      }).guidance,
    ).toBe('Saving Approved starts automatic clinic and clinic staff creation.')
  })

  it('shows completed linked records and a formatted processing date', () => {
    const presentation = getClinicApplicationLifecyclePresentation({
      currentData: { status: 'approved' },
      persistedData: {
        linkedRecords: {
          clinic: { id: 12, name: 'Lifecycle Clinic' } as never,
          clinicStaff: { email: 'staff@example.com', id: 13 } as never,
          processedAt: '2026-07-22T09:30:00.000Z',
        },
        provisioningStatus: 'completed',
        status: 'approved',
      },
    })

    expect(presentation.details).toEqual(
      expect.arrayContaining([
        { label: 'Created clinic', value: 'Lifecycle Clinic' },
        { label: 'Created clinic staff', value: 'staff@example.com' },
        expect.objectContaining({ label: 'Processed' }),
      ]),
    )
  })
})
