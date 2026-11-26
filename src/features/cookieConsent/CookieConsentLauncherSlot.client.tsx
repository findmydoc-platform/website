'use client'

import { createContext, useContext, useState, type RefCallback, type ReactNode } from 'react'

const LauncherSlot = createContext<HTMLElement | null>(null)
const RegisterSlot = createContext<RefCallback<HTMLDivElement> | null>(null)

export function CookieConsentLauncherSlotProvider({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  return (
    <RegisterSlot.Provider value={setSlot}>
      <LauncherSlot.Provider value={slot}>{children}</LauncherSlot.Provider>
    </RegisterSlot.Provider>
  )
}

export function CookieConsentLauncherSlot() {
  const register = useContext(RegisterSlot)
  return register ? <div ref={register} className="flex justify-end px-3 pt-7 pb-4 sm:px-6" /> : null
}

export function useCookieConsentLauncherSlot() {
  return useContext(LauncherSlot)
}
