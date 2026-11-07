'use client'

import { useMemo } from 'react'

import { ClinicDetail } from '@/components/templates/ClinicDetailConcepts'
import {
  ClinicContactRequestError,
  type ClinicDetailAnalyticsPort,
  type ClinicContactRequestSubmitter,
  type ClinicDetailConceptProps,
} from '@/features/clinicDetail/contracts'
import { postHogBrowserEvents, usePostHogAnalyticsReady } from '@/posthog/client-api'

const clinicDetailAnalytics: Omit<ClinicDetailAnalyticsPort, 'isReady'> = {
  onInquiryStarted: ({ clinicId }) => postHogBrowserEvents.clinicInquiryStarted({ clinic_id: clinicId }),
  onProfileViewed: ({ clinicId, clinicSlug, hasDoctors, hasTreatments, pagePath, verificationTier }) => {
    return postHogBrowserEvents.clinicProfileViewed({
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
  const response = await fetch(authenticated ? '/api/patient/inquiries' : '/api/patient/inquiry-preparations', {
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
    reference?: string
    expiresAt?: string
    status?: string
    inquiry?: { id?: unknown }
  }
  if (!authenticated && responseBody.status === 'saved-not-sent' && responseBody.reference && responseBody.expiresAt)
    return {
      id: responseBody.reference,
      preparation: { reference: responseBody.reference, expiresAt: responseBody.expiresAt },
    }
  if (!authenticated) throw new ClinicContactRequestError('Could not confirm your saved inquiry.', false)
  const id = responseBody.inquiry?.id ?? responseBody.id
  if (typeof id !== 'string' && typeof id !== 'number') {
    throw new ClinicContactRequestError('Could not confirm your clinic request.', false)
  }

  return { id: String(id) }
}

export function ClinicDetailClientAdapter(
  props: Omit<ClinicDetailConceptProps, 'analytics' | 'onSubmitContactRequest'>,
) {
  const isReady = usePostHogAnalyticsReady()
  const analytics = useMemo(() => ({ ...clinicDetailAnalytics, isReady }), [isReady])

  return <ClinicDetail {...props} analytics={analytics} onSubmitContactRequest={submitClinicContactRequest} />
}
