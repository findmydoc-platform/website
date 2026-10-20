'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

export function FrontendChrome({ children, holdingMode }: { children: ReactNode; holdingMode: boolean }) {
  const pathname = usePathname()

  if (holdingMode && pathname === '/') return null

  return children
}
