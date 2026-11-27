'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { createContext, Suspense, type ReactNode, useContext, useEffect, useState } from 'react'

import { isAuthConfirmationPath, uiCopyLocaleFromPath } from '@/i18n/requestLocale'
import type { ContentLocale } from '@/utilities/contentLocalization'
import type { TemporaryLandingLocale } from '@/features/temporaryLandingMode/i18n'

type DocumentLocale = ContentLocale | TemporaryLandingLocale
const DocumentLocaleContext = createContext<((locale: DocumentLocale | undefined) => void) | null>(null)

function PageDocumentLanguage({ locale }: { locale: DocumentLocale }) {
  const setLocale = useContext(DocumentLocaleContext)

  useEffect(() => {
    setLocale?.(locale)
    return () => setLocale?.(undefined)
  }, [locale, setLocale])

  return null
}

export function CmsDocumentLanguage({ locale }: { locale: ContentLocale }) {
  return <PageDocumentLanguage locale={locale} />
}

export function HoldingDocumentLanguage({ locale }: { locale: TemporaryLandingLocale }) {
  return <PageDocumentLanguage locale={locale} />
}

function SetDocumentLanguage({ locale }: { locale: DocumentLocale }) {
  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  return null
}

function ConfirmationDocumentLanguage({ pathname }: { pathname: string }) {
  const searchParams = useSearchParams()
  return <SetDocumentLanguage locale={uiCopyLocaleFromPath(pathname, searchParams) ?? 'en'} />
}

function SyncDocumentLanguage({ locale }: { locale?: DocumentLocale }) {
  const pathname = usePathname()
  if (locale) return <SetDocumentLanguage locale={locale} />
  if (!pathname) return null

  if (isAuthConfirmationPath(pathname)) {
    return (
      <Suspense fallback={null}>
        <ConfirmationDocumentLanguage pathname={pathname} />
      </Suspense>
    )
  }

  return <SetDocumentLanguage locale={uiCopyLocaleFromPath(pathname) ?? 'en'} />
}

export function DocumentLanguage({
  children,
  initialLocale,
}: {
  children?: ReactNode
  initialLocale?: DocumentLocale
}) {
  const [locale, setLocale] = useState(initialLocale)

  return (
    <DocumentLocaleContext.Provider value={setLocale}>
      <SyncDocumentLanguage locale={locale} />
      {children}
    </DocumentLocaleContext.Provider>
  )
}
