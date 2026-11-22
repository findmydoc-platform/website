'use client'

import { usePathname } from 'next/navigation'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react'

type PatientAuthFormDraft =
  | { form: 'login' | 'recovery'; email: string }
  | { form: 'registration'; fields: { firstName?: string; lastName?: string; email?: string }; resendEmail?: string }

type PendingDraft = {
  href: string
  draft: PatientAuthFormDraft
}

type PatientAuthFormHandoff = {
  save: (href: string, draft: PatientAuthFormDraft) => void
  take: () => PatientAuthFormDraft | undefined
}

const Handoff = createContext<PatientAuthFormHandoff | null>(null)

export function PatientAuthFormHandoffProvider({ children }: { children: ReactNode }) {
  const pending = useRef<PendingDraft | null>(null)
  const expiry = useRef<number | undefined>(undefined)
  const pathname = usePathname()

  const clear = useCallback(() => {
    window.clearTimeout(expiry.current)
    expiry.current = undefined
    pending.current = null
  }, [])

  useEffect(() => {
    // Keep the intended draft available while the destination finishes mounting.
    const next = pending.current
    if (next && next.href !== window.location.pathname + window.location.search) clear()
  }, [clear, pathname])

  useEffect(() => clear, [clear])

  const handoff = useMemo<PatientAuthFormHandoff>(
    () => ({
      save(href, draft) {
        clear()
        const target = new URL(href, window.location.origin)
        pending.current = { href: target.pathname + target.search, draft }
        expiry.current = window.setTimeout(clear, 30_000)
      },
      take() {
        const next = pending.current
        if (!next || next.href !== window.location.pathname + window.location.search) return
        clear()
        return next.draft
      },
    }),
    [clear],
  )

  return <Handoff.Provider value={handoff}>{children}</Handoff.Provider>
}

export function usePatientAuthFormHandoff() {
  return useContext(Handoff)
}

export function patientAuthFormInput(form: HTMLFormElement | null, name: string) {
  const field = form?.elements.namedItem(name)
  return field instanceof HTMLInputElement ? field : null
}

export function readChangedPatientAuthInput(form: HTMLFormElement | null, name: string) {
  const field = patientAuthFormInput(form, name)
  return field && field.value !== field.defaultValue ? field.value : undefined
}
