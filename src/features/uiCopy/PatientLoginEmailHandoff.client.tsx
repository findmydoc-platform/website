'use client'

import { usePathname } from 'next/navigation'
import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react'

type EmailHandoff = {
  href: string
  value: string
}

const PendingEmail = createContext<React.RefObject<EmailHandoff | null> | null>(null)

export function PatientLoginEmailHandoffProvider({ children }: { children: ReactNode }) {
  const pendingEmail = useRef<EmailHandoff | null>(null)
  const pathname = usePathname()

  useEffect(() => {
    // The destination consumes the handoff during mount. Any other navigation drops it.
    pendingEmail.current = null
  }, [pathname])

  return <PendingEmail.Provider value={pendingEmail}>{children}</PendingEmail.Provider>
}

export function usePatientLoginEmailHandoff() {
  return useContext(PendingEmail)
}
