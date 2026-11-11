import { NextRequest } from 'next/server'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { getPayload, handleEndpoints, type Payload } from 'payload'

import config from '@payload-config'
import { POST as prepareClinicInquiry } from '@/app/api/clinic-contact-requests/route'
import type { PreparationReceipt } from '@/features/inquiryPreparations/contracts'
import { createClinicFixture } from '../fixtures/createClinicFixture'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { testSlug } from '../fixtures/testSlug'

vi.mock('@/auth/utilities/supaBaseServer', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: null }, error: null }) },
  }),
}))

const origin = 'https://clinic-contact.test'
const makeGuestRequest = (body: unknown, cookie?: string) =>
  new NextRequest(`${origin}/api/clinic-contact-requests`, {
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      Origin: origin,
      ...(cookie ? { Cookie: cookie } : {}),
    },
    method: 'POST',
  })

const readPreparations = (cookie: string) =>
  handleEndpoints({
    config,
    request: new Request(`${origin}/api/patient/inquiry-preparations`, { headers: { Cookie: cookie } }),
  })

describe('anonymous clinic contact HTTP preparation', () => {
  let payload: Payload
  let clinicId: number
  let doctorId: number | string
  const slugPrefix = testSlug('inquiryCommunication.guest.test.ts')

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
    const city = (await payload.find({ collection: 'cities', depth: 0, limit: 1, overrideAccess: true })).docs[0]
    if (!city) throw new Error('Expected a baseline city for the anonymous clinic contact test.')

    const fixture = await createClinicFixture(payload, city.id, { slugPrefix })
    clinicId = fixture.clinic.id
    doctorId = fixture.doctor.id
    await payload.update({
      collection: 'clinics',
      data: { status: 'approved' },
      depth: 0,
      id: clinicId,
      overrideAccess: true,
    })
  }, 60_000)

  afterAll(async () => {
    await payload?.destroy()
  })

  const authorizedBody = (attempt: string) => ({
    clinicId: String(clinicId),
    doctorId: String(doctorId),
    idempotencyKey: `${slugPrefix}-${attempt}`,
    consent: true,
    accountAuthorization: true,
    email: `${slugPrefix}-${attempt}@example.com`,
    firstName: 'Synthetic',
    lastName: 'Patient',
    message: 'Synthetic private request that must not reach the clinic before account completion.',
    phoneNumber: '+493000000012',
    preferredContactWindow: 'morning',
    treatmentTimeline: 'within_two_weeks',
  })

  async function prepare(attempt: string) {
    const body = authorizedBody(attempt)
    const response = await prepareClinicInquiry(makeGuestRequest(body))
    expect(response.status).toBe(201)
    const receipt = (await response.json()) as PreparationReceipt
    const cookie = response.headers.get('set-cookie')!.split(';')[0]!
    return { body, cookie, receipt, response }
  }

  it('persists one private authorization per attempt and replays its unsent receipt without clinic work', async () => {
    const { body, cookie, receipt, response } = await prepare('authorized')
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(response.headers.get('set-cookie')).toContain('HttpOnly')
    expect(receipt).toEqual({
      authorizedAt: expect.any(String),
      clinicName: expect.any(String),
      expiresAt: expect.any(String),
      reference: expect.any(String),
      status: 'saved-not-sent',
    })
    expect(Date.parse(receipt.expiresAt) - Date.parse(receipt.authorizedAt)).toBe(604800000)

    const replayResponse = await prepareClinicInquiry(makeGuestRequest(body, cookie))
    expect(replayResponse.status).toBe(201)
    await expect(replayResponse.json()).resolves.toEqual(receipt)

    const nextAttempt = await prepareClinicInquiry(
      makeGuestRequest({ ...body, idempotencyKey: `${slugPrefix}-another-authorization` }, cookie),
    )
    expect(nextAttempt.status).toBe(201)
    const nextReceipt = (await nextAttempt.json()) as PreparationReceipt
    expect(nextReceipt.reference).not.toBe(receipt.reference)
    const resumed = await readPreparations(cookie)
    expect(resumed.status).toBe(200)
    await expect(resumed.json()).resolves.toEqual({
      nextCursor: null,
      preparations: [receipt, nextReceipt].map(({ authorizedAt, expiresAt, reference }) => ({
        authorizedAt,
        expiresAt,
        reference,
        status: 'saved-not-sent',
      })),
    })

    for (const collection of ['patientClinicInquiries', 'clinicNotificationOccurrences'] as const) {
      const result = await payload.count({
        collection,
        overrideAccess: true,
        where: { clinic: { equals: clinicId } },
      })
      expect(result.totalDocs).toBe(0)
    }
  })

  it('requires account authorization for each new attempt', async () => {
    const { body, cookie, receipt } = await prepare('requires-authorization')
    const response = await prepareClinicInquiry(
      makeGuestRequest(
        { ...body, idempotencyKey: `${slugPrefix}-not-authorized`, accountAuthorization: false },
        cookie,
      ),
    )
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'The prepared inquiry could not be processed.' })
    const resumed = await readPreparations(cookie)
    await expect(resumed.json()).resolves.toMatchObject({ preparations: [{ reference: receipt.reference }] })
  })

  it.each([
    ['doctor', { doctorId: '2147483647' }],
    ['treatment', { treatmentId: '2147483647' }],
  ] as const)('rejects an unavailable %s without adding a preparation', async (kind, target) => {
    const { body, cookie, receipt } = await prepare(`unavailable-${kind}`)
    const response = await prepareClinicInquiry(
      makeGuestRequest({ ...body, idempotencyKey: `${slugPrefix}-unavailable-${kind}-rejected`, ...target }, cookie),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'The prepared inquiry could not be processed.' })
    const resumed = await readPreparations(cookie)
    await expect(resumed.json()).resolves.toMatchObject({ preparations: [{ reference: receipt.reference }] })
  })

  it('rejects an expired session before creating a preparation', async () => {
    const { body, cookie, receipt } = await prepare('expired-session')
    const response = await prepareClinicInquiry(
      makeGuestRequest(
        { ...body, idempotencyKey: `${slugPrefix}-expired-session-rejected` },
        `${cookie}; sb-synthetic-auth-token=expired-session`,
      ),
    )

    expect(response.status).toBe(401)
    expect(await response.text()).toBe('')
    const resumed = await readPreparations(cookie)
    await expect(resumed.json()).resolves.toMatchObject({ preparations: [{ reference: receipt.reference }] })
  })
})
