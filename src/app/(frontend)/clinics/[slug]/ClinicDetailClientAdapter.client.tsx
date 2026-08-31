'use client'

import { ClinicDetail } from '@/components/templates/ClinicDetailConcepts'
import {
  ClinicContactRequestError,
  type ClinicDetailAnalyticsPort,
  type ClinicContactRequestSubmitter,
  type ClinicDetailConceptProps,
} from '@/features/clinicDetail/contracts'
import { postHogBrowserEvents } from '@/posthog/client-api'

export const clinicDetailAnalytics: ClinicDetailAnalyticsPort = {
  onCtaClicked: ({ clinicId, clinicSlug, ctaId, ctaLabel, ctaLocation, doctorId, pagePath, treatmentId }) => {
    postHogBrowserEvents.clinicCtaClicked({
      clinic_id: clinicId,
      clinic_slug: clinicSlug,
      cta_id: ctaId,
      cta_label: ctaLabel,
      cta_location: ctaLocation,
      ...(doctorId ? { doctor_id: doctorId } : {}),
      page_path: pagePath,
      source_route: 'clinic_detail',
      ...(treatmentId ? { treatment_id: treatmentId } : {}),
    })
  },
  onProfileViewed: ({ clinicId, clinicSlug, hasDoctors, hasTreatments, pagePath, verificationTier }) => {
    postHogBrowserEvents.clinicProfileViewed({
      clinic_id: clinicId,
      clinic_slug: clinicSlug,
      has_doctors: hasDoctors,
      has_treatments: hasTreatments,
      page_path: pagePath,
      source_route: 'clinic_detail',
      verification_tier: verificationTier,
    })
  },
}

export const submitClinicContactRequest: ClinicContactRequestSubmitter = async (payload, authenticated) => {
  const response = await fetch(authenticated ? '/api/patient/inquiries' : '/api/clinic-contact-requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}))
    const error = (errorPayload as { error?: unknown }).error
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
    const requiresReauthentication = response.status === 401 || code === 'INQUIRY_UNAUTHORIZED'
    const errorMessage =
      response.status === 401
        ? 'Your session has ended. Sign in again before sending this request.'
        : typeof error === 'string'
          ? error
          : 'Could not send your clinic request right now.'

    throw new ClinicContactRequestError(errorMessage, requiresReauthentication)
  }

  const responseBody = (await response.json().catch(() => ({}))) as {
    id?: unknown
    inquiry?: { id?: unknown }
  }
  const id = responseBody.inquiry?.id ?? responseBody.id
  if (typeof id !== 'string' && typeof id !== 'number') {
    throw new ClinicContactRequestError('Could not confirm your clinic request.', false)
  }

  return { id: String(id) }
}

export function ClinicDetailClientAdapter(
  props: Omit<ClinicDetailConceptProps, 'analytics' | 'onSubmitContactRequest'>,
) {
  return (
    <ClinicDetail {...props} analytics={clinicDetailAnalytics} onSubmitContactRequest={submitClinicContactRequest} />
  )
}
