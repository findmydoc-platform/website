'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { Suspense, useEffect } from 'react'

import { isAuthConfirmationPath, uiCopyLocaleFromPath, type UiCopyLocale } from '@/i18n/requestLocale'

function SetDocumentLanguage({ locale }: { locale: UiCopyLocale }) {
  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  return null
}

function ConfirmationDocumentLanguage({ pathname }: { pathname: string }) {
  const searchParams = useSearchParams()
  return <SetDocumentLanguage locale={uiCopyLocaleFromPath(pathname, searchParams) ?? 'en'} />
}

export function DocumentLanguage() {
  const pathname = usePathname()
  if (isAuthConfirmationPath(pathname)) {
    return (
      <Suspense fallback={null}>
        <ConfirmationDocumentLanguage pathname={pathname} />
      </Suspense>
    )
  }

  return <SetDocumentLanguage locale={uiCopyLocaleFromPath(pathname) ?? 'en'} />
}
