'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { temporaryLandingLocaleFromPath } from '@/features/temporaryLandingMode/i18n'

export function FrontendChrome({ children, holdingMode }: { children: ReactNode; holdingMode: boolean }) {
  const pathname = usePathname()

  if (holdingMode && temporaryLandingLocaleFromPath(pathname)) return null

  return children
}
