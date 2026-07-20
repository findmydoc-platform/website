import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  isClinicAccessReady,
  isClinicStaffAccessReady,
  readClinicAccessState,
} from '@/auth/utilities/clinicAccessState'
import type { Clinic, ClinicStaff } from '@/payload-types'
import type { Payload } from 'payload'
import { createMockPayload } from '../../helpers/testHelpers'

const readyStaff = {
  id: 22,
  collection: 'clinicStaff',
  clinic: 8,
  email: 'clinic@example.com',
  status: 'approved',
  authSync: { status: 'synced' },
} as ClinicStaff

const readyClinic = {
  id: 8,
  name: 'Example Clinic',
  status: 'approved',
} as Clinic

describe('clinic access state', () => {
  const payload = createMockPayload()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it.each([
    ['approved, synchronized, assigned', readyStaff, true],
    ['pending', { ...readyStaff, status: 'pending' }, false],
    ['rejected', { ...readyStaff, status: 'rejected' }, false],
    ['disabled', { ...readyStaff, status: 'disabled' }, false],
    ['offboarded', { ...readyStaff, status: 'offboarded' }, false],
    ['auth pending', { ...readyStaff, authSync: { status: 'pending' } }, false],
    ['auth failed', { ...readyStaff, authSync: { status: 'failed' } }, false],
    ['without clinic', { ...readyStaff, clinic: null }, false],
  ])('classifies clinic staff state: %s', (_label, staff, expected) => {
    expect(isClinicStaffAccessReady(staff as ClinicStaff)).toBe(expected)
  })

  it.each([
    ['approved', readyClinic, true],
    ['pending', { ...readyClinic, status: 'pending' }, false],
    ['rejected', { ...readyClinic, status: 'rejected' }, false],
    ['deleted', { ...readyClinic, deletedAt: '2026-07-20T00:00:00.000Z' }, false],
  ])('classifies clinic state: %s', (_label, clinic, expected) => {
    expect(isClinicAccessReady(clinic as Clinic)).toBe(expected)
  })

  it('loads an access-ready staff and clinic through Payload filters', async () => {
    payload.find.mockResolvedValueOnce({ docs: [readyStaff] }).mockResolvedValueOnce({ docs: [readyClinic] })

    await expect(readClinicAccessState(payload as unknown as Payload, 22)).resolves.toEqual({
      clinic: readyClinic,
      staff: readyStaff,
    })

    expect(payload.find).toHaveBeenNthCalledWith(1, {
      collection: 'clinicStaff',
      depth: 0,
      limit: 1,
      overrideAccess: true,
      pagination: false,
      req: undefined,
      where: {
        and: [
          { id: { equals: 22 } },
          { status: { equals: 'approved' } },
          { 'authSync.status': { equals: 'synced' } },
          { clinic: { exists: true } },
        ],
      },
    })
    expect(payload.find).toHaveBeenNthCalledWith(2, {
      collection: 'clinics',
      depth: 0,
      limit: 1,
      overrideAccess: true,
      pagination: false,
      req: undefined,
      where: {
        and: [{ id: { equals: 8 } }, { status: { equals: 'approved' } }, { deletedAt: { exists: false } }],
      },
    })
  })

  it('fails closed when a Payload result does not satisfy the centralized state rule', async () => {
    payload.find.mockResolvedValueOnce({ docs: [{ ...readyStaff, status: 'pending' }] })
    await expect(readClinicAccessState(payload as unknown as Payload, 22)).resolves.toBeNull()

    payload.find.mockResolvedValueOnce({ docs: [readyStaff] }).mockResolvedValueOnce({
      docs: [{ ...readyClinic, status: 'pending' }],
    })
    await expect(readClinicAccessState(payload as unknown as Payload, 22)).resolves.toBeNull()
  })
})
