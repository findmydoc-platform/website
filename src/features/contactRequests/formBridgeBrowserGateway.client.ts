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
    redirect: 'error',
  }).catch(() => null)

  if (!response?.ok) {
    throw new Error(genericErrorMessage ?? 'Could not send your request right now.')
  }
}
