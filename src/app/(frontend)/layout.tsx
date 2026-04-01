import type { Metadata } from 'next'

import React from 'react'
import '@fontsource/dm-sans'

import { AdminBar } from '@/components/organisms/AdminBar'
import { Footer } from '@/components/templates/Footer/Component'
import { Header } from '@/components/templates/Header/Component'
import { Providers } from '@/providers'
import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import { cookies, draftMode, headers } from 'next/headers'

import './globals.css'
import { getServerSideURL } from '@/utilities/getURL'
import { getCachedGlobal, getGlobal } from '@/utilities/getGlobals'
import { normalizeFooterNavGroups, normalizeHeaderNavItems } from '@/utilities/normalizeNavItems'
import { isNonProductionDeployment, PREVIEW_GUARD_LOCK_REQUEST_HEADER } from '@/features/previewGuard'
import {
  COOKIE_CONSENT_COOKIE_NAME,
  parseCookieConsentState,
  normalizeCookieConsentGlobal,
} from '@/features/cookieConsent'
import type { Footer as FooterType, Header as HeaderType } from '@/payload-types'
import type { CookieConsent as CookieConsentType } from '@/payload-types'

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers()
  const showSiteChrome = requestHeaders.get(PREVIEW_GUARD_LOCK_REQUEST_HEADER) !== '1'
  const showPreviewBadge = isNonProductionDeployment(process.env)
  const configuredHeaderLogoSrc = process.env.NEXT_PUBLIC_HEADER_LOGO_SRC?.trim() || undefined
  const configuredFooterLogoSrc = process.env.NEXT_PUBLIC_FOOTER_LOGO_SRC?.trim() || undefined
  const headerLogoSrc = configuredHeaderLogoSrc
  const footerLogoSrc = configuredFooterLogoSrc
  const { isEnabled } = await draftMode()
  const requestCookies = await cookies()

  const footerGroups = showSiteChrome
    ? normalizeFooterNavGroups((await getCachedGlobal('footer', 1)()) as FooterType)
    : []

  const headerNavItems = showSiteChrome
    ? normalizeHeaderNavItems((await getCachedGlobal('header', 1)()) as HeaderType)
    : []

  const cookieConsentGlobal = normalizeCookieConsentGlobal((await getGlobal('cookieConsent', 1)) as CookieConsentType)
  const initialCookieConsent = cookieConsentGlobal
    ? parseCookieConsentState(
        requestCookies.get(COOKIE_CONSENT_COOKIE_NAME)?.value ?? null,
        cookieConsentGlobal.consentVersion,
      )
    : null

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link href="/favicon.ico" rel="icon" sizes="32x32" />
        <link href="/favicon.svg" rel="icon" type="image/svg+xml" />
      </head>
      <body>
        <Providers cookieConsentConfig={cookieConsentGlobal} initialCookieConsent={initialCookieConsent}>
          <AdminBar adminBarProps={{ preview: isEnabled }} />

          {showSiteChrome ? (
            <div className="full-width">
              <Header navItems={headerNavItems} logoSrc={headerLogoSrc} showPreviewBadge={showPreviewBadge} />
            </div>
          ) : null}

          {/* Content-Area: Full width, pages handle containment */}
          <main className="flex-1">{children}</main>

          {showSiteChrome ? (
            <div className="full-width">
              <Footer footerGroups={footerGroups} logoSrc={footerLogoSrc} showPreviewBadge={showPreviewBadge} />
            </div>
          ) : null}
        </Providers>
      </body>
    </html>
  )
}

export const metadata: Metadata = {
  metadataBase: new URL(getServerSideURL()),
  openGraph: mergeOpenGraph(),
  twitter: {
    card: 'summary_large_image',
    creator: '@payloadcms',
  },
}
