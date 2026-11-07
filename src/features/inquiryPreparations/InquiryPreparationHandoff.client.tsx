'use client'

import { useCallback, useEffect, useState } from 'react'
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

async function reconcile(reference: string): Promise<PreparationReceipt | null> {
  try {
    return (await readPreparations()).find((item) => item.reference === reference) ?? null
  } catch {
    return null
  }
}

async function submit(reference: string, retry: boolean): Promise<PreparationReceipt | null> {
  try {
    const response = await fetch('/api/patient/inquiry-preparations/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reference, retry }),
    })
    if (!response.ok) throw new Error('Submission outcome needs reconciliation.')
    const result = (await response.json()) as PreparationReceipt
    if (
      result?.reference !== reference ||
      !['saved-not-sent', 'sign-in-required', 'try-again', 'submitted'].includes(result.status) ||
      (result.status === 'submitted' && !result.inquiryId)
    )
      throw new Error('Submission outcome needs reconciliation.')
    return result
  } catch {
    // A transport error cannot distinguish a rollback from a committed inquiry with a lost acknowledgement.
    return reconcile(reference)
  }
}

/** The account return owns the first POST. Reads and subsequent remounts never retry an earlier attempt. */
export function InquiryPreparationHandoff({
  initialItems,
  initialError,
}: {
  initialItems: PreparationReceipt[]
  initialError?: string
}) {
  const [items, setItems] = useState(initialItems)
  const [loading, setLoading] = useState<string[]>(() =>
    initialError
      ? []
      : initialItems
          .filter((item) => item.status === 'saved-not-sent' && !item.firstAttemptAt)
          .map((item) => item.reference),
  )
  const [unknown, setUnknown] = useState<string[]>([])
  const [error, setError] = useState(initialError)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const applyResult = useCallback((reference: string, result: PreparationReceipt | null) => {
    setUnknown((current) =>
      result
        ? current.filter((item) => item !== reference)
        : [...current.filter((item) => item !== reference), reference],
    )
    if (!result) return
    setItems((current) =>
      current.map((entry) =>
        entry.reference === reference
          ? {
              ...entry,
              ...result,
              clinicName: result.clinicName || entry.clinicName,
            }
          : entry,
      ),
    )
    if (result.status === 'submitted') window.dispatchEvent(new Event('patient-inquiries-updated'))
  }, [])
  const send = useCallback(
    async (reference: string, retry: boolean) => {
      setErrors((current) => ({ ...current, [reference]: '' }))
      setLoading((current) => [...current, reference])
      const result = await submit(reference, retry)
      applyResult(reference, result)
      if (retry && result && result.status !== 'submitted')
        setErrors((current) => ({
          ...current,
          [reference]: 'Your account is ready, but the inquiry was not sent. Try again before it expires.',
        }))
      setLoading((current) => current.filter((item) => item !== reference))
    },
    [applyResult],
  )
  useEffect(() => {
    if (initialError) return
    let disposed = false
    void readPreparations()
      .then(async (prepared) => {
        if (disposed) return
        // Keep this handoff's completed slots, without resurfacing old receipts on a later visit.
        const visible = prepared.filter(
          (item) => item.status !== 'submitted' || initialItems.some((initial) => initial.reference === item.reference),
        )
        setLoading(
          visible
            .filter((item) => item.status === 'saved-not-sent' && !item.firstAttemptAt)
            .map((item) => item.reference),
        )
        setItems(
          visible.map((item) => ({
            ...item,
            clinicName:
              item.clinicName || initialItems.find((initial) => initial.reference === item.reference)?.clinicName,
          })),
        )
        for (const item of visible) {
          if (disposed) return
          if (item.status === 'saved-not-sent' && !item.firstAttemptAt) await send(item.reference, false)
        }
      })
      .catch((failure: unknown) => {
        if (!disposed) {
          setError(failure instanceof Error ? failure.message : 'Prepared inquiries could not be loaded.')
          setLoading([])
        }
      })
    return () => {
      disposed = true
    }
  }, [initialItems, initialError, send])

  async function checkStatus(reference: string) {
    setLoading((current) => [...current, reference])
    applyResult(reference, await reconcile(reference))
    setLoading((current) => current.filter((item) => item !== reference))
  }
  return (
    <InquiryPreparationNotices
      items={items}
      loading={loading}
      unknown={unknown}
      error={error}
      errors={errors}
      onRetry={(reference) => {
        void send(reference, true)
      }}
      onCheckStatus={(reference) => {
        void checkStatus(reference)
      }}
    />
  )
}
