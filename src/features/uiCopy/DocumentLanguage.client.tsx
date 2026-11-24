'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { createContext, Suspense, type ReactNode, useContext, useEffect, useState } from 'react'

import { isAuthConfirmationPath, uiCopyLocaleFromPath, type UiCopyLocale } from '@/i18n/requestLocale'
import type { ContentLocale } from '@/utilities/contentLocalization'

const CmsLocaleContext = createContext<((locale: ContentLocale | undefined) => void) | null>(null)

export function CmsDocumentLanguage({ locale }: { locale: ContentLocale }) {
  const setLocale = useContext(CmsLocaleContext)

  useEffect(() => {
    setLocale?.(locale)
    return () => setLocale?.(undefined)
  }, [locale, setLocale])

  return null
}

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

function SyncDocumentLanguage({ cmsLocale }: { cmsLocale?: ContentLocale }) {
  const pathname = usePathname()
  if (cmsLocale) return <SetDocumentLanguage locale={cmsLocale} />
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
  initialCmsLocale,
}: {
  children?: ReactNode
  initialCmsLocale?: ContentLocale
}) {
  const [cmsLocale, setCmsLocale] = useState(initialCmsLocale)

  return (
    <CmsLocaleContext.Provider value={setCmsLocale}>
      <SyncDocumentLanguage cmsLocale={cmsLocale} />
      {children}
    </CmsLocaleContext.Provider>
  )
}
