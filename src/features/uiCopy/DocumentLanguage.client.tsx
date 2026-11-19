'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

import { patientLoginLocaleFromPath } from '@/i18n/requestLocale'

export function DocumentLanguage() {
  const pathname = usePathname()

  useEffect(() => {
    document.documentElement.lang = patientLoginLocaleFromPath(pathname) ?? 'en'
  }, [pathname])

  return null
}
