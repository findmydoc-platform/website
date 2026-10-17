import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createLocalReq, getPayload, type Payload, type PayloadRequest } from 'payload'
import config from '@payload-config'
import { clinicDashboardBootstrapGetHandler } from '@/endpoints/clinicDashboardBootstrap'
import { clinicDashboardReportingGetHandler } from '@/endpoints/clinicDashboardReporting'
import { changeClinicGroup } from '@/features/clinicGroups/membership'
import { replaceClinicStaffAssignment } from '@/features/clinicGroups/staffAssignments'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { createClinicFixture } from '../fixtures/createClinicFixture'
import {
  asClinicScopedPayloadUser,
  asPayloadStaffUser,
  cleanupTrackedUsers,
  createClinicTestUser,
  createPlatformTestUser,
} from '../fixtures/testUsers'
import { testSlug } from '../fixtures/testSlug'

const identity = vi.hoisted(() => ({ validate: vi.fn() }))
// External identity and analytics are isolated; current source authorization uses native Payload/Postgres.
vi.mock('@/auth/utilities/jwtValidation', async (original) => ({
  ...(await original<typeof import('@/auth/utilities/jwtValidation')>()),
  validateSupabaseBearerToken: identity.validate,
}))
vi.mock('@/features/clinicDashboard/reporting/posthog', () => ({
  readPostHogClinicDashboardReporting: vi.fn().mockRejectedValue(new Error('Synthetic analytics outage')),
}))

describe('current source evidence for active clinic access recovery', () => {
  let payload: Payload
  let operator: PayloadRequest
  let manager: Awaited<ReturnType<typeof asClinicScopedPayloadUser>>
  let local: Awaited<ReturnType<typeof asClinicScopedPayloadUser>>
  let network: number
  let foreignNetwork: number
  let first: number
  let second: number
  const staffIds: Array<number | string> = []
  const clinicIds: number[] = []
  const doctorIds: number[] = []
  const prefix = testSlug('clinicAccessRecovery.lifecycle.test.ts')

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
    operator = await createLocalReq(
      { user: asPayloadStaffUser(await createPlatformTestUser(payload, { emailPrefix: prefix })) },
      payload,
    )
    network = (
      await payload.create({
        collection: 'clinicGroups',
        data: { name: 'Recovery network' },
        req: operator,
        overrideAccess: false,
      })
    ).id
    foreignNetwork = (
      await payload.create({
        collection: 'clinicGroups',
        data: { name: 'Other recovery network' },
        req: operator,
        overrideAccess: false,
      })
    ).id
    const city = (await payload.find({ collection: 'cities', limit: 1, overrideAccess: true })).docs[0]!
    const clinic = async (name: string) => {
      const fixture = await createClinicFixture(payload, city.id, { slugPrefix: `${prefix}-${name}` })
      clinicIds.push(fixture.clinic.id)
      doctorIds.push(fixture.doctor.id)
      await payload.update({
        collection: 'clinics',
        id: fixture.clinic.id,
        data: { name, participationStatus: 'approved', group: network },
        req: operator,
        overrideAccess: false,
      })
      return fixture.clinic.id
    }
    first = await clinic('Alpha recovery clinic')
    second = await clinic('Beta recovery clinic')
    manager = await asClinicScopedPayloadUser(
      payload,
      await createClinicTestUser(payload, { emailPrefix: `${prefix}-manager`, createdStaffIds: staffIds }),
      first,
    )
    local = await asClinicScopedPayloadUser(
      payload,
      await createClinicTestUser(payload, { emailPrefix: `${prefix}-local`, createdStaffIds: staffIds }),
      first,
    )
    await replaceClinicStaffAssignment(operator, Number(manager.id), { scope: 'group', groupId: network })
  }, 60_000)

  afterAll(async () => {
    try {
      await cleanupTrackedUsers(payload, { staffIds })
      for (const id of doctorIds) await payload.delete({ collection: 'doctors', id, overrideAccess: true })
      for (const id of clinicIds) await payload.delete({ collection: 'clinics', id, overrideAccess: true })
      for (const id of [network, foreignNetwork])
        await payload.delete({ collection: 'clinicGroups', id, req: operator, overrideAccess: false })
      await cleanupTrackedUsers(payload, { staffIds: [`platform:${operator.user!.id}`] })
    } finally {
      await payload?.db.destroy?.()
    }
  })

  const request = async (user = manager, clinicId?: number) => {
    identity.validate.mockResolvedValue({
      status: 'authenticated',
      authData: { userType: 'clinic', supabaseUserId: user.supabaseUserId },
    })
    return createLocalReq(
      {
        user,
        req: {
          headers: new Headers({
            Authorization: `Bearer ${randomUUID()}`,
            'X-Findmydoc-Clinic-Scope-Contract': 'clinic-scope-v1',
          }),
          routeParams: clinicId ? { clinicId: String(clinicId) } : {},
          searchParams: new URLSearchParams('periodDays=7'),
        },
      },
      payload,
    )
  }
  const choices = async () => {
    const response = await clinicDashboardBootstrapGetHandler(await request())
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    return response.json()
  }
  const denied = async (clinicId: number) => {
    const response = await clinicDashboardReportingGetHandler(await request(manager, clinicId))
    expect(response.status).toBe(403)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(await response.json()).toEqual({
      error: { code: 'CLINIC_DASHBOARD_ACCESS_DENIED', message: 'Reporting access is not available.' },
    })
  }

  it('rejects a departed group clinic and refreshes current choices while a local grant survives movement', async () => {
    expect((await choices()).clinics.map(({ id }: { id: string }) => id)).toEqual([String(first), String(second)])
    expect((await clinicDashboardReportingGetHandler(await request(manager, first))).status).toBe(200)
    try {
      await changeClinicGroup(operator, first, { fromGroupId: network, toGroupId: foreignNetwork })
      await denied(first)
      expect(await choices()).toMatchObject({
        principal: { id: String(manager.id) },
        clinics: [{ id: String(second), name: 'Beta recovery clinic' }],
      })
      expect((await clinicDashboardReportingGetHandler(await request(local, first))).status).toBe(200)
      await denied(first)
    } finally {
      const current = await payload.findByID({ collection: 'clinics', id: first, depth: 0, overrideAccess: true })
      const currentGroup = typeof current.group === 'object' ? current.group?.id : current.group
      if (currentGroup === foreignNetwork)
        await changeClinicGroup(operator, first, { fromGroupId: foreignNetwork, toGroupId: network })
    }
  })

  it('rejects stale assignment claims and returns fresh alternatives or approved empty choices for the same person', async () => {
    await replaceClinicStaffAssignment(operator, Number(manager.id), { scope: 'local', clinicId: second })
    await denied(first)
    expect(await choices()).toMatchObject({ principal: { id: String(manager.id) }, clinics: [{ id: String(second) }] })
    await replaceClinicStaffAssignment(operator, Number(manager.id), { scope: 'unassigned' })
    await denied(second)
    expect(await choices()).toMatchObject({
      schemaVersion: 'clinic-scope-v1',
      status: 'approved',
      principal: { id: String(manager.id) },
      clinics: [],
    })
  })
})
