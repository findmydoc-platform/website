import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockPayload, createMockReq } from '../helpers/testHelpers'

const mocks = vi.hoisted(() => ({
  patientInquiryCreated: vi.fn(),
  resolveAnalyticsConsent: vi.fn(),
  resolveAnonymousPostHogActor: vi.fn(),
}))

vi.mock('@/posthog/api', () => ({
  postHogServerConsent: { resolveAnalyticsConsent: mocks.resolveAnalyticsConsent },
  postHogServerEvents: { patientInquiryCreated: mocks.patientInquiryCreated },
  resolveAnonymousPostHogActor: mocks.resolveAnonymousPostHogActor,
}))

import { captureStoredPatientInquiryPostHogEvent } from '@/posthog/inquiry'

describe('stored patient inquiry PostHog capture', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.resolveAnalyticsConsent.mockResolvedValue({ isAllowed: true })
    mocks.resolveAnonymousPostHogActor.mockReturnValue({ distinctId: 'server-actor' })
  })

  it('derives clinic fields from the durable inquiry and forwards a bounded session only after consent', async () => {
    const payload = createMockPayload()
    payload.find.mockImplementation(async ({ collection }: { collection: string }) => {
      if (collection === 'patientClinicInquiries') {
        return {
          docs: [
            { clinic: 'stored-clinic', doctor: 'stored-doctor', message: 'private', treatment: 'stored-treatment' },
          ],
        }
      }
      if (collection === 'clinics') return { docs: [{ slug: 'stored-clinic-slug' }] }
      return { docs: [] }
    })
    const req = createMockReq(null, payload, { headers: new Headers({ Cookie: 'ph_test=ignored' }) })

    await captureStoredPatientInquiryPostHogEvent({ inquiryId: 'stored-inquiry', req, sessionId: 'session_42' })

    expect(mocks.patientInquiryCreated).toHaveBeenCalledWith(
      expect.objectContaining({
        properties: expect.objectContaining({
          $session_id: 'session_42',
          clinic_id: 'stored-clinic',
          clinic_slug: 'stored-clinic-slug',
          doctor_id: 'stored-doctor',
          treatment_id: 'stored-treatment',
        }),
      }),
    )
    expect(payload.find).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'patientClinicInquiries', where: { id: { equals: 'stored-inquiry' } } }),
    )
  })

  it('does not forward a session when analytics consent is absent', async () => {
    mocks.resolveAnalyticsConsent.mockResolvedValueOnce({ isAllowed: false })
    const payload = createMockPayload()

    await captureStoredPatientInquiryPostHogEvent({
      inquiryId: 'stored-inquiry',
      req: createMockReq(null, payload),
      sessionId: 'session_42',
    })

    expect(payload.find).not.toHaveBeenCalled()
    expect(mocks.patientInquiryCreated).not.toHaveBeenCalled()
  })
})
