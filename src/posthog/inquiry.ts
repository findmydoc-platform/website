import type { PayloadRequest } from 'payload'
import { readClinicInquirySessionId } from '@/features/clinicDashboard/reporting/sessionCorrelation'
import { postHogServerConsent, postHogServerEvents, resolveAnonymousPostHogActor } from './api'

type RecordValue = Record<string, unknown>

const asRecord = (value: unknown): RecordValue | undefined =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as RecordValue) : undefined

const relationId = (value: unknown): string | undefined => {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  const record = asRecord(value)
  return record && (typeof record.id === 'string' || typeof record.id === 'number') ? String(record.id) : undefined
}

const findOne = async (req: PayloadRequest, collection: 'clinics' | 'patientClinicInquiries', id: string) => {
  const result = await req.payload.find({
    collection,
    depth: 0,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    req,
    where: { id: { equals: id } },
  })
  return asRecord(result.docs[0])
}

/**
 * Reads the server-stored inquiry before emitting analytics. The correlation value
 * remains in-memory only and is intentionally absent from logs and response DTOs.
 */
export const captureStoredPatientInquiryPostHogEvent = async ({
  inquiryId,
  req,
  sessionId,
}: {
  inquiryId: string
  req: PayloadRequest
  sessionId: string | undefined
}): Promise<void> => {
  try {
    const analyticsConsent = await postHogServerConsent.resolveAnalyticsConsent({ headers: req.headers })
    if (!analyticsConsent.isAllowed) return

    const inquiry = await findOne(req, 'patientClinicInquiries', inquiryId)
    const clinicId = relationId(inquiry?.clinic)
    if (!inquiry || !clinicId) return
    const clinic = await findOne(req, 'clinics', clinicId)
    if (!clinic || typeof clinic.slug !== 'string' || !clinic.slug.trim()) return

    const doctorId = relationId(inquiry.doctor)
    const treatmentId = relationId(inquiry.treatment)
    const correlation = readClinicInquirySessionId(sessionId)
    await postHogServerEvents.patientInquiryCreated({
      actor: resolveAnonymousPostHogActor({
        fallbackAnonymousId: `patient_inquiry:${inquiryId}`,
        headers: req.headers,
      }),
      analyticsConsent,
      flush: true,
      properties: {
        ...(correlation ? { $session_id: correlation } : {}),
        clinic_id: clinicId,
        clinic_slug: clinic.slug,
        doctor_id: doctorId,
        form_slug: 'clinic-contact-request',
        has_doctor: doctorId !== undefined,
        has_message: typeof inquiry.message === 'string' && inquiry.message.trim().length > 0,
        has_preferred_date: false,
        has_preferred_time: false,
        has_treatment: treatmentId !== undefined,
        source_route: 'clinic_detail',
        submission_id: inquiryId,
        treatment_id: treatmentId,
      },
    })
  } catch {
    req.payload.logger.warn(
      { event: 'telemetry.posthog.patient_inquiry_capture_skipped' },
      'Patient inquiry analytics capture skipped; continuing',
    )
  }
}
