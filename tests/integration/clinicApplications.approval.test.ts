/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'
import { ensureBaseline } from '../fixtures/ensureBaseline'

describe('ClinicApplications approval integration (manual provisioning era)', () => {
  let payload: Payload

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
  }, 60000)

  afterEach(async () => {
    // cleanup only records created by this test
    const email = 'integration.applicant@example.com'
    try {
      const buFind = await (payload as any).find({
        collection: 'basicUsers',
        where: { email: { equals: email } },
        limit: 1,
        overrideAccess: true,
      })
      const bu = buFind.docs[0]
      if (bu?.id) {
        try {
          await (payload as any).delete({
            collection: 'clinicStaff',
            where: { user: { equals: bu.id } },
            overrideAccess: true,
          })
        } catch {}
        try {
          await (payload as any).delete({ collection: 'basicUsers', id: bu.id, overrideAccess: true })
        } catch {}
      }
    } catch {}
    try {
      await (payload as any).delete({
        collection: 'clinics',
        where: { slug: { like: 'integration-app-clinic-%' } },
        overrideAccess: true,
      })
    } catch {}
    try {
      await (payload as any).delete({
        collection: 'clinicApplications',
        where: { contactEmail: { equals: email } },
        overrideAccess: true,
      })
    } catch {}
  }, 30000)

  it('creates application and allows manual approval status change (no auto-provisioning)', async () => {
    // 1) Create submitted application
    const app = await (payload as any).create({
      collection: 'clinicApplications',
      data: {
        clinicName: 'Integration App Clinic',
        contactFirstName: 'Ivy',
        contactLastName: 'Tester',
        contactEmail: 'integration.applicant@example.com',
        contactPhone: '+10000000001',
        address: {
          street: 'Main',
          houseNumber: '1',
          zipCode: 34000,
          city: 'Istanbul',
          country: 'Turkey',
        },
        additionalNotes: 'E2E test run',
        status: 'submitted',
      },
      overrideAccess: true,
    })

    expect(app.id).toBeDefined()
    expect(app.status).toBe('submitted')
    // 2) Approve the application — this should NOT auto-provision artifacts anymore
    const approved = await (payload as any).update({
      collection: 'clinicApplications',
      id: app.id,
      data: { status: 'approved' },
      overrideAccess: true,
    })

    expect(approved.status).toBe('approved')
    // 3) Verify no auto-created artifacts exist
    const appAfter = await (payload as any).findByID({
      collection: 'clinicApplications',
      id: app.id,
      overrideAccess: true,
    })
    const links = appAfter?.linkedRecords
    expect(links?.basicUser ?? null).toBeFalsy()
    expect(links?.clinic ?? null).toBeFalsy()
    expect(links?.clinicStaff ?? null).toBeFalsy()
  }, 45000)
})
