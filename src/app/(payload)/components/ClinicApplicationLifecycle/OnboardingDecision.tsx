'use client'

import { Button, useDocumentInfo, useForm, useFormModified, useFormProcessing } from '@payloadcms/ui'
import { useState } from 'react'
import type { readOnboardingStatus } from '@/features/clinicOnboarding/stagedApplication'

type Review = Pick<
  Awaited<ReturnType<typeof readOnboardingStatus>>,
  'applicationRevision' | 'clinicGroupId' | 'decisionStatus' | 'accountSetupStatus'
>

export function OnboardingDecision({ review, reviewedUpdatedAt }: { review: Review; reviewedUpdatedAt: string }) {
  const { apiURL, initialData } = useDocumentInfo()
  const { setProcessing } = useForm()
  const dirty = useFormModified()
  const processing = useFormProcessing()
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string>()
  if (!apiURL || initialData?.updatedAt !== reviewedUpdatedAt) return null

  const submitted = review.decisionStatus === 'submitted'
  const disabled = dirty || processing || submitting
  async function decide(outcome: 'approved' | 'rejected') {
    if (disabled || (outcome === 'rejected' && !reason.trim())) return
    setSubmitting(true)
    setProcessing(true)
    setError(undefined)
    try {
      const decisionURL = new URL(apiURL, window.location.origin)
      decisionURL.pathname += '/onboarding-decision'
      const response = await fetch(decisionURL, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outcome,
          applicationRevision: review.applicationRevision,
          ...(outcome === 'rejected' ? { reason } : {}),
        }),
      })
      if (!response.ok) {
        const result = (await response.json().catch(() => undefined)) as
          { errors?: Array<{ message?: string }> } | undefined
        throw new Error(result?.errors?.[0]?.message ?? 'Reload the application and try the decision again.')
      }
      window.location.reload()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'The decision could not be completed.')
    } finally {
      setSubmitting(false)
      setProcessing(false)
    }
  }

  return (
    <section aria-label="Onboarding decision">
      {submitted && <p>Clinic group: {review.clinicGroupId ?? 'Independent clinic'}</p>}
      {dirty && <p>Reload this application to review the saved details before deciding.</p>}
      <Button buttonType="button" disabled={disabled} onClick={() => void decide('approved')}>
        {submitted
          ? 'Approve participation'
          : review.accountSetupStatus === 'completed'
            ? 'Prepare invitation'
            : 'Retry account setup'}
      </Button>
      {submitted && (
        <div className="field-type textarea">
          <label htmlFor="onboarding-decision-reason" className="field-label">
            Rejection reason
          </label>
          <textarea
            id="onboarding-decision-reason"
            value={reason}
            maxLength={2_000}
            disabled={disabled}
            onChange={(event) => setReason(event.target.value)}
          />
          <Button
            buttonType="button"
            buttonStyle="secondary"
            disabled={disabled || !reason.trim()}
            onClick={() => void decide('rejected')}
          >
            Reject participation
          </Button>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  )
}
