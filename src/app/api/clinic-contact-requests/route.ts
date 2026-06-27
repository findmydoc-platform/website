import { NextRequest, NextResponse } from 'next/server'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { z } from 'zod'
import { createHash } from 'node:crypto'

import {
  patientClinicInquiryContactWindowValues,
  patientClinicInquiryTreatmentTimelineValues,
} from '@/collections/PatientClinicInquiries'
import { getCurrentIsoTimestampString, parseTimestampStringToMs } from '@/utilities/timestamps'

const CONSENT_TEXT =
  'By submitting this request, you agree that findmydoc may process your contact details to coordinate follow-up about this clinic inquiry.'

const DUPLICATE_INQUIRY_WINDOW_MS = 15 * 60 * 1000

const inProcessDuplicateLocks = new Map<string, Promise<void>>()

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

const optionalEnumSchema = <T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess((value) => {
    if (value === null || value === undefined || value === '') return undefined
    return value
  }, z.enum(values).optional())

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
    treatmentTimeline: optionalEnumSchema(patientClinicInquiryTreatmentTimelineValues),
    preferredContactWindow: optionalEnumSchema(patientClinicInquiryContactWindowValues),
    message: z.string().trim().min(1, 'Message is required.').max(5000),
    consent: z.boolean().optional().refine(Boolean, { message: 'Consent is required.' }),
  })
  .refine((data) => Boolean(data.doctorId || data.treatmentId), {
    message: 'Select a doctor or treatment.',
  })

type InquiryRequestData = z.infer<typeof inquiryRequestSchema>
type PayloadClient = Awaited<ReturnType<typeof getPayload>>
type AdvisoryLockClient = {
  query: (query: string, params: [number, number]) => Promise<unknown>
  release: () => void
}
type AdvisoryLockPool = {
  connect: () => Promise<AdvisoryLockClient>
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

function normalizeOptionalRelationId(value: unknown): number | null {
  return extractRelationId(value)
}

function normalizeOptionalText(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function buildDuplicateFingerprint(data: InquiryRequestData): string {
  return JSON.stringify({
    clinicId: data.clinicId,
    doctorId: data.doctorId ?? null,
    treatmentId: data.treatmentId ?? null,
    fullName: data.fullName,
    email: data.email,
    phoneNumber: data.phoneNumber,
    treatmentTimeline: data.treatmentTimeline ?? null,
    preferredContactWindow: data.preferredContactWindow ?? null,
    message: data.message,
  })
}

function toAdvisoryLockKeys(fingerprint: string): [number, number] {
  const digest = createHash('sha256').update(fingerprint).digest()
  return [digest.readInt32BE(0), digest.readInt32BE(4)]
}

function getAdvisoryLockPool(payload: PayloadClient): AdvisoryLockPool | null {
  const pool = (payload as unknown as { db?: { pool?: unknown } }).db?.pool
  if (!pool || typeof pool !== 'object' || !('connect' in pool) || typeof pool.connect !== 'function') {
    return null
  }

  return pool as AdvisoryLockPool
}

async function withInProcessDuplicateLock<T>(fingerprint: string, action: () => Promise<T>): Promise<T> {
  while (true) {
    const existingLock = inProcessDuplicateLocks.get(fingerprint)
    if (!existingLock) break
    await existingLock
  }

  let releaseLock!: () => void
  const lock = new Promise<void>((resolve) => {
    releaseLock = resolve
  })
  inProcessDuplicateLocks.set(fingerprint, lock)

  try {
    return await action()
  } finally {
    if (inProcessDuplicateLocks.get(fingerprint) === lock) {
      inProcessDuplicateLocks.delete(fingerprint)
    }
    releaseLock()
  }
}

async function withDuplicateLock<T>(payload: PayloadClient, fingerprint: string, action: () => Promise<T>): Promise<T> {
  const pool = getAdvisoryLockPool(payload)

  if (!pool) {
    return withInProcessDuplicateLock(fingerprint, action)
  }

  const client = await pool.connect()
  const lockKeys = toAdvisoryLockKeys(fingerprint)

  try {
    await client.query('select pg_advisory_lock($1, $2)', lockKeys)
    return await action()
  } finally {
    try {
      await client.query('select pg_advisory_unlock($1, $2)', lockKeys)
    } catch (error: unknown) {
      payload.logger.warn({ error: serializeError(error) }, 'Patient clinic inquiry duplicate lock release failed')
    }
    client.release()
  }
}

function isWithinDuplicateWindow(createdAt: unknown, now = Date.now()): boolean {
  const createdAtMs = parseTimestampStringToMs(createdAt)
  if (createdAtMs === undefined) return false

  return now - createdAtMs <= DUPLICATE_INQUIRY_WINDOW_MS
}

function inquiryMatchesFingerprint(candidate: Record<string, unknown>, data: InquiryRequestData): boolean {
  return (
    normalizeOptionalRelationId(candidate.doctor) === (data.doctorId ?? null) &&
    normalizeOptionalRelationId(candidate.treatment) === (data.treatmentId ?? null) &&
    normalizeOptionalText(candidate.fullName) === data.fullName &&
    normalizeOptionalText(candidate.phoneNumber) === data.phoneNumber &&
    normalizeOptionalText(candidate.message) === data.message &&
    normalizeOptionalText(candidate.treatmentTimeline) === (data.treatmentTimeline ?? null) &&
    normalizeOptionalText(candidate.preferredContactWindow) === (data.preferredContactWindow ?? null)
  )
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

async function isDoctorAvailableForClinic(
  payload: Awaited<ReturnType<typeof getPayload>>,
  clinicId: number,
  doctorId: number | undefined,
): Promise<boolean> {
  if (!doctorId) return false

  const result = await payload.find({
    collection: 'doctors',
    depth: 0,
    limit: 1,
    overrideAccess: false,
    pagination: false,
    select: {
      id: true,
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

  return Boolean(result.docs[0])
}

async function isTreatmentAvailableForClinic(
  payload: Awaited<ReturnType<typeof getPayload>>,
  clinicId: number,
  treatmentId: number | undefined,
): Promise<boolean> {
  if (!treatmentId) return false

  const result = await payload.find({
    collection: 'clinictreatments',
    depth: 0,
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
  if (!clinicTreatment) return false

  const relationId = extractRelationId(clinicTreatment.treatment)
  return relationId === treatmentId
}

async function findDuplicateInquiry(
  payload: Awaited<ReturnType<typeof getPayload>>,
  data: InquiryRequestData,
): Promise<{ id: number; status: string } | null> {
  const result = await payload.find({
    collection: 'patientClinicInquiries',
    depth: 0,
    limit: 50,
    overrideAccess: true,
    pagination: false,
    sort: '-createdAt',
    select: {
      id: true,
      doctor: true,
      treatment: true,
      email: true,
      fullName: true,
      phoneNumber: true,
      treatmentTimeline: true,
      preferredContactWindow: true,
      message: true,
      status: true,
      createdAt: true,
    },
    where: {
      and: [
        {
          clinic: {
            equals: data.clinicId,
          },
        },
        {
          email: {
            equals: data.email,
          },
        },
      ],
    },
  })

  const duplicate = result.docs.find((doc) => {
    const candidate = doc as unknown as Record<string, unknown>
    return isWithinDuplicateWindow(candidate.createdAt) && inquiryMatchesFingerprint(candidate, data)
  })

  if (!duplicate) return null

  return {
    id: duplicate.id,
    status: typeof duplicate.status === 'string' ? duplicate.status : 'submitted',
  }
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

    const [doctorAvailable, treatmentAvailable] = await Promise.all([
      isDoctorAvailableForClinic(payload, clinic.id, parsed.data.doctorId),
      isTreatmentAvailableForClinic(payload, clinic.id, parsed.data.treatmentId),
    ])

    if (parsed.data.doctorId && !doctorAvailable) {
      return NextResponse.json({ error: 'Doctor is not available for this clinic.' }, { status: 400 })
    }

    if (parsed.data.treatmentId && !treatmentAvailable) {
      return NextResponse.json({ error: 'Treatment is not available for this clinic.' }, { status: 400 })
    }

    return await withDuplicateLock(payload, buildDuplicateFingerprint(parsed.data), async () => {
      const duplicateInquiry = await findDuplicateInquiry(payload, parsed.data)
      if (duplicateInquiry) {
        payload.logger.info(
          { inquiryId: duplicateInquiry.id, clinicId: clinic.id },
          'Patient clinic inquiry duplicate submission ignored',
        )

        return NextResponse.json({
          success: true,
          id: duplicateInquiry.id,
          status: duplicateInquiry.status,
          deduped: true,
        })
      }

      const now = getCurrentIsoTimestampString()
      const inquiry = await payload.create({
        collection: 'patientClinicInquiries',
        data: {
          clinic: clinic.id,
          doctor: parsed.data.doctorId ?? null,
          treatment: parsed.data.treatmentId ?? null,
          fullName: parsed.data.fullName,
          email: parsed.data.email,
          phoneNumber: parsed.data.phoneNumber,
          treatmentTimeline: parsed.data.treatmentTimeline ?? null,
          preferredContactWindow: parsed.data.preferredContactWindow ?? null,
          message: parsed.data.message,
          consent: {
            accepted: true,
            acceptedAt: now,
            text: CONSENT_TEXT,
          },
          status: 'submitted',
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
    })
  } catch (error: unknown) {
    payload.logger.error({ error: serializeError(error) }, 'Patient clinic inquiry submission failed')
    return NextResponse.json({ error: 'Could not submit clinic request.' }, { status: 500 })
  }
}
