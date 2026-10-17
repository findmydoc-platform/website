import { describe, expect, it, vi } from 'vitest'
import type { PayloadRequest, RelationshipField } from 'payload'
import { Doctors } from '@/collections/Doctors'
import { DoctorSpecialties } from '@/collections/DoctorSpecialties'
import { DoctorTreatments } from '@/collections/DoctorTreatments'

const readClinicPrincipalAccess = vi.hoisted(() => vi.fn())
vi.mock('@/auth/utilities/clinicPrincipalAccess', () => ({ readClinicPrincipalAccess }))
vi.mock('@/access/utils/getClinicAssignment', () => ({ getUserAssignedClinicId: vi.fn(async () => null) }))

describe('Current doctor source access', () => {
  it('uses the current eligible group set instead of a token clinic or public active fallback', async () => {
    readClinicPrincipalAccess.mockResolvedValue({ staff: { id: 9 }, clinics: [{ id: 11 }, { id: 12 }] })
    const req = {
      user: { id: 9, collection: 'clinicStaff', clinic: null },
      payload: { logger: { error: vi.fn() } },
    } as unknown as PayloadRequest
    expect(await Doctors.access!.update!({ req })).toEqual({ clinic: { in: [11, 12] } })
    expect(await Doctors.access!.read!({ req })).toEqual({ clinic: { in: [11, 12] } })
  })

  it.each([DoctorSpecialties, DoctorTreatments])(
    'uses the same current target for controlled doctor references in $slug',
    async (collection) => {
      readClinicPrincipalAccess.mockResolvedValue({ staff: { id: 9 }, clinics: [{ id: 11 }, { id: 12 }] })
      const req = {
        user: { id: 9, collection: 'clinicStaff', clinic: null },
        payload: {},
        routeParams: { clinicId: '12' },
      } as unknown as PayloadRequest
      const field = collection.fields.find(
        (candidate): candidate is RelationshipField => candidate.type === 'relationship' && candidate.name === 'doctor',
      )
      if (!field || !('filterOptions' in field) || typeof field.filterOptions !== 'function')
        throw new Error('Doctor relationship filter is required.')
      expect(
        await field.filterOptions({
          req,
          data: {},
          siblingData: {},
          blockData: {},
          id: 'fixture',
          user: req.user,
          relationTo: 'doctors',
        }),
      ).toEqual({ clinic: { equals: 12 } })
    },
  )

  it('restricts the selected path even when another clinic is currently eligible', async () => {
    readClinicPrincipalAccess.mockResolvedValue({ staff: { id: 9 }, clinics: [{ id: 11 }, { id: 12 }] })
    const req = {
      user: { id: 9, collection: 'clinicStaff' },
      payload: { logger: { error: vi.fn() } },
      routeParams: { clinicId: '12' },
    } as unknown as PayloadRequest
    expect(await Doctors.access!.update!({ req })).toEqual({ clinic: { equals: 12 } })
    req.routeParams = { clinicId: '99' }
    expect(await Doctors.access!.update!({ req })).toBe(false)
  })
})
