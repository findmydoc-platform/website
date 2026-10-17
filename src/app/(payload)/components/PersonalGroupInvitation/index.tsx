'use client'

import { useState } from 'react'
import { useAuth, useDocumentInfo, useForm, useFormModified, useFormProcessing } from '@payloadcms/ui'
import { PersonalGroupInvitationPanel, type PersonalInvitationContact } from './Panel'

export function PersonalGroupInvitation() {
  const { id, apiURL } = useDocumentInfo()
  const { user } = useAuth()
  const { setProcessing } = useForm()
  const dirty = useFormModified()
  const processing = useFormProcessing()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const [result, setResult] = useState<string>()
  if (!id || !apiURL || user?.collection !== 'platformStaff' || !['admin', 'support'].includes(String(user.role)))
    return null
  const invite = async (contact: PersonalInvitationContact) => {
    if (dirty || processing || busy) return
    setBusy(true)
    setProcessing(true)
    setError(undefined)
    setResult(undefined)
    try {
      const response = await fetch(`${apiURL}/personal-invitation`, {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contact),
      })
      const body = (await response.json().catch(() => undefined)) as
        { invitation?: string; errors?: { message?: string }[] } | undefined
      if (!response.ok)
        throw new Error(body?.errors?.[0]?.message ?? 'Preparation is unconfirmed. Retry the same person.')
      setResult(
        body?.invitation === 'completed'
          ? 'This person has already completed their personal invitation.'
          : body?.invitation === 'prepared'
            ? 'The personal invitation is prepared for delivery.'
            : body?.invitation === 'inactive'
              ? 'The personal account is prepared. Invitation delivery is inactive in this environment.'
              : body?.invitation === 'ineligible'
                ? 'No new invitation was prepared. Use the existing invitation or the separate recovery workflow.'
                : 'The personal account is prepared. Invitation delivery awaits the existing Auth scheduler.',
      )
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Preparation is unconfirmed. Retry the same person.')
    } finally {
      setBusy(false)
      setProcessing(false)
    }
  }
  return (
    <PersonalGroupInvitationPanel
      onInvite={invite}
      busy={busy || processing}
      dirty={dirty}
      error={error}
      result={result}
    />
  )
}
