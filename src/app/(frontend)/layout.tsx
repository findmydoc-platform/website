import type { Metadata } from 'next'

import React from 'react'
import '@fontsource/dm-sans'

import { AdminBarClientAdapter } from '@/app/(frontend)/AdminBarClientAdapter.client'
import { SupabaseAuthHashUrlScrubber } from '@/app/(frontend)/_components/SupabaseAuthHashUrlScrubber.client'
import { createSiteMetadata } from '@/utilities/generateMeta'
import { getGlobal } from '@/utilities/getGlobals'
import { getServerSideURL } from '@/utilities/getURL'
import { cookies, draftMode, headers } from 'next/headers'

import './globals.css'
import { COOKIE_CONSENT_COOKIE_NAME, resolveCookieConsentContext } from '@/features/cookieConsent'
import { CookieConsentClientAdapter } from '@/features/cookieConsent/CookieConsentClientAdapter.client'
import {
  SEARCH_ROBOTS_HEADER_VALUE,
  shouldBlockSearchIndexing,
  shouldBlockSearchIndexingForRequest,
} from '@/features/searchIndexing'
import { JsonLdScript, buildSiteBaseJsonLd } from '@/utilities/structuredData'
import type { CookieConsent as CookieConsentType } from '@/payload-types'

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers()
  const blockSearchIndexing = shouldBlockSearchIndexingForRequest({ env: process.env, headers: requestHeaders })
  const { isEnabled } = await draftMode()
  const requestCookies = await cookies()
  const cookieConsentContext = resolveCookieConsentContext(
    (await getGlobal('cookieConsent', 1)) as CookieConsentType,
    requestCookies.get(COOKIE_CONSENT_COOKIE_NAME)?.value ?? null,
  )

  return (
    <html lang="en" suppressHydrationWarning>
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
        {!blockSearchIndexing ? <JsonLdScript data={buildSiteBaseJsonLd()} /> : null}
        <div className="flex min-h-screen min-h-svh flex-col">
          <AdminBarClientAdapter preview={isEnabled} />
          {children}
        </div>
        <CookieConsentClientAdapter
          config={cookieConsentContext.config}
          initialConsent={cookieConsentContext.initialConsent}
        />
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
