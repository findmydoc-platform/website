import type { Metadata } from 'next'

import React from 'react'
import '@fontsource/dm-sans'

import { AdminBar } from '@/components/organisms/AdminBar'
import { CookieConsentManager } from '@/components/organisms/CookieConsent/CookieConsentManager.client'
import { Footer } from '@/components/templates/Footer/Component'
import { Header } from '@/components/templates/Header/Component'
import {
  PublicAccountMenu,
  type PublicAccountMenuLinks,
  type PublicAccountMenuState,
} from '@/components/templates/Header/PublicAccountMenu'
import { extractSupabaseUserData } from '@/auth/utilities/jwtValidation'
import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import { cookies, draftMode, headers } from 'next/headers'

import './globals.css'
import { getServerSideURL } from '@/utilities/getURL'
import { getCachedGlobal, getGlobal } from '@/utilities/getGlobals'
import { normalizeFooterNavGroups, normalizeHeaderNavItems } from '@/utilities/normalizeNavItems'
import { isNonProductionDeployment, PREVIEW_GUARD_LOCK_REQUEST_HEADER } from '@/features/previewGuard'
import { COOKIE_CONSENT_COOKIE_NAME, resolveCookieConsentContext } from '@/features/cookieConsent'
import type { Footer as FooterType, Header as HeaderType } from '@/payload-types'
import type { CookieConsent as CookieConsentType } from '@/payload-types'

const LIVE_PATIENT_ACCOUNT_MENU_LINKS: Partial<PublicAccountMenuLinks> = {
  dashboard: null,
  favorites: null,
  profile: null,
  signOut: '/logout',
}

const DEFAULT_ACCOUNT_MENU_STATE: PublicAccountMenuState = { kind: 'guest' }

const buildPatientDisplayName = (firstName?: string, lastName?: string, email?: string): string => {
  const displayName = `${firstName} ${lastName}`.trim()
  return displayName || email || 'Patient account'
}

async function resolvePublicAccountMenuState(requestHeaders: Headers): Promise<PublicAccountMenuState> {
  const authData = await extractSupabaseUserData({ headers: requestHeaders })

  if (!authData || authData.userType !== 'patient') {
    return DEFAULT_ACCOUNT_MENU_STATE
  }

  return {
    displayName: buildPatientDisplayName(authData.firstName, authData.lastName, authData.userEmail),
    email: authData.userEmail,
    kind: 'patient',
  }
}

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
  const accountMenuState = showSiteChrome
    ? await resolvePublicAccountMenuState(requestHeaders)
    : DEFAULT_ACCOUNT_MENU_STATE

  const cookieConsentContext = resolveCookieConsentContext(
    (await getGlobal('cookieConsent', 1)) as CookieConsentType,
    requestCookies.get(COOKIE_CONSENT_COOKIE_NAME)?.value ?? null,
  )

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link href="/favicon.ico" rel="icon" sizes="32x32" />
        <link href="/favicon.svg" rel="icon" type="image/svg+xml" />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <div className="flex min-h-screen min-h-svh flex-col">
          <AdminBar adminBarProps={{ preview: isEnabled }} />

          {showSiteChrome ? (
            <div className="full-width">
              <Header
                navItems={headerNavItems}
                logoSrc={headerLogoSrc}
                rightActions={<PublicAccountMenu links={LIVE_PATIENT_ACCOUNT_MENU_LINKS} state={accountMenuState} />}
                showPreviewBadge={showPreviewBadge}
              />
            </div>
          ) : null}

          {/* Content-Area: Full width, pages handle containment */}
          <main className="min-w-0 flex-1">{children}</main>

          {showSiteChrome ? (
            <div className="full-width">
              <Footer footerGroups={footerGroups} logoSrc={footerLogoSrc} showPreviewBadge={showPreviewBadge} />
            </div>
          ) : null}
        </div>
        <CookieConsentManager
          config={cookieConsentContext.config}
          initialConsent={cookieConsentContext.initialConsent}
        />
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
