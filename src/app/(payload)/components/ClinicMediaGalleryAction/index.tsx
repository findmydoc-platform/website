'use client'

import { useAuth, useDocumentInfo, useForm, useFormModified, useFormProcessing } from '@payloadcms/ui'
import { useState } from 'react'
import { ClinicMediaGalleryActionPanel } from './Panel'
import { clinicMediaGalleryActionUrl } from './actionUrl'

export function ClinicMediaGalleryAction() {
  const { id, apiURL } = useDocumentInfo()
  const { user } = useAuth()
  const { setProcessing } = useForm()
  const dirty = useFormModified()
  const processing = useFormProcessing()
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)

  if (!id || !apiURL || user?.collection !== 'platformStaff') return null

  const addImage = async () => {
    if (dirty || processing || saving) return
    setSaving(true)
    setProcessing(true)
    setError(undefined)
    try {
      const response = await fetch(clinicMediaGalleryActionUrl(apiURL, window.location.origin), {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!response.ok) {
        const result = (await response.json().catch(() => undefined)) as { error?: string } | undefined
        throw new Error(result?.error ?? 'The image could not be added to the clinic gallery.')
      }
      window.location.reload()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The image could not be added to the clinic gallery.')
    } finally {
      setSaving(false)
      setProcessing(false)
    }
  }

  return (
    <ClinicMediaGalleryActionPanel
      dirty={dirty}
      busy={processing || saving}
      error={error}
      onAdd={() => void addImage()}
    />
  )
}
