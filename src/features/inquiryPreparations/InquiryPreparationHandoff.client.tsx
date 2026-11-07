'use client'

import { useEffect, useState } from 'react'
import { InquiryPreparationNotices } from '@/components/organisms/InquiryPreparationNotices/Component'
import type { PreparationReceipt } from './contracts'

async function readPreparations(): Promise<PreparationReceipt[]> {
  const items: PreparationReceipt[] = []
  let cursor: number | null = null
  do {
    const response = await fetch(`/api/patient/inquiry-preparations${cursor ? `?cursor=${cursor}` : ''}`, {
      cache: 'no-store',
    })
    if (!response.ok) throw new Error('Prepared inquiries could not be loaded. Refresh to try again.')
    const page = (await response.json()) as { preparations: PreparationReceipt[]; nextCursor: number | null }
    items.push(...page.preparations)
    cursor = page.nextCursor
  } while (cursor)
  return items
}

async function submit(reference: string, retry: boolean): Promise<PreparationReceipt> {
  const response = await fetch('/api/patient/inquiry-preparations/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reference, retry }),
  })
  if (!response.ok)
    throw new Error('Your account is ready, but this inquiry was not sent. Try again before it expires.')
  return response.json() as Promise<PreparationReceipt>
}

/** The account return owns the first POST. GET and subsequent remounts cannot retry an earlier attempt. */
export function InquiryPreparationHandoff() {
  const [items, setItems] = useState<PreparationReceipt[]>([])
  const [loading, setLoading] = useState<string[]>([])
  const [error, setError] = useState<string>()
  const [errors, setErrors] = useState<Record<string, string>>({})
  useEffect(() => {
    let disposed = false
    void readPreparations()
      .then(async (prepared) => {
        if (disposed) return
        setItems(prepared.filter((item) => item.status !== 'submitted'))
        setLoading(
          prepared
            .filter((item) => item.status === 'saved-not-sent' && !item.firstAttemptAt)
            .map((item) => item.reference),
        )
        for (const item of prepared) {
          if (disposed) return
          if (item.status === 'submitted' || item.status === 'sign-in-required') continue
          let result = item
          if (!item.firstAttemptAt && item.status !== 'sign-in-required') {
            try {
              result = await submit(item.reference, false)
            } catch {
              result = { ...item, status: 'try-again' }
            }
          }
          if (!disposed) {
            setItems((current) =>
              current.flatMap((entry) =>
                entry.reference !== item.reference ? [entry] : result.status === 'submitted' ? [] : [result],
              ),
            )
            setLoading((current) => current.filter((reference) => reference !== item.reference))
            if (result.status === 'submitted') window.dispatchEvent(new Event('patient-inquiries-updated'))
          }
        }
      })
      .catch((error: unknown) => {
        if (!disposed) setError(error instanceof Error ? error.message : 'Prepared inquiries could not be loaded.')
      })
    return () => {
      disposed = true
    }
  }, [])

  const retry = async (reference: string) => {
    setErrors((current) => ({ ...current, [reference]: '' }))
    setLoading((current) => [...current, reference])
    try {
      const result = await submit(reference, true)
      setItems((current) =>
        current.flatMap((item) =>
          item.reference !== reference ? [item] : result.status === 'submitted' ? [] : [result],
        ),
      )
      window.dispatchEvent(new Event('patient-inquiries-updated'))
    } catch {
      setErrors((current) => ({
        ...current,
        [reference]: 'Your account is ready, but the inquiry was not sent. Try again before it expires.',
      }))
    } finally {
      setLoading((current) => current.filter((item) => item !== reference))
    }
  }
  return (
    <InquiryPreparationNotices
      items={items}
      loading={loading}
      error={error}
      errors={errors}
      onRetry={(reference) => {
        void retry(reference)
      }}
    />
  )
}
