'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

import { uiCopyLocaleFromPath } from '@/i18n/requestLocale'

export function DocumentLanguage() {
  const pathname = usePathname()

  useEffect(() => {
    document.documentElement.lang = uiCopyLocaleFromPath(pathname) ?? 'en'
  }, [pathname])

  return null
}
