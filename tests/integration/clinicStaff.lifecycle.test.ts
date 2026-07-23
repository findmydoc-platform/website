import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'
import { createClinicFixture } from '../fixtures/createClinicFixture'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { testSlug } from '../fixtures/testSlug'
import { deleteClinicSupabaseAccount, setClinicSupabaseAccountAccess } from '@/auth/utilities/supabaseProvision'
import { clinicStaffStatusTransitions, type ClinicStaffStatus } from '@/collections/clinicStaff/lifecycle'

const clinicStaffStatuses: readonly ClinicStaffStatus[] = ['pending', 'approved', 'rejected', 'disabled', 'offboarded']

describe('ClinicStaff lifecycle integration', () => {
  let payload: Payload
  let cityId: number
  const slugPrefix = testSlug('clinicStaff.lifecycle.test.ts')
  const staffIds: number[] = []
  const clinicIds: number[] = []

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
    const city = await payload.find({ collection: 'cities', limit: 1, overrideAccess: true })
    if (!city.docs[0]) throw new Error('Expected a baseline city')
    cityId = city.docs[0].id
  })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(deleteClinicSupabaseAccount).mockResolvedValue(undefined)
    vi.mocked(setClinicSupabaseAccountAccess).mockResolvedValue(undefined)
  })

  afterEach(async () => {
    while (staffIds.length) {
      const id = staffIds.pop()
      if (id) await payload.delete({ collection: 'clinicStaff', id, overrideAccess: true }).catch(() => undefined)
    }
    while (clinicIds.length) {
      const id = clinicIds.pop()
      if (id) await payload.delete({ collection: 'clinics', id, overrideAccess: true }).catch(() => undefined)
    }
  })

  it('synchronizes approval, disable, reactivation, and offboarding with Supabase', async () => {
    const { clinic } = await createClinicFixture(payload, cityId, { slugPrefix })
    clinicIds.push(clinic.id)
    const staff = await payload.create({
      collection: 'clinicStaff',
      data: {
        email: `${slugPrefix}-pending@example.com`,
        firstName: 'Clinic',
        lastName: 'Staff',
        status: 'pending',
        supabaseUserId: `sb-${slugPrefix}-pending`,
      },
      overrideAccess: true,
    })
    staffIds.push(staff.id)

    const approved = await payload.update({
      collection: 'clinicStaff',
      id: staff.id,
      data: { clinic: clinic.id, status: 'approved' },
      overrideAccess: true,
    })

    expect(approved.status).toBe('approved')
    expect(typeof approved.clinic === 'object' ? approved.clinic?.id : approved.clinic).toBe(clinic.id)
    expect(setClinicSupabaseAccountAccess).toHaveBeenLastCalledWith(
      { enabled: true, supabaseUserId: `sb-${slugPrefix}-pending` },
      expect.anything(),
    )

    await payload.update({
      collection: 'clinicStaff',
      id: staff.id,
      data: { status: 'disabled' },
      overrideAccess: true,
    })
    expect(setClinicSupabaseAccountAccess).toHaveBeenLastCalledWith(
      { enabled: false, supabaseUserId: `sb-${slugPrefix}-pending` },
      expect.anything(),
    )

    await payload.update({
      collection: 'clinicStaff',
      id: staff.id,
      data: { status: 'approved' },
      overrideAccess: true,
    })
    await payload.update({
      collection: 'clinicStaff',
      id: staff.id,
      data: { status: 'offboarded' },
      overrideAccess: true,
    })

    const offboarded = await payload.findByID({
      collection: 'clinicStaff',
      id: staff.id,
      overrideAccess: true,
      depth: 0,
    })
    expect(offboarded.status).toBe('offboarded')
    expect(offboarded.authSync).toEqual({ status: 'deleted', errorCode: null })
    expect(deleteClinicSupabaseAccount).toHaveBeenCalledWith(`sb-${slugPrefix}-pending`, expect.anything())
  })

  it('rejects invalid status transitions', async () => {
    const staff = await payload.create({
      collection: 'clinicStaff',
      data: {
        email: `${slugPrefix}-invalid-transition@example.com`,
        firstName: 'Clinic',
        lastName: 'Staff',
        status: 'pending',
        supabaseUserId: `sb-${slugPrefix}-invalid-transition`,
      },
      overrideAccess: true,
    })
    staffIds.push(staff.id)

    const invalidTransition = payload.update({
      collection: 'clinicStaff',
      id: staff.id,
      data: { status: 'disabled' },
      overrideAccess: true,
    })

    await expect(invalidTransition).rejects.toMatchObject({
      data: {
        errors: [expect.objectContaining({ path: 'status' })],
      },
      status: 400,
    })

    const unchanged = await payload.findByID({
      collection: 'clinicStaff',
      id: staff.id,
      overrideAccess: true,
      depth: 0,
    })
    expect(unchanged.status).toBe('pending')
  })

  it('enforces every allowed and forbidden status transition through the collection', async () => {
    for (const previousStatus of clinicStaffStatuses) {
      for (const nextStatus of clinicStaffStatuses) {
        if (nextStatus === previousStatus) continue

        const transitionStaff = await payload.create({
          collection: 'clinicStaff',
          data: {
            email: `${slugPrefix}-${previousStatus}-${nextStatus}@example.com`,
            firstName: 'Matrix',
            lastName: 'Staff',
            status: previousStatus,
            supabaseUserId: `sb-${slugPrefix}-${previousStatus}-${nextStatus}`,
          },
          overrideAccess: true,
          depth: 0,
        })
        staffIds.push(transitionStaff.id)

        const update = payload.update({
          collection: 'clinicStaff',
          id: transitionStaff.id,
          data: { status: nextStatus },
          overrideAccess: true,
          depth: 0,
        })
        const isAllowed = clinicStaffStatusTransitions[previousStatus].includes(nextStatus as never)

        if (isAllowed) {
          await expect(update).resolves.toMatchObject({ status: nextStatus })
        } else {
          await expect(update).rejects.toMatchObject({
            data: {
              errors: [expect.objectContaining({ path: 'status' })],
            },
            status: 400,
          })
          await expect(
            payload.findByID({
              collection: 'clinicStaff',
              id: transitionStaff.id,
              overrideAccess: true,
              depth: 0,
            }),
          ).resolves.toMatchObject({ status: previousStatus })
        }
      }
    }
  }, 45000)

  it('allows an unchanged status update without repeating a successful sync', async () => {
    const staff = await payload.create({
      collection: 'clinicStaff',
      data: {
        email: `${slugPrefix}-unchanged@example.com`,
        firstName: 'Unchanged',
        lastName: 'Staff',
        status: 'approved',
        supabaseUserId: `sb-${slugPrefix}-unchanged`,
      },
      overrideAccess: true,
      depth: 0,
    })
    staffIds.push(staff.id)
    vi.clearAllMocks()

    await expect(
      payload.update({
        collection: 'clinicStaff',
        id: staff.id,
        data: { lastName: 'Updated', status: 'approved' },
        overrideAccess: true,
      }),
    ).resolves.toMatchObject({ lastName: 'Updated', status: 'approved' })
    expect(setClinicSupabaseAccountAccess).not.toHaveBeenCalled()
  })

  it('stores and retries a resumable Supabase synchronization failure', async () => {
    const { clinic } = await createClinicFixture(payload, cityId, { slugPrefix: `${slugPrefix}-retry` })
    clinicIds.push(clinic.id)
    const staff = await payload.create({
      collection: 'clinicStaff',
      data: {
        clinic: clinic.id,
        email: `${slugPrefix}-retry@example.com`,
        firstName: 'Retry',
        lastName: 'Staff',
        status: 'pending',
        supabaseUserId: `sb-${slugPrefix}-retry`,
      },
      overrideAccess: true,
    })
    staffIds.push(staff.id)
    vi.mocked(setClinicSupabaseAccountAccess).mockRejectedValueOnce(new Error('temporary Supabase failure'))

    await payload.update({
      collection: 'clinicStaff',
      id: staff.id,
      data: { status: 'approved' },
      overrideAccess: true,
    })

    const failed = await payload.findByID({ collection: 'clinicStaff', id: staff.id, overrideAccess: true, depth: 0 })
    expect(failed.authSync).toEqual({ status: 'failed', errorCode: 'account_update_failed' })

    await payload.update({
      collection: 'clinicStaff',
      id: staff.id,
      data: { firstName: 'Retried' },
      overrideAccess: true,
    })

    const synced = await payload.findByID({ collection: 'clinicStaff', id: staff.id, overrideAccess: true, depth: 0 })
    expect(synced.authSync).toEqual({ status: 'synced', errorCode: null })
    expect(setClinicSupabaseAccountAccess).toHaveBeenCalledTimes(2)
  })

  it('rejects a duplicate Supabase identity', async () => {
    const identity = `sb-${slugPrefix}-duplicate`
    const first = await payload.create({
      collection: 'clinicStaff',
      data: {
        email: `${slugPrefix}-one@example.com`,
        firstName: 'One',
        lastName: 'Staff',
        status: 'pending',
        supabaseUserId: identity,
      },
      overrideAccess: true,
    })
    staffIds.push(first.id)

    await expect(
      payload.create({
        collection: 'clinicStaff',
        data: {
          email: `${slugPrefix}-two@example.com`,
          firstName: 'Two',
          lastName: 'Staff',
          status: 'pending',
          supabaseUserId: identity,
        },
        overrideAccess: true,
      }),
    ).rejects.toThrow(/already assigned|unique|duplicate/i)
  })
})
