import { NextRequest, NextResponse } from 'next/server'
import configPromise from '@/payload.config'
import { postHogServerConsent, postHogServerEvents, resolveAnonymousPostHogActor } from '@/posthog/api'
import { getPayload } from 'payload'

type ClinicRegistrationSubmissionStatus = 'created' | 'deduped'

const TURKEY_COUNTRY_NAME = 'Turkey'

const readString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

const normalizeCountryName = (value: string): string =>
  value
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

const normalizeCountry = (value: unknown): string | null => {
  const country = readString(value)
  if (country.length === 0) {
    return TURKEY_COUNTRY_NAME
  }

  const normalizedCountry = normalizeCountryName(country)

  if (normalizedCountry === 'turkey' || normalizedCountry === 'turkiye' || normalizedCountry === 'tr') {
    return TURKEY_COUNTRY_NAME
  }

  return null
}

const captureClinicRegistrationSubmitted = async ({
  body,
  country,
  req,
  submissionId,
  submissionStatus,
}: {
  body: Record<string, unknown>
  country: string
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
      country,
      has_additional_notes: readString(body.additionalNotes).length > 0,
      has_contact_phone: readString(body.contactPhone).length > 0,
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

    const country = normalizeCountry(body.country)
    if (!country) {
      return NextResponse.json({ error: 'Clinic registrations are currently limited to Turkey' }, { status: 400 })
    }

    const cityId = readString(body.cityId)
    let city = readString(body.city)

    if (cityId.length > 0) {
      const countryResult = await payload.find({
        collection: 'countries',
        depth: 0,
        limit: 1,
        overrideAccess: false,
        pagination: false,
        where: {
          isoCode: {
            equals: 'TR',
          },
        },
      })

      const turkeyCountry = countryResult.docs[0] as { id?: string | number } | undefined
      if (!turkeyCountry?.id) {
        return NextResponse.json({ error: 'City is not available for Turkey' }, { status: 400 })
      }

      const cityResult = await payload.find({
        collection: 'cities',
        depth: 0,
        limit: 1,
        overrideAccess: false,
        pagination: false,
        select: {
          id: true,
          name: true,
        },
        where: {
          and: [
            {
              id: {
                equals: cityId,
              },
            },
            {
              country: {
                equals: turkeyCountry.id,
              },
            },
          ],
        },
      })

      const matchedCity = cityResult.docs[0] as { name?: string | null } | undefined
      city = typeof matchedCity?.name === 'string' ? matchedCity.name.trim() : ''

      if (city.length === 0) {
        return NextResponse.json({ error: 'City is not available for Turkey' }, { status: 400 })
      }
    }

    if (city.length === 0) {
      return NextResponse.json({ error: 'City is required' }, { status: 400 })
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
        country,
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
          city,
          country,
        },
        additionalNotes: body.additionalNotes as string,
        status: 'submitted',
        sourceMeta: { ip, userAgent },
      },
    })

    payload.logger.info({ msg: 'clinicApplications: submitted', applicationId: application.id })

    await captureClinicRegistrationSubmitted({
      body,
      country,
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
