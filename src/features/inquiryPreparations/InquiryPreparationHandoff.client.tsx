'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { InquiryPreparationNotices } from '@/components/organisms/InquiryPreparationNotices/Component'
import type { PreparationReceipt } from './contracts'

const ATTEMPT_STORAGE_PREFIX = 'patient-inquiries:submission-attempt:'

function readPendingAttempts(): Record<string, string> {
  const attempts: Record<string, string> = {}
  for (let index = window.sessionStorage.length - 1; index >= 0; index--) {
    const key = window.sessionStorage.key(index)
    if (!key?.startsWith(ATTEMPT_STORAGE_PREFIX)) continue
    const raw = window.sessionStorage.getItem(key)
    let stored: { attemptKey?: unknown; expiresAt?: unknown } | null = null
    try {
      stored = JSON.parse(raw || 'null') as {
        attemptKey?: unknown
        expiresAt?: unknown
      } | null
    } catch {
      // An invalid presentation marker cannot authorize a request.
    }
    if (
      typeof stored?.attemptKey === 'string' &&
      typeof stored.expiresAt === 'string' &&
      Date.parse(stored.expiresAt) > Date.now()
    ) {
      attempts[key.slice(ATTEMPT_STORAGE_PREFIX.length)] = stored.attemptKey
    } else {
      window.sessionStorage.removeItem(key)
    }
  }
  return attempts
}

function rememberAttempt(reference: string, attemptKey: string, expiresAt: string) {
  window.sessionStorage.setItem(ATTEMPT_STORAGE_PREFIX + reference, JSON.stringify({ attemptKey, expiresAt }))
}

function forgetAttempt(reference: string) {
  try {
    window.sessionStorage.removeItem(ATTEMPT_STORAGE_PREFIX + reference)
  } catch {
    // A retained marker can only require another authoritative status read.
  }
}

function settlesAttempt(result: PreparationReceipt, attemptKey?: string) {
  return (
    result.status === 'submitted' ||
    (result.status === 'try-again' && (!attemptKey || result.attemptKey === attemptKey))
  )
}

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

async function reconcile(reference: string, attemptKey?: string): Promise<PreparationReceipt | null> {
  try {
    const result = (await readPreparations()).find((item) => item.reference === reference)
    return result && settlesAttempt(result, attemptKey) ? result : null
  } catch {
    return null
  }
}

async function submit(reference: string, retry: boolean, attemptKey: string): Promise<PreparationReceipt> {
  const response = await fetch('/api/patient/inquiry-preparations/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reference, retry, attemptKey }),
  })
  if (!response.ok) throw new Error('Submission outcome needs reconciliation.')
  const result = (await response.json()) as PreparationReceipt
  if (
    result?.reference !== reference ||
    !['saved-not-sent', 'sign-in-required', 'try-again', 'outcome-unknown', 'submitted'].includes(result.status) ||
    (result.status === 'submitted' && !result.inquiryId)
  )
    throw new Error('Submission outcome needs reconciliation.')
  return result
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
  // SSR and hydration stay conservative until the tab's earlier POST markers have been read.
  const initialUnresolved = initialItems
    .filter((item) => !['submitted', 'sign-in-required'].includes(item.status))
    .map((item) => item.reference)
  const [loading, setLoading] = useState<string[]>(initialError ? [] : initialUnresolved)
  const pendingAttempts = useRef<Record<string, string>>({})
  const storageReady = useRef(false)
  const [unknown, setUnknown] = useState<string[]>(initialUnresolved)
  const [error, setError] = useState(initialError)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const applyResult = useCallback((reference: string, result: PreparationReceipt | null) => {
    setUnknown((current) =>
      result && result.status !== 'outcome-unknown'
        ? current.filter((item) => item !== reference)
        : [...current.filter((item) => item !== reference), reference],
    )
    if (!result) return
    if (result.status !== 'outcome-unknown') {
      delete pendingAttempts.current[reference]
      forgetAttempt(reference)
    }
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
    async (reference: string, retry: boolean, expiresAt: string) => {
      setErrors((current) => ({ ...current, [reference]: '' }))
      setLoading((current) => [...current, reference])
      const attemptKey = crypto.randomUUID()
      try {
        // Retain correlation before any request can escape this tab, including pre-admission failures.
        rememberAttempt(reference, attemptKey, expiresAt)
      } catch {
        applyResult(reference, null)
        setError('Your browser could not retain the submission status. Allow session storage before trying again.')
        setLoading((current) => current.filter((item) => item !== reference))
        return
      }
      pendingAttempts.current[reference] = attemptKey
      let result: PreparationReceipt | null
      try {
        result = await submit(reference, retry, attemptKey)
        if (result.status === 'outcome-unknown' && result.attemptKey) {
          pendingAttempts.current[reference] = result.attemptKey
          rememberAttempt(reference, result.attemptKey, expiresAt)
        }
      } catch {
        applyResult(reference, null)
        result = await reconcile(reference, attemptKey)
      }
      applyResult(reference, result)
      if (retry && result?.status === 'try-again')
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
    try {
      pendingAttempts.current = readPendingAttempts()
      storageReady.current = true
    } catch {
      setError('Your browser could not retain the submission status. Allow session storage before trying again.')
      setLoading([])
      return
    }
    void readPreparations()
      .then(async (prepared) => {
        if (disposed) return
        // Keep this handoff's completed slots, without resurfacing old receipts on a later visit.
        const reconciled = prepared.map((item) => {
          const attemptKey = pendingAttempts.current[item.reference]
          if (settlesAttempt(item, attemptKey)) {
            delete pendingAttempts.current[item.reference]
            forgetAttempt(item.reference)
          } else if (attemptKey) {
            return { ...item, status: 'outcome-unknown' as const }
          }
          return item
        })
        const visible = reconciled.filter(
          (item) => item.status !== 'submitted' || initialItems.some((initial) => initial.reference === item.reference),
        )
        setUnknown(visible.filter((item) => item.status === 'outcome-unknown').map((item) => item.reference))
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
          if (item.status === 'saved-not-sent' && !item.firstAttemptAt)
            await send(item.reference, false, item.expiresAt)
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
    if (!storageReady.current) {
      try {
        pendingAttempts.current = readPendingAttempts()
        storageReady.current = true
        setError(undefined)
      } catch {
        setLoading((current) => current.filter((item) => item !== reference))
        return
      }
    }
    applyResult(reference, await reconcile(reference, pendingAttempts.current[reference]))
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
        const item = items.find((entry) => entry.reference === reference)
        if (item) void send(reference, true, item.expiresAt)
      }}
      onCheckStatus={(reference) => {
        void checkStatus(reference)
      }}
    />
  )
}
