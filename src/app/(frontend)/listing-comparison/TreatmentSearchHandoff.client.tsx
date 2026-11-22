'use client'

import { usePathname } from 'next/navigation'
import { createContext, useContext, useEffect, useRef, type ReactNode, type RefObject } from 'react'

type TreatmentSearchHandoff = { href: string; value: string }

const PendingSearch = createContext<RefObject<TreatmentSearchHandoff | null> | null>(null)

export function TreatmentSearchHandoffProvider({ children }: { children: ReactNode }) {
  const pendingSearch = useRef<TreatmentSearchHandoff | null>(null)
  const pathname = usePathname()

  useEffect(() => {
    // The destination can read the value during mount. Other navigation discards it.
    pendingSearch.current = null
  }, [pathname])

  return <PendingSearch.Provider value={pendingSearch}>{children}</PendingSearch.Provider>
}

export function useTreatmentSearchHandoff() {
  return useContext(PendingSearch)
}
