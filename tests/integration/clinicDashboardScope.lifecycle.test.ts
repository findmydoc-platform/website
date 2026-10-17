import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createLocalReq, getPayload, type Payload, type PayloadRequest } from 'payload'
import config from '@payload-config'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { createClinicFixture } from '../fixtures/createClinicFixture'
import {
  asPayloadStaffUser,
  asClinicScopedPayloadUser,
  createClinicTestUser,
  createPlatformTestUser,
  cleanupTrackedUsers,
} from '../fixtures/testUsers'
import { testSlug } from '../fixtures/testSlug'
import { replaceClinicStaffAssignment } from '@/features/clinicGroups/staffAssignments'
import { clinicDashboardBootstrapGetHandler } from '@/endpoints/clinicDashboardBootstrap'
import { clinicDashboardReportingGetHandler } from '@/endpoints/clinicDashboardReporting'
import { revalidateClinicDashboardRequest } from '@/features/clinicDashboard/authorization'

const mocks = vi.hoisted(() => ({ validate: vi.fn() }))
// Identity and analytics are external systems; assignment and reporting use the real Payload/Postgres source.
vi.mock('@/auth/utilities/jwtValidation', async (original) => ({
  ...(await original<typeof import('@/auth/utilities/jwtValidation')>()),
  validateSupabaseBearerToken: mocks.validate,
}))
vi.mock('@/features/clinicDashboard/reporting/posthog', () => ({
  readPostHogClinicDashboardReporting: vi.fn().mockRejectedValue(new Error('analytics unavailable')),
}))

describe('clinic-scope-v1 source authorization', () => {
  let payload: Payload
  let operator: PayloadRequest
  const staffIds: Array<number | string> = []
  const clinicIds: number[] = []
  const doctorIds: number[] = []
  const groupIds: number[] = []
  const prefix = testSlug('clinicDashboardScope.lifecycle.test.ts')

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
    const platform = await createPlatformTestUser(payload, { emailPrefix: prefix })
    operator = await createLocalReq({ user: asPayloadStaffUser(platform) }, payload)
  })

  afterAll(async () => {
    await cleanupTrackedUsers(payload, { staffIds })
    for (const id of doctorIds) await payload.delete({ collection: 'doctors', id, overrideAccess: true })
    for (const id of clinicIds) await payload.delete({ collection: 'clinics', id, overrideAccess: true })
    for (const id of groupIds)
      await payload.delete({ collection: 'clinicGroups', id, req: operator, overrideAccess: false })
    await cleanupTrackedUsers(payload, { staffIds: [`platform:${operator.user!.id}`] })
  })

  it('revalidates local, group, disabled and revoked targets without changing the personal identity', async () => {
    const country = (
      await payload.find({
        collection: 'countries',
        where: { isoCode: { equals: 'TR' } },
        limit: 1,
        overrideAccess: true,
      })
    ).docs[0]!
    const city = (
      await payload.find({
        collection: 'cities',
        where: { country: { equals: country.id } },
        limit: 1,
        overrideAccess: true,
      })
    ).docs[0]!
    const network = await payload.create({
      collection: 'clinicGroups',
      data: { name: 'Reporting network' },
      req: operator,
      overrideAccess: false,
    })
    groupIds.push(network.id)
    const createClinic = async (name: string, group?: number) => {
      const result = await createClinicFixture(payload, city.id, { slugPrefix: `${prefix}-${name}` })
      clinicIds.push(result.clinic.id)
      doctorIds.push(result.doctor.id)
      return payload.update({
        collection: 'clinics',
        id: result.clinic.id,
        data: { name, participationStatus: 'approved', ...(group ? { group } : {}) },
        req: operator,
        overrideAccess: true,
        depth: 0,
      })
    }
    const first = await createClinic('Zeta', network.id)
    const second = await createClinic('Alpha', network.id)
    await payload.update({
      collection: 'clinics',
      id: second.id,
      data: {
        openingHours: Object.fromEntries(
          ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => [
            day,
            { isClosed: false, opensAt: '09:00', closesAt: '17:00' },
          ]),
        ),
      },
      req: operator,
      overrideAccess: true,
    })
    const foreign = await createClinic('Foreign')
    const staff = await createClinicTestUser(payload, { emailPrefix: prefix, createdStaffIds: staffIds })
    const user = await asClinicScopedPayloadUser(payload, staff, first.id)
    mocks.validate.mockResolvedValue({
      status: 'authenticated',
      authData: { userType: 'clinic', supabaseUserId: user.supabaseUserId },
    })
    const request = async (clinicId?: number) =>
      createLocalReq(
        {
          user,
          req: {
            headers: new Headers({
              Authorization: 'Bearer synthetic-personal-token',
              'X-Findmydoc-Clinic-Scope-Contract': 'clinic-scope-v1',
            }),
            routeParams: clinicId ? { clinicId: String(clinicId) } : {},
            searchParams: new URLSearchParams('periodDays=7'),
          },
        },
        payload,
      )
    const reporting = async (id: number) => clinicDashboardReportingGetHandler(await request(id))
    const bootstrap = async () => {
      const response = await clinicDashboardBootstrapGetHandler(await request())
      expect(response.status).toBe(200)
      return response.json()
    }

    expect((await bootstrap()).clinics.map(({ id }: { id: string }) => id)).toEqual([String(first.id)])
    const localReporting = await reporting(first.id)
    expect(localReporting.status).toBe(200)
    expect(await localReporting.json()).toMatchObject({ metrics: { profileCompleteness: { completedAreas: 2 } } })
    expect((await reporting(second.id)).status).toBe(403)
    await replaceClinicStaffAssignment(operator, staff.id, { scope: 'group', groupId: network.id })
    await expect(revalidateClinicDashboardRequest(await request(), 'legacy')).resolves.toEqual({
      status: 'access-denied',
    })
    expect(await bootstrap()).toMatchObject({
      schemaVersion: 'clinic-scope-v1',
      principal: { id: String(staff.id) },
      clinics: [
        { id: String(second.id), name: 'Alpha' },
        { id: String(first.id), name: 'Zeta' },
      ],
    })
    const selected = await reporting(second.id)
    expect(selected.status).toBe(200)
    expect(await selected.json()).toMatchObject({
      schemaVersion: 'clinic-dashboard-reporting-v1',
      metrics: {
        inquiries: { current: { value: 0 } },
        profileCompleteness: { completedAreas: 3 },
        profileViews: { current: { state: 'source_unavailable', value: null } },
      },
    })
    expect((await reporting(foreign.id)).status).toBe(403)

    await payload.update({
      collection: 'clinics',
      id: first.id,
      data: { participationStatus: 'disabled' },
      req: operator,
      overrideAccess: true,
    })
    expect((await reporting(first.id)).status).toBe(403)
    expect((await bootstrap()).clinics).toMatchObject([{ id: String(second.id), name: 'Alpha' }])
    await replaceClinicStaffAssignment(operator, staff.id, { scope: 'unassigned' })
    expect(await bootstrap()).toMatchObject({ principal: { id: String(staff.id) }, clinics: [] })
    expect((await reporting(second.id)).status).toBe(403)
    await payload.update({
      collection: 'clinicStaff',
      id: staff.id,
      data: { status: 'disabled' },
      overrideAccess: true,
      context: { skipClinicStaffAuthSync: true },
    })
    expect((await clinicDashboardBootstrapGetHandler(await request())).status).toBe(403)
  })
})
