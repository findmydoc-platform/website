'use client'

import type { ContactRequestPayload } from '@/components/organisms/Contact/contactRequestForm.shared'

export async function submitFormBridgeContactRequest(
  targetSlug: string,
  payload: ContactRequestPayload,
  genericErrorMessage?: string,
): Promise<void> {
  const response = await fetch(`/api/form-bridge/${encodeURIComponent(targetSlug)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}))
    const errorMessage =
      typeof (errorPayload as { error?: unknown }).error === 'string'
        ? (errorPayload as { error: string }).error
        : (genericErrorMessage ?? 'Could not send your request right now.')
    throw new Error(errorMessage)
  }
}
