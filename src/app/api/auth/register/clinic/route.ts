import { NextRequest, NextResponse } from 'next/server'
import configPromise from '@/payload.config'
import { postHogServerConsent, postHogServerEvents, resolveAnonymousPostHogActor } from '@/posthog/api'
import { getPayload } from 'payload'

type ClinicRegistrationSubmissionStatus = 'created' | 'deduped'

const REGISTER_CLINIC_DEFAULT_COUNTRY = 'Turkey'
const REGISTER_CLINIC_COUNTRY_ALLOWLIST = new Set([REGISTER_CLINIC_DEFAULT_COUNTRY])

const readStringBodyField = (body: Record<string, unknown>, field: string): string | undefined => {
  const value = body[field]
  if (typeof value !== 'string') return undefined

  const normalized = value.trim()
  return normalized || undefined
}

const readAllowedCountry = (body: Record<string, unknown>): string | undefined => {
  const country = readStringBodyField(body, 'country') ?? REGISTER_CLINIC_DEFAULT_COUNTRY
  return REGISTER_CLINIC_COUNTRY_ALLOWLIST.has(country) ? country : undefined
}

const captureClinicRegistrationSubmitted = async ({
  body,
  req,
  submissionId,
  submissionStatus,
}: {
  body: Record<string, unknown>
  req: NextRequest
  submissionId: number | string
  submissionStatus: ClinicRegistrationSubmissionStatus
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
      country: readAllowedCountry(body),
      has_additional_notes: readStringBodyField(body, 'additionalNotes') !== undefined,
      has_contact_phone: readStringBodyField(body, 'contactPhone') !== undefined,
      source_route: 'clinic_registration',
      submission_status: submissionStatus,
    },
  })
}

// Public endpoint to submit a clinic application (clinic registration)
export async function POST(req: NextRequest) {
  const payload = await getPayload({ config: configPromise })
  let body: Record<string, unknown> = {}

  try {
    body = await req.json().catch(() => ({}))
    const zipCodeInput = body.zipCode
    const zipCode =
      typeof zipCodeInput === 'number'
        ? zipCodeInput
        : typeof zipCodeInput === 'string'
          ? /^\d+$/.test(zipCodeInput.trim())
            ? Number.parseInt(zipCodeInput.trim(), 10)
            : Number.NaN
          : Number.NaN

    if (!Number.isInteger(zipCode) || zipCode <= 0) {
      return NextResponse.json({ error: 'Invalid zipCode' }, { status: 400 })
    }

    // Dedupe: existing submitted application with same clinicName + email (lightweight, optional)
    const existing = await payload.find({
      collection: 'clinicApplications',
      where: {
        and: [
          { clinicName: { equals: body.clinicName } },
          { contactEmail: { equals: (body.contactEmail as string)?.toLowerCase?.() ?? '' } },
          { status: { equals: 'submitted' } },
        ],
      },
      limit: 1,
      overrideAccess: true,
    })
    const existingDoc = existing.docs[0]
    if (existingDoc) {
      await captureClinicRegistrationSubmitted({
        body,
        req,
        submissionId: existingDoc.id,
        submissionStatus: 'deduped',
      })
      return NextResponse.json({ success: true, id: existingDoc.id, dedupe: true }, { status: 202 })
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || ''
    const userAgent = req.headers.get('user-agent') || ''

    const application = await payload.create({
      collection: 'clinicApplications',
      data: {
        clinicName: body.clinicName as string,
        contactFirstName: body.contactFirstName as string,
        contactLastName: body.contactLastName as string,
        contactEmail: (body.contactEmail as string)?.toLowerCase?.(),
        contactPhone: body.contactPhone as string,
        address: {
          street: body.street as string,
          houseNumber: body.houseNumber as string,
          zipCode,
          city: body.city as string,
          country: (body.country as string) || 'Turkey',
        },
        additionalNotes: body.additionalNotes as string,
        status: 'submitted',
        sourceMeta: { ip, userAgent },
      },
    })

    payload.logger.info({ msg: 'clinicApplications: submitted', applicationId: application.id })

    await captureClinicRegistrationSubmitted({
      body,
      req,
      submissionId: application.id,
      submissionStatus: 'created',
    })

    return NextResponse.json({ success: true, id: application.id })
  } catch (error: unknown) {
    payload.logger.error(
      { error, clinicName: body?.clinicName, contactEmail: body?.contactEmail },
      'Clinic registration submission failed',
    )
    return NextResponse.json({ error: 'Clinic registration failed' }, { status: 500 })
  }
}
