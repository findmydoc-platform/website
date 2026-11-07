'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { InquiryPreparationNoticesProps } from '@/components/organisms/InquiryPreparationNotices/Component'
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

async function readPreparations(
  signal?: AbortSignal,
  accepts: (items: PreparationReceipt[]) => boolean = () => true,
): Promise<PreparationReceipt[]> {
  let latest: PreparationReceipt[] = []
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await new Promise<void>((resolve) => setTimeout(resolve, attempt * 1000))
    signal?.throwIfAborted()
    try {
      const items: PreparationReceipt[] = []
      let cursor: number | null = null
      do {
        const response = await fetch(`/api/patient/inquiry-preparations${cursor ? `?cursor=${cursor}` : ''}`, {
          cache: 'no-store',
          signal,
        })
        if (!response.ok) throw new Error('We could not check your saved inquiries. Try again in a moment.')
        const page = (await response.json()) as { preparations: PreparationReceipt[]; nextCursor: number | null }
        items.push(...page.preparations)
        cursor = page.nextCursor
      } while (cursor)
      latest = items
      if (accepts(items)) return items
    } catch (error) {
      if (signal?.aborted || attempt === 2) throw error
    }
  }
  return latest
}

async function reconcile(
  reference: string,
  attemptKey?: string,
  signal?: AbortSignal,
): Promise<PreparationReceipt | null> {
  const matches = (item: PreparationReceipt) => item.reference === reference && settlesAttempt(item, attemptKey)
  try {
    return (await readPreparations(signal, (items) => items.some(matches))).find(matches) ?? null
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
export function useInquiryPreparationHandoff({
  initialItems,
  initialError,
}: {
  initialItems?: PreparationReceipt[]
  initialError?: string
}) {
  const [items, setItems] = useState(initialItems ?? [])
  const itemsRef = useRef(items)
  itemsRef.current = items
  const [announcement, setAnnouncement] = useState('')
  // SSR and hydration stay conservative until the tab's earlier POST markers have been read.
  const initialUnresolved = (initialItems ?? [])
    .filter((item) => !['submitted', 'sign-in-required'].includes(item.status))
    .map((item) => item.reference)
  const [loading, setLoading] = useState<string[]>(initialUnresolved)
  const pendingAttempts = useRef<Record<string, string>>({})
  const storageReady = useRef(false)
  const statusReads = useRef<AbortController | null>(null)
  const refreshing = useRef(false)
  const [unknown, setUnknown] = useState<string[]>(initialUnresolved)
  const [error, setError] = useState<string>()
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
    if (result.status === 'submitted') {
      const clinic =
        result.clinicName || itemsRef.current.find((item) => item.reference === reference)?.clinicName || 'the clinic'
      setAnnouncement(`Your inquiry to ${clinic} has been sent.`)
      window.dispatchEvent(new Event('patient-inquiries-updated'))
    }
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
        result = await reconcile(reference, attemptKey, statusReads.current?.signal)
      }
      if (statusReads.current?.signal.aborted) return
      applyResult(reference, result)
      if (retry && result?.status === 'try-again')
        setErrors((current) => ({
          ...current,
          [reference]: 'Please try sending this inquiry again before it expires.',
        }))
      setLoading((current) => current.filter((item) => item !== reference))
    },
    [applyResult],
  )
  useEffect(() => {
    if (!initialItems) return
    let disposed = false
    const reads = new AbortController()
    statusReads.current = reads
    try {
      pendingAttempts.current = readPendingAttempts()
      storageReady.current = true
    } catch {
      setError('Your browser could not retain the submission status. Allow session storage before trying again.')
      setLoading([])
      return
    }
    void readPreparations(reads.signal)
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
            .filter(
              (item) => item.status === 'outcome-unknown' || (item.status === 'saved-not-sent' && !item.firstAttemptAt),
            )
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
          else if (item.status === 'outcome-unknown') {
            const attemptKey = pendingAttempts.current[item.reference] ?? item.attemptKey
            if (attemptKey) pendingAttempts.current[item.reference] = attemptKey
            const result = await reconcile(item.reference, attemptKey, reads.signal)
            if (disposed) return
            applyResult(item.reference, result)
            setLoading((current) => current.filter((reference) => reference !== item.reference))
          }
        }
      })
      .catch(() => {
        if (!disposed) {
          setError(initialError || 'We could not check your saved inquiries. Try again in a moment.')
          setLoading([])
        }
      })
    return () => {
      disposed = true
      reads.abort()
    }
  }, [initialItems, initialError, send, applyResult])

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
    applyResult(reference, await reconcile(reference, pendingAttempts.current[reference], statusReads.current?.signal))
    setLoading((current) => current.filter((item) => item !== reference))
  }
  const refresh = useCallback(async () => {
    if (refreshing.current || !storageReady.current || statusReads.current?.signal.aborted) return
    const pending = items.filter((item) => item.status === 'outcome-unknown' || unknown.includes(item.reference))
    if (!pending.length) return
    refreshing.current = true
    try {
      const prepared = await readPreparations(statusReads.current?.signal)
      for (const item of pending) {
        const result = prepared.find((entry) => entry.reference === item.reference)
        if (result && settlesAttempt(result, pendingAttempts.current[item.reference] ?? item.attemptKey))
          applyResult(item.reference, result)
      }
    } catch {
      // Keep the last known state when a passive status read is unavailable.
    } finally {
      refreshing.current = false
    }
  }, [items, unknown, applyResult])
  return {
    items,
    loading,
    unknown,
    error,
    errors,
    announcement,
    refresh,
    onRetry: (reference) => {
      const item = items.find((entry) => entry.reference === reference)
      if (item) void send(reference, true, item.expiresAt)
    },
    onCheckStatus: (reference) => {
      void checkStatus(reference)
    },
  } satisfies InquiryPreparationNoticesProps & { announcement: string; refresh: () => Promise<void> }
}
