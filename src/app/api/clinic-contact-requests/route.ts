import { NextRequest, NextResponse } from 'next/server'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { z } from 'zod'

const CONSENT_TEXT =
  'By submitting this request, you agree that findmydoc may process your contact details and request context to coordinate follow-up about this clinic inquiry.'

const numericIdSchema = z.preprocess((value) => {
  if (typeof value === 'string' && value.trim().length > 0) {
    return Number(value)
  }
  return value
}, z.number().int().positive())

const optionalNumericIdSchema = z.preprocess((value) => {
  if (value === null || value === undefined || value === '') return undefined
  if (typeof value === 'string' && value.trim().length > 0) return Number(value)
  return value
}, z.number().int().positive().optional())

const optionalTextSchema = (maxLength: number) =>
  z.preprocess((value) => {
    if (typeof value !== 'string') return undefined
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : undefined
  }, z.string().max(maxLength).optional())

const inquiryRequestSchema = z
  .object({
    clinicId: numericIdSchema,
    doctorId: optionalNumericIdSchema,
    treatmentId: optionalNumericIdSchema,
    fullName: z.string().trim().min(1, 'Full name is required.').max(200),
    email: z
      .string()
      .trim()
      .email('Email is invalid.')
      .max(254)
      .transform((value) => value.toLowerCase()),
    phoneNumber: z.string().trim().min(1, 'Phone number is required.').max(80),
    preferredDate: optionalTextSchema(40),
    preferredTime: optionalTextSchema(40),
    message: z.string().trim().min(1, 'Message is required.').max(5000),
    consent: z.boolean().optional().refine(Boolean, { message: 'Consent is required.' }),
    formUrl: optionalTextSchema(2048),
  })
  .refine((data) => Boolean(data.doctorId || data.treatmentId), {
    message: 'Select a doctor or treatment.',
  })

type ParsedInquiryRequest = z.infer<typeof inquiryRequestSchema>

function getClientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || ''
}

function getFirstValidationMessage(error: z.ZodError): string {
  return error.issues[0]?.message || 'Invalid request payload.'
}

function extractRelationId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  if (value && typeof value === 'object' && 'id' in value) {
    return extractRelationId((value as { id?: unknown }).id)
  }
  return null
}

function extractRelationName(value: unknown, field: string): string | null {
  if (!value || typeof value !== 'object') return null
  const raw = (value as Record<string, unknown>)[field]
  return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : null
}

async function findApprovedClinic(payload: Awaited<ReturnType<typeof getPayload>>, clinicId: number) {
  const result = await payload.find({
    collection: 'clinics',
    depth: 0,
    limit: 1,
    overrideAccess: false,
    pagination: false,
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
    },
    where: {
      and: [
        {
          id: {
            equals: clinicId,
          },
        },
        {
          status: {
            equals: 'approved',
          },
        },
      ],
    },
  })

  return result.docs[0] ?? null
}

async function resolveDoctorName(
  payload: Awaited<ReturnType<typeof getPayload>>,
  clinicId: number,
  doctorId: number | undefined,
): Promise<string | null> {
  if (!doctorId) return null

  const result = await payload.find({
    collection: 'doctors',
    depth: 0,
    limit: 1,
    overrideAccess: false,
    pagination: false,
    select: {
      id: true,
      fullName: true,
      clinic: true,
    },
    where: {
      and: [
        {
          id: {
            equals: doctorId,
          },
        },
        {
          clinic: {
            equals: clinicId,
          },
        },
      ],
    },
  })

  const doctor = result.docs[0]
  if (!doctor) return null

  return typeof doctor.fullName === 'string' && doctor.fullName.trim().length > 0 ? doctor.fullName.trim() : null
}

async function resolveTreatmentName(
  payload: Awaited<ReturnType<typeof getPayload>>,
  clinicId: number,
  treatmentId: number | undefined,
): Promise<string | null> {
  if (!treatmentId) return null

  const result = await payload.find({
    collection: 'clinictreatments',
    depth: 1,
    limit: 1,
    overrideAccess: false,
    pagination: false,
    select: {
      id: true,
      clinic: true,
      treatment: true,
    },
    where: {
      and: [
        {
          clinic: {
            equals: clinicId,
          },
        },
        {
          treatment: {
            equals: treatmentId,
          },
        },
      ],
    },
  })

  const clinicTreatment = result.docs[0]
  if (!clinicTreatment) return null

  const relationId = extractRelationId(clinicTreatment.treatment)
  if (relationId !== treatmentId) return null

  const relationName = extractRelationName(clinicTreatment.treatment, 'name')
  if (relationName) return relationName

  const treatment = await payload.findByID({
    collection: 'treatments',
    id: treatmentId,
    depth: 0,
    overrideAccess: false,
    select: {
      id: true,
      name: true,
    },
  })

  return typeof treatment.name === 'string' && treatment.name.trim().length > 0 ? treatment.name.trim() : null
}

function buildFormUrl(request: NextRequest, data: ParsedInquiryRequest, clinicSlug?: string | null): string {
  const referer = request.headers.get('referer')
  if (referer) return referer

  if (data.formUrl) return data.formUrl

  return clinicSlug ? `/clinics/${encodeURIComponent(clinicSlug)}` : '/clinics'
}

function serializeError(error: unknown): { name?: string; message: string } {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    }
  }

  return { message: 'Unknown clinic contact request error.' }
}

export async function POST(request: NextRequest) {
  const payload = await getPayload({ config: configPromise })
  const body = await request.json().catch(() => ({}))
  const parsed = inquiryRequestSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: getFirstValidationMessage(parsed.error) }, { status: 400 })
  }

  try {
    const clinic = await findApprovedClinic(payload, parsed.data.clinicId)
    if (!clinic) {
      return NextResponse.json({ error: 'Clinic not found.' }, { status: 404 })
    }

    const [doctorName, treatmentName] = await Promise.all([
      resolveDoctorName(payload, clinic.id, parsed.data.doctorId),
      resolveTreatmentName(payload, clinic.id, parsed.data.treatmentId),
    ])

    if (parsed.data.doctorId && !doctorName) {
      return NextResponse.json({ error: 'Doctor is not available for this clinic.' }, { status: 400 })
    }

    if (parsed.data.treatmentId && !treatmentName) {
      return NextResponse.json({ error: 'Treatment is not available for this clinic.' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const inquiry = await payload.create({
      collection: 'patientClinicInquiries',
      data: {
        clinic: clinic.id,
        clinicNameSnapshot: clinic.name,
        doctor: parsed.data.doctorId ?? null,
        doctorNameSnapshot: doctorName,
        treatment: parsed.data.treatmentId ?? null,
        treatmentNameSnapshot: treatmentName,
        fullName: parsed.data.fullName,
        email: parsed.data.email,
        phoneNumber: parsed.data.phoneNumber,
        preferredDate: parsed.data.preferredDate ?? null,
        preferredTime: parsed.data.preferredTime ?? null,
        message: parsed.data.message,
        consent: {
          accepted: true,
          acceptedAt: now,
          text: CONSENT_TEXT,
        },
        status: 'submitted',
        nextStep: 'platform-review',
        source: 'clinic_profile',
        formUrl: buildFormUrl(request, parsed.data, typeof clinic.slug === 'string' ? clinic.slug : null),
        sourceMeta: {
          ip: getClientIp(request),
          userAgent: request.headers.get('user-agent') || '',
        },
        syncStatus: 'not_configured',
      },
      overrideAccess: true,
      depth: 0,
    })

    payload.logger.info({ inquiryId: inquiry.id, clinicId: clinic.id }, 'Patient clinic inquiry submitted')

    return NextResponse.json({
      success: true,
      id: inquiry.id,
      status: inquiry.status,
    })
  } catch (error: unknown) {
    payload.logger.error({ error: serializeError(error) }, 'Patient clinic inquiry submission failed')
    return NextResponse.json({ error: 'Could not submit clinic request.' }, { status: 500 })
  }
}
