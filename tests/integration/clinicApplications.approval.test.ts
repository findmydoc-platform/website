import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'
import { ensureBaseline } from '../fixtures/ensureBaseline'

describe('ClinicApplications approval integration (end-to-end)', () => {
  let payload: Payload

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
  })

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

  it('creates application -> approve -> provisions BasicUser, Clinic, ClinicStaff (idempotent on re-approval)', async () => {
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

    // 2) Approve the application — this should trigger provisioning via afterChange
    const approved = await (payload as any).update({
      collection: 'clinicApplications',
      id: app.id,
      data: { status: 'approved' },
      overrideAccess: true,
    })

    expect(approved.status).toBe('approved')
    // Refetch application to get createdArtifacts ids (poll for async materialization)
    const waitForArtifacts = async (maxMs = 12000) => {
      const start = Date.now()
      while (Date.now() - start < maxMs) {
        const a = await (payload as any).findByID({
          collection: 'clinicApplications',
          id: app.id,
          overrideAccess: true,
        })
        const ca = a?.createdArtifacts
        if (ca?.basicUser && ca?.clinic && ca?.clinicStaff && ca?.processedAt) return a
        await new Promise((r) => setTimeout(r, 150))
      }
      throw new Error('createdArtifacts not materialized in time')
    }
    const appAfter = await waitForArtifacts()

    const relToId = (v: any) => (v && typeof v === 'object' ? (v.id ?? v.value ?? v) : v)
    const initialUserId = relToId(appAfter.createdArtifacts.basicUser)
    const clinicId = relToId(appAfter.createdArtifacts.clinic)
    const clinicStaffId = relToId(appAfter.createdArtifacts.clinicStaff)

    // Verify BasicUser exists (by id, fallback to email), with tiny retry for consistency
    const tryFindBU = async () => {
      const byId = initialUserId
        ? await (payload as any).find({
            collection: 'basicUsers',
            where: { id: { equals: initialUserId } },
            limit: 1,
            overrideAccess: true,
          })
        : { docs: [] }
      if (byId.docs.length) return byId
      return (payload as any).find({
        collection: 'basicUsers',
        where: { email: { equals: 'integration.applicant@example.com' } },
        limit: 1,
        overrideAccess: true,
      })
    }
    let bu = await tryFindBU()
    if (!bu.docs.length) {
      await new Promise((r) => setTimeout(r, 150))
      bu = await tryFindBU()
    }
    expect(bu.docs.length).toBe(1)

    // Verify Clinic exists by id
    const clinic = await (payload as any).find({
      collection: 'clinics',
      where: { id: { equals: clinicId } },
      limit: 1,
      overrideAccess: true,
    })
    expect(clinic.docs.length).toBe(1)

    // Verify ClinicStaff exists and links user+clinic
    const staff = await (payload as any).find({
      collection: 'clinicStaff',
      where: {
        and: [{ id: { equals: clinicStaffId } }, { user: { equals: initialUserId } }, { clinic: { equals: clinicId } }],
      },
      limit: 1,
      overrideAccess: true,
    })
    expect(staff.docs.length).toBe(1)

    // 4) Re-approve should not create additional BasicUser (idempotent behavior)
    const approvedAgain = await (payload as any).update({
      collection: 'clinicApplications',
      id: app.id,
      data: { status: 'approved', reviewNotes: 'second pass' },
      overrideAccess: true,
    })
    expect(approvedAgain.status).toBe('approved')
    const appAfter2 = await (payload as any).findByID({
      collection: 'clinicApplications',
      id: app.id,
      overrideAccess: true,
    })
    const ca2 = appAfter2.createdArtifacts
    expect(relToId(ca2.basicUser)).toBe(initialUserId)
    expect(relToId(ca2.clinic)).toBe(clinicId)
    expect(relToId(ca2.clinicStaff)).toBe(clinicStaffId)
  }, 45000)
})
