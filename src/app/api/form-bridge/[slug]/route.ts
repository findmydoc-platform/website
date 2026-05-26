import { getForm } from '@/utilities/getForm'
import { getServerLogger } from '@/utilities/logging/serverLogger'
import { createScopedLogger, getRequestLogContext, toLoggedError } from '@/utilities/logging/shared'
import { FormSubmissionError, submitFormData } from '@/utilities/submitForm'
import { postHogServerConsent, postHogServerEvents, resolveAnonymousPostHogActor } from '@/posthog/api'
import { NextRequest, NextResponse } from 'next/server'

type FormBridgePayload = Record<string, unknown>

type CaptureFormBridgeEventInput = {
  request: NextRequest
  result: unknown
  slug: string
  values: FormBridgePayload
}

const MAX_TRACKING_IDENTIFIER_LENGTH = 120
const TRACKING_IDENTIFIER_PATTERN = /^[a-zA-Z0-9_-]+$/
const FORM_BRIDGE_EVENT_CONTEXTS = {
  clinic_partner_landing: {
    formSlug: 'public-contact',
    pagePath: '/partners/clinics',
    sourceRoute: 'clinic_partners',
  },
  clinic_profile_inquiry: {
    formSlug: 'public-contact',
    sourceRoute: 'clinic_detail',
  },
} as const
const INTERNAL_FORM_BRIDGE_FIELDS = ['contact_mode', 'form_context', 'page_path', 'source_route'] as const
const internalFormBridgeFieldSet = new Set<string>(INTERNAL_FORM_BRIDGE_FIELDS)

type FormBridgeEventContext = keyof typeof FORM_BRIDGE_EVENT_CONTEXTS

const readStringField = (values: FormBridgePayload, field: string): string | undefined => {
  const value = values[field]
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value !== 'string') return undefined

  const normalized = value.trim()
  return normalized || undefined
}

const readTrackingIdentifier = (values: FormBridgePayload, field: string): string | undefined => {
  const value = readStringField(values, field)
  if (!value || value.length > MAX_TRACKING_IDENTIFIER_LENGTH || !TRACKING_IDENTIFIER_PATTERN.test(value)) {
    return undefined
  }

  return value
}

const readFormBridgeEventContext = (values: FormBridgePayload): FormBridgeEventContext | undefined => {
  const value = readStringField(values, 'form_context')
  if (value === 'clinic_partner_landing' || value === 'clinic_profile_inquiry') return value

  return undefined
}

const hasStringField = (values: FormBridgePayload, field: string): boolean =>
  readStringField(values, field) !== undefined

const hasAnyStringField = (values: FormBridgePayload, fields: readonly string[]): boolean =>
  fields.some((field) => hasStringField(values, field))

const readSubmissionId = (result: unknown): string | undefined => {
  if (typeof result !== 'object' || result === null) return undefined

  const id = (result as { id?: unknown }).id
  if (typeof id === 'number' && Number.isFinite(id)) return String(id)
  if (typeof id === 'string' && id.trim()) return id.trim()

  return undefined
}

const readSameOriginRefererPath = (request: NextRequest): string | undefined => {
  const referer = request.headers.get('referer')
  if (!referer) return undefined

  try {
    const requestUrl = new URL(request.url)
    const refererUrl = new URL(referer)
    if (refererUrl.origin !== requestUrl.origin) return undefined

    return refererUrl.pathname
  } catch {
    return undefined
  }
}

const hasExpectedRefererPath = (request: NextRequest, expectedPath: string): boolean =>
  readSameOriginRefererPath(request) === expectedPath

const stripInternalFormBridgeFields = (values: FormBridgePayload): FormBridgePayload =>
  Object.fromEntries(Object.entries(values).filter(([field]) => !internalFormBridgeFieldSet.has(field)))

const captureFormBridgePostHogEvent = async ({
  request,
  result,
  slug,
  values,
}: CaptureFormBridgeEventInput): Promise<void> => {
  const formContext = readFormBridgeEventContext(values)
  const submissionId = readSubmissionId(result)

  if (formContext === 'clinic_profile_inquiry') {
    const context = FORM_BRIDGE_EVENT_CONTEXTS.clinic_profile_inquiry
    if (slug !== context.formSlug) return

    const clinicId = readTrackingIdentifier(values, 'clinic_id')
    const clinicSlug = readTrackingIdentifier(values, 'clinic_slug')

    if (!clinicId || !clinicSlug) return
    if (!hasExpectedRefererPath(request, `/clinics/${encodeURIComponent(clinicSlug)}`)) return

    const doctorId = readTrackingIdentifier(values, 'doctor_id')
    const treatmentId = readTrackingIdentifier(values, 'treatment_id')
    const analyticsConsent = await postHogServerConsent.resolveAnalyticsConsent({ headers: request.headers })
    if (!analyticsConsent.isAllowed) return

    const actor = resolveAnonymousPostHogActor({
      fallbackAnonymousId: submissionId ? `form_submission:${submissionId}` : `form_bridge:${slug}`,
      headers: request.headers,
    })

    await postHogServerEvents.patientInquiryCreated({
      actor,
      analyticsConsent,
      flush: true,
      properties: {
        clinic_id: clinicId,
        clinic_slug: clinicSlug,
        doctor_id: doctorId,
        form_slug: slug,
        has_doctor: doctorId !== undefined,
        has_message: hasAnyStringField(values, ['message', 'note']),
        has_preferred_date: hasStringField(values, 'preferred_date'),
        has_preferred_time: hasStringField(values, 'preferred_time'),
        has_treatment: treatmentId !== undefined,
        source_route: context.sourceRoute,
        submission_id: submissionId,
        treatment_id: treatmentId,
      },
    })
    return
  }

  if (formContext === 'clinic_partner_landing') {
    const context = FORM_BRIDGE_EVENT_CONTEXTS.clinic_partner_landing
    if (slug !== context.formSlug) return
    if (!hasExpectedRefererPath(request, context.pagePath)) return

    const analyticsConsent = await postHogServerConsent.resolveAnalyticsConsent({ headers: request.headers })
    if (!analyticsConsent.isAllowed) return

    const actor = resolveAnonymousPostHogActor({
      fallbackAnonymousId: submissionId ? `form_submission:${submissionId}` : `form_bridge:${slug}`,
      headers: request.headers,
    })

    await postHogServerEvents.clinicOnboardingInterestCreated({
      actor,
      analyticsConsent,
      flush: true,
      properties: {
        form_slug: slug,
        has_message: hasStringField(values, 'message'),
        page_path: context.pagePath,
        source_route: context.sourceRoute,
        submission_id: submissionId,
      },
    })
  }
}

/**
 * Slug-based bridge for marketing/contact forms.
 * Uses a non-conflicting API namespace so Payload's native /api/forms/:id routes remain untouched.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const logger = createScopedLogger(await getServerLogger(), {
    scope: 'api.formBridge',
    ...getRequestLogContext({ headers: request.headers, request }),
  })

  try {
    const { slug } = await params
    const formData: unknown = await request.json()
    const isObjectPayload = typeof formData === 'object' && formData !== null && !Array.isArray(formData)

    if (!isObjectPayload) {
      return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 })
    }

    const form = await getForm(slug)

    if (!form) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 })
    }

    const result = await submitFormData({
      formId: String(form.id),
      values: stripInternalFormBridgeFields(formData as FormBridgePayload),
    })

    await captureFormBridgePostHogEvent({
      request,
      result,
      slug,
      values: formData as FormBridgePayload,
    })

    return NextResponse.json({
      success: true,
      message: 'Form submitted successfully',
      data: result,
    })
  } catch (error: unknown) {
    logger.error(
      {
        err: toLoggedError(error),
        event: 'api.formBridge.submit.failed',
      },
      'Form submission failed',
    )
    const msg = error instanceof Error ? error.message : String(error)
    const status = error instanceof FormSubmissionError ? error.status : 500
    return NextResponse.json({ error: msg || 'Form submission failed' }, { status })
  }
}
