import { describe, expect, it } from 'vitest'
import { isClinicAccessReady, isClinicStaffAccessReady } from '@/auth/utilities/clinicAccessState'
import type { Clinic, ClinicStaff } from '@/payload-types'

const clinic = { id: 8, status: 'pending', participationStatus: 'approved' } as unknown as Clinic
const staff = {
  id: 22,
  clinic: 8,
  status: 'approved',
  supabaseUserId: 'subject-22',
  authSync: { status: 'synced' },
  assignmentScope: 'local',
  activationReadiness: {
    version: 'identity-v1',
    principalId: String(22),
    subject: 'subject-22',
    establishedAt: '2026-10-17T10:00:00.000Z',
  },
  accountCompletion: {
    source: 'initial-password',
    subject: 'subject-22',
    clinicId: '8',
    evidenceAt: '2026-10-03T10:00:00.000Z',
    observedAt: '2026-10-03T10:00:00.000Z',
  },
} as unknown as ClinicStaff

describe('private clinic participation', () => {
  it('allows completed participation while the clinic is unpublished', () => {
    expect(isClinicAccessReady(clinic)).toBe(true)
    expect(isClinicStaffAccessReady(staff)).toBe(true)
  })

  it('keeps activation bound to the person after local assignment replacement', () => {
    const converted = {
      ...staff,
      clinic: 9,
      assignmentScope: 'local',
      activationReadiness: {
        version: 'identity-v1',
        principalId: '22',
        subject: 'subject-22',
        establishedAt: '2026-10-17T10:00:00.000Z',
      },
    } as ClinicStaff
    expect(isClinicStaffAccessReady(converted)).toBe(true)
    expect(isClinicStaffAccessReady({ ...converted, id: 23 })).toBe(false)
    expect(isClinicStaffAccessReady({ ...converted, supabaseUserId: 'replacement' })).toBe(false)
  })

  it('denies an invited and synchronized participant without password evidence', () => {
    expect(isClinicStaffAccessReady({ ...staff, activationReadiness: undefined })).toBe(false)
  })

  it.each(['pending', 'rejected', 'disabled', 'offboarded'])('denies %s staff despite completion', (status) => {
    expect(isClinicStaffAccessReady({ ...staff, status } as ClinicStaff)).toBe(false)
  })

  it('denies a replacement identity or missing explicit assignment', () => {
    expect(isClinicStaffAccessReady({ ...staff, supabaseUserId: 'other-subject' })).toBe(false)
    expect(isClinicStaffAccessReady({ ...staff, assignmentScope: undefined })).toBe(false)
  })

  it('denies rejected and deleted clinics independently of participation', () => {
    expect(isClinicAccessReady({ ...clinic, status: 'rejected' })).toBe(false)
    expect(isClinicAccessReady({ ...clinic, deletedAt: '2026-10-03T10:00:00.000Z' })).toBe(false)
  })
})
