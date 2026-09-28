import { isIP } from 'node:net'
import { NextRequest, NextResponse } from 'next/server'
import configPromise from '@/payload.config'
import { ClinicRegistrationSubmissionError, submitClinicRegistration } from '@/features/clinicRegistration/service'
import { postHogServerConsent, postHogServerEvents, resolveAnonymousPostHogActor } from '@/posthog/api'
import { createLocalReq, getPayload, type Payload } from 'payload'

type ClinicRegistrationContactRole = 'Medical Director' | 'Clinic Management' | 'International Office'

type MedicalSpecialtyLookup = {
  id: number
  name?: string | null
  parentSpecialty?: unknown
}

const MAXIMUM_REQUEST_BODY_BYTES = 32 * 1024
const MAXIMUM_CLINIC_NAME_LENGTH = 160
const MAXIMUM_CONTACT_NAME_LENGTH = 100
const MAXIMUM_CONTACT_EMAIL_LENGTH = 254
const MAXIMUM_CLINIC_WEBSITE_LENGTH = 2048
const MAXIMUM_MEDICAL_SPECIALTY_COUNT = 25
const ACCEPTED_RESPONSE = { success: true } as const
const RETRYABLE_FAILURE_RESPONSE = { error: 'Clinic registration could not be completed. Please try again.' } as const
const CONTACT_ROLE_VALUES = new Set<ClinicRegistrationContactRole>([
  'Medical Director',
  'Clinic Management',
  'International Office',
])
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const TRUSTED_FETCH_SITES = new Set(['same-origin', 'none'])

class RequestBodyTooLargeError extends Error {}

const readString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

const hasJsonMediaType = (req: NextRequest): boolean =>
  req.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() === 'application/json'

const hasTrustedBrowserOrigin = (req: NextRequest): boolean => {
  const fetchSite = req.headers.get('sec-fetch-site')?.trim().toLowerCase()
  if (fetchSite && !TRUSTED_FETCH_SITES.has(fetchSite)) return false

  const origin = req.headers.get('origin')
  if (!origin) return true

  try {
    return new URL(origin).origin === req.nextUrl.origin
  } catch {
    return false
  }
}

const readRequestBody = async (req: NextRequest): Promise<Record<string, unknown>> => {
  const declaredLength = req.headers.get('content-length')
  if (declaredLength && /^\d+$/.test(declaredLength) && Number(declaredLength) > MAXIMUM_REQUEST_BODY_BYTES) {
    throw new RequestBodyTooLargeError()
  }

  if (!req.body) return {}

  const reader = req.body.getReader()
  const chunks: Uint8Array[] = []
  let byteLength = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    byteLength += value.byteLength
    if (byteLength > MAXIMUM_REQUEST_BODY_BYTES) {
      await reader.cancel()
      throw new RequestBodyTooLargeError()
    }
    chunks.push(value)
  }

  const bytes = new Uint8Array(byteLength)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }

  const parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {}
}

const isContactRole = (value: string): value is ClinicRegistrationContactRole =>
  CONTACT_ROLE_VALUES.has(value as ClinicRegistrationContactRole)

const isPublicDomainHostname = (hostname: string): boolean => {
  const normalizedHostname = hostname.toLowerCase()

  if (
    normalizedHostname.length === 0 ||
    normalizedHostname.startsWith('.') ||
    normalizedHostname.endsWith('.') ||
    normalizedHostname.includes('..') ||
    !normalizedHostname.includes('.')
  ) {
    return false
  }

  if (
    normalizedHostname === 'localhost' ||
    normalizedHostname.endsWith('.localhost') ||
    normalizedHostname.endsWith('.local')
  ) {
    return false
  }

  return isIP(normalizedHostname.replace(/^\[(.*)\]$/, '$1')) === 0
}

const normalizeWebsite = (value: unknown): string | null => {
  const rawValue = readString(value)

  if (rawValue.length === 0 || rawValue.length > MAXIMUM_CLINIC_WEBSITE_LENGTH) {
    return null
  }

  if (rawValue.startsWith('//') || rawValue.startsWith('\\\\')) {
    return null
  }

  const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(rawValue) ? rawValue : `https://${rawValue}`

  try {
    const url = new URL(candidate)

    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username.length > 0 ||
      url.password.length > 0 ||
      !isPublicDomainHostname(url.hostname)
    ) {
      return null
    }

    const normalizedWebsite = url.toString()
    return normalizedWebsite.length <= MAXIMUM_CLINIC_WEBSITE_LENGTH ? normalizedWebsite : null
  } catch {
    return null
  }
}

const extractRelationId = (value: unknown): number | null => {
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

const readMedicalSpecialtyIds = (value: unknown): number[] | null => {
  if (!Array.isArray(value) || value.length > MAXIMUM_MEDICAL_SPECIALTY_COUNT) return null

  const ids = value
    .map((item) => (typeof item === 'number' ? item : typeof item === 'string' ? Number(item.trim()) : Number.NaN))
    .filter((item) => Number.isSafeInteger(item) && item > 0)

  const uniqueIds = [...new Set(ids)]
  return uniqueIds.length === value.length && uniqueIds.length > 0 ? uniqueIds : null
}

const captureClinicRegistrationSubmitted = async ({
  medicalSpecialtyCount,
  req,
  submissionId,
}: {
  medicalSpecialtyCount: number
  req: NextRequest
  submissionId: number | string
}): Promise<void> => {
  const analyticsConsent = await postHogServerConsent.resolveAnalyticsConsent({ headers: req.headers })
  if (!analyticsConsent.isAllowed) return

  await postHogServerEvents.registerClinicSubmitted({
    actor: resolveAnonymousPostHogActor({
      fallbackAnonymousId: `clinic_registration:${submissionId}`,
      headers: req.headers,
    }),
    analyticsConsent,
    flush: true,
    properties: {
      medical_specialty_count: medicalSpecialtyCount,
      source_route: 'clinic_registration',
      submission_status: 'created',
    },
  })
}

const captureClinicRegistrationSubmittedSafely = async (
  payload: Payload,
  input: Parameters<typeof captureClinicRegistrationSubmitted>[0],
): Promise<void> => {
  try {
    await captureClinicRegistrationSubmitted(input)
  } catch {
    payload.logger.warn(
      { applicationId: input.submissionId },
      'Clinic registration analytics failed after durable submission',
    )
  }
}

const registrationFailureCode = (error: unknown): string =>
  error instanceof ClinicRegistrationSubmissionError ? error.code : 'clinic-registration-request-failed'

// Public endpoint to submit a clinic application from the clinic registration funnel.
export async function POST(req: NextRequest) {
  if (!hasJsonMediaType(req)) {
    return NextResponse.json({ error: 'Unsupported media type' }, { status: 415 })
  }
  if (!hasTrustedBrowserOrigin(req)) {
    return NextResponse.json({ error: 'Cross-origin request forbidden' }, { status: 403 })
  }

  let body: Record<string, unknown> = {}

  try {
    body = await readRequestBody(req)
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ error: 'Request body too large' }, { status: 413 })
    }
  }

  const payload = await getPayload({ config: configPromise })

  try {
    const clinicName = readString(body.clinicName)
    if (clinicName.length === 0) {
      return NextResponse.json({ error: 'Clinic name is required' }, { status: 400 })
    }
    if (clinicName.length > MAXIMUM_CLINIC_NAME_LENGTH) {
      return NextResponse.json({ error: 'Invalid clinicName' }, { status: 400 })
    }

    const clinicWebsite = normalizeWebsite(body.clinicWebsite)
    if (!clinicWebsite) {
      return NextResponse.json({ error: 'Invalid clinicWebsite' }, { status: 400 })
    }

    const contactFirstName = readString(body.contactFirstName)
    if (contactFirstName.length === 0) {
      return NextResponse.json({ error: 'Contact first name is required' }, { status: 400 })
    }
    if (contactFirstName.length > MAXIMUM_CONTACT_NAME_LENGTH) {
      return NextResponse.json({ error: 'Invalid contactFirstName' }, { status: 400 })
    }

    const contactLastName = readString(body.contactLastName)
    if (contactLastName.length === 0) {
      return NextResponse.json({ error: 'Contact last name is required' }, { status: 400 })
    }
    if (contactLastName.length > MAXIMUM_CONTACT_NAME_LENGTH) {
      return NextResponse.json({ error: 'Invalid contactLastName' }, { status: 400 })
    }

    const contactEmail = readString(body.contactEmail).toLowerCase()
    if (
      contactEmail.length === 0 ||
      contactEmail.length > MAXIMUM_CONTACT_EMAIL_LENGTH ||
      !emailPattern.test(contactEmail)
    ) {
      return NextResponse.json({ error: 'Invalid contactEmail' }, { status: 400 })
    }

    const contactRole = readString(body.contactRole)
    if (!isContactRole(contactRole)) {
      return NextResponse.json({ error: 'Invalid contactRole' }, { status: 400 })
    }

    const medicalSpecialtyIds = readMedicalSpecialtyIds(body.medicalSpecialties)
    if (!medicalSpecialtyIds) {
      return NextResponse.json({ error: 'Invalid medicalSpecialties' }, { status: 400 })
    }

    const medicalSpecialtiesResult = await payload.find({
      collection: 'medical-specialties',
      depth: 0,
      limit: 1000,
      overrideAccess: false,
      pagination: false,
      select: {
        id: true,
        name: true,
        parentSpecialty: true,
      },
    })

    const specialtiesById = new Map(
      (medicalSpecialtiesResult.docs as MedicalSpecialtyLookup[]).map((specialty) => [specialty.id, specialty]),
    )
    const selectedSpecialties = medicalSpecialtyIds.map((id) => specialtiesById.get(id))

    if (
      selectedSpecialties.some((specialty) => !specialty) ||
      selectedSpecialties.some((specialty) => extractRelationId(specialty?.parentSpecialty) !== null)
    ) {
      return NextResponse.json({ error: 'Invalid medicalSpecialties' }, { status: 400 })
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || ''
    const userAgent = req.headers.get('user-agent') || ''

    try {
      const publicReq = await createLocalReq({ req: { headers: req.headers } }, payload)
      const submission = await submitClinicRegistration(publicReq, {
        clinicName,
        clinicWebsite,
        contactFirstName,
        contactLastName,
        contactEmail,
        contactRole,
        medicalSpecialtyIds,
        sourceMeta: { ip, userAgent },
      })

      payload.logger.info({ applicationId: submission.applicationId }, 'Clinic registration accepted')

      if (submission.created) {
        await captureClinicRegistrationSubmittedSafely(payload, {
          medicalSpecialtyCount: medicalSpecialtyIds.length,
          req,
          submissionId: submission.applicationId,
        })
      }

      return NextResponse.json(ACCEPTED_RESPONSE, { status: 202 })
    } catch (error: unknown) {
      payload.logger.error({ errorCode: registrationFailureCode(error) }, 'Clinic registration transaction failed')
      return NextResponse.json(RETRYABLE_FAILURE_RESPONSE, { status: 503 })
    }
  } catch (error: unknown) {
    payload.logger.error({ errorCode: registrationFailureCode(error) }, 'Clinic registration request failed')
    return NextResponse.json(RETRYABLE_FAILURE_RESPONSE, { status: 503 })
  }
}
