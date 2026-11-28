import type { Metadata } from 'next'

import React from 'react'

import { resolveCmsDocumentLocale } from './_data/documentLocale'
import { AdminBarClientAdapter } from '@/app/(frontend)/AdminBarClientAdapter.client'
import { TreatmentSearchHandoffProvider } from '@/app/(frontend)/listing-comparison/TreatmentSearchHandoff.client'
import { SupabaseAuthHashUrlScrubber } from '@/app/(frontend)/_components/SupabaseAuthHashUrlScrubber.client'
import { createSiteMetadata } from '@/utilities/generateMeta'
import { getGlobal } from '@/utilities/getGlobals'
import { getServerSideURL } from '@/utilities/getURL'
import { cookies, draftMode, headers } from 'next/headers'

import './globals.css'
import { COOKIE_CONSENT_COOKIE_NAME, resolveCookieConsentContext } from '@/features/cookieConsent'
import { CookieConsentLauncherSlotProvider } from '@/features/cookieConsent/CookieConsentLauncherSlot.client'
import { CookieConsentClientAdapter } from '@/features/cookieConsent/CookieConsentClientAdapter.client'
import {
  SEARCH_ROBOTS_HEADER_VALUE,
  shouldBlockSearchIndexing,
  shouldBlockSearchIndexingForRequest,
} from '@/features/searchIndexing'
import { JsonLdScript, buildSiteBaseJsonLd } from '@/utilities/structuredData'
import type { CookieConsent as CookieConsentType } from '@/payload-types'
import { isPreviewRuntime } from '@/features/runtimePolicy'
import {
  getTemporaryLandingBlogCopy,
  getTemporaryLandingPageContent,
  readTemporaryLandingLocale,
  TEMPORARY_LANDING_DEFAULT_LOCALE,
} from '@/features/temporaryLandingMode'
import { LanguageSwitchRouteProvider } from '@/features/languageSwitch/LanguageSwitchRouteProvider.client'
import { PatientAuthFormHandoffProvider } from '@/features/languageSwitch/PatientAuthFormHandoff.client'
import { DocumentLanguage } from '@/features/uiCopy/DocumentLanguage.client'
import { FRONTEND_PATH_HEADER, UI_COPY_LOCALE_HEADER } from '@/i18n/requestLocale'
import { publicPageLocaleFromPath } from '@/i18n/publicNavigationPath'
import { getPublicErrorCopy } from '@/features/uiCopy/publicErrors'
import { PublicErrorCopyProvider } from './_components/PublicErrorCopyProvider.client'
import { VercelToolbar } from '@vercel/toolbar/next'

const errorCopy = {
  de: getBoundaryCopy('de'),
  en: getBoundaryCopy('en'),
}

function getBoundaryCopy(locale: 'de' | 'en') {
  const { unexpected, retry } = getPublicErrorCopy(locale)
  return { unexpected, retry }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers()
  const blockSearchIndexing = shouldBlockSearchIndexingForRequest({ env: process.env, headers: requestHeaders })
  const holdingLocale = readTemporaryLandingLocale(requestHeaders)
  const holdingDescription = holdingLocale
    ? `${getTemporaryLandingPageContent(TEMPORARY_LANDING_DEFAULT_LOCALE).statusLabel}. ${getTemporaryLandingBlogCopy(TEMPORARY_LANDING_DEFAULT_LOCALE).description}`
    : undefined
  const [{ isEnabled }, requestCookies, cookieConsent, cmsLocale] = await Promise.all([
    draftMode(),
    cookies(),
    getGlobal('cookieConsent', 1),
    holdingLocale ? undefined : resolveCmsDocumentLocale(requestHeaders),
  ])
  const cookieConsentContext = resolveCookieConsentContext(
    cookieConsent as CookieConsentType,
    requestCookies.get(COOKIE_CONSENT_COOKIE_NAME)?.value ?? null,
  )

  const path = requestHeaders.get(FRONTEND_PATH_HEADER) ?? '/'
  const explicitLocale = requestHeaders.get(UI_COPY_LOCALE_HEADER)
  const documentLanguage = holdingLocale ?? cmsLocale ?? (
    explicitLocale === 'de' || explicitLocale === 'en' ? explicitLocale : publicPageLocaleFromPath(path)
  )

  return (
    <html lang={documentLanguage} suppressHydrationWarning>
      <head>
        <link href="/favicon.ico" rel="icon" sizes="32x32" />
        <link href="/favicon.svg" rel="icon" type="image/svg+xml" />
        {blockSearchIndexing ? (
          <>
            <meta content={SEARCH_ROBOTS_HEADER_VALUE} name="robots" />
            <meta content={`${SEARCH_ROBOTS_HEADER_VALUE}, noimageindex`} name="googlebot" />
          </>
        ) : null}
      </head>
      <body className="min-h-screen bg-site-canvas text-foreground antialiased">
        <SupabaseAuthHashUrlScrubber />
        {!blockSearchIndexing ? <JsonLdScript data={buildSiteBaseJsonLd({ description: holdingDescription })} /> : null}
        <CookieConsentLauncherSlotProvider>
          <div className="flex min-h-screen min-h-svh flex-col">
            <AdminBarClientAdapter preview={isEnabled} />
            <LanguageSwitchRouteProvider>
              <PatientAuthFormHandoffProvider>
                <TreatmentSearchHandoffProvider>
                  <DocumentLanguage initialLocale={holdingLocale ?? cmsLocale}>
                    <PublicErrorCopyProvider copy={errorCopy}>
                      {children}
                    </PublicErrorCopyProvider>
                  </DocumentLanguage>
                </TreatmentSearchHandoffProvider>
              </PatientAuthFormHandoffProvider>
            </LanguageSwitchRouteProvider>
          </div>
          <CookieConsentClientAdapter
            config={cookieConsentContext.config}
            initialConsent={cookieConsentContext.initialConsent}
          />
        </CookieConsentLauncherSlotProvider>
        {isPreviewRuntime(process.env) ? <VercelToolbar /> : null}
      </body>
    </html>
  )
}

export const metadata: Metadata = {
  ...createSiteMetadata(),
  metadataBase: new URL(getServerSideURL()),
  robots: shouldBlockSearchIndexing(process.env)
    ? {
        follow: false,
        googleBot: {
          follow: false,
          index: false,
          noarchive: true,
          noimageindex: true,
        },
        index: false,
        noarchive: true,
        nocache: true,
      }
    : undefined,
}
