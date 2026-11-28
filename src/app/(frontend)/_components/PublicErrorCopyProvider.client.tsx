'use client'

import { usePathname } from 'next/navigation'
import { createContext, useContext, type ReactNode } from 'react'

import { publicPageLocaleFromPath } from '@/i18n/publicNavigationPath'
import type { UiCopyLocale } from '@/i18n/requestLocale'

type ErrorCopy = { unexpected: string; retry: string }

const PublicErrorCopy = createContext<Record<UiCopyLocale, ErrorCopy> | null>(null)

export function PublicErrorCopyProvider({
  children,
  copy,
}: {
  children: ReactNode
  copy: Record<UiCopyLocale, ErrorCopy>
}) {
  return <PublicErrorCopy.Provider value={copy}>{children}</PublicErrorCopy.Provider>
}

export function usePublicErrorCopy() {
  const pathname = usePathname()
  const locale = publicPageLocaleFromPath(pathname ?? '/')
  return { locale, copy: useContext(PublicErrorCopy)?.[locale] }
}
