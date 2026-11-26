'use client'

import { usePathname } from 'next/navigation'
import {
  createContext,
  useContext,
  useLayoutEffect,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react'

import type { UiCopyLocale } from '@/i18n/requestLocale'

export type LanguageSwitchTargets = Partial<Record<UiCopyLocale, string>>

type LanguageSwitchRouteProps = {
  locale: UiCopyLocale
  targets: LanguageSwitchTargets
  requiresConfirmation?: () => boolean
  onNavigate?: (href: string) => void
}

type RouteRegistration = LanguageSwitchRouteProps & { pathname: string }

const ActiveRoute = createContext<RouteRegistration | null>(null)
const RegisterRoute = createContext<Dispatch<SetStateAction<RouteRegistration | null>> | null>(null)

export function LanguageSwitchRouteProvider({ children }: { children: ReactNode }) {
  const [route, setRoute] = useState<RouteRegistration | null>(null)

  return (
    <RegisterRoute.Provider value={setRoute}>
      <ActiveRoute.Provider value={route}>{children}</ActiveRoute.Provider>
    </RegisterRoute.Provider>
  )
}

export function useActiveLanguageSwitchRoute() {
  const pathname = usePathname()
  const route = useContext(ActiveRoute)

  return route?.pathname === pathname ? route : null
}

export function useLanguageSwitchRoute(config?: LanguageSwitchRouteProps) {
  const { locale, targets, requiresConfirmation, onNavigate } = config ?? {}
  const { de, en } = targets ?? {}
  const pathname = usePathname()
  const registerRoute = useContext(RegisterRoute)

  useLayoutEffect(() => {
    if (!pathname || !locale || !registerRoute) return

    const registration: RouteRegistration = { pathname, locale, targets: { de, en }, requiresConfirmation, onNavigate }
    registerRoute(registration)
    return () => registerRoute((current) => (current === registration ? null : current))
  }, [de, en, locale, onNavigate, pathname, registerRoute, requiresConfirmation])
}
