import React from 'react'

import { FrontendChrome } from '@/app/(frontend)/FrontendChrome.client'
import { extractSupabaseUserData } from '@/auth/utilities/jwtValidation'
import type { AuthData } from '@/auth/types/authTypes'
import { Footer } from '@/components/templates/Footer/Component'
import { Header } from '@/components/templates/Header/Component'
import {
  PublicAccountMenu,
  type PublicAccountMenuLinks,
  type PublicAccountMenuState,
} from '@/components/templates/Header/PublicAccountMenu'
import { PreviewDataNotice } from '@/components/templates/PreviewDataNotice/Component'
import {
  PREVIEW_GUARD_ACTIVE_REQUEST_HEADER,
  PREVIEW_GUARD_LOCK_REQUEST_HEADER,
  isPreviewDeployment,
  isNonProductionDeployment,
} from '@/features/previewGuard'
import { projectHoldingFooterGroups, projectHoldingHeaderNavItems } from '@/features/temporaryLandingMode/navigation'
import { readPublicSiteModeRequestHeader } from '@/features/temporaryLandingMode'
import { resolveHoldingMode } from '@/features/temporaryLandingMode/resolver'
import { getCachedGlobal } from '@/utilities/getGlobals'
import { getServerSideURL } from '@/utilities/getURL'
import { normalizeFooterNavGroups, normalizeHeaderNavItems } from '@/utilities/normalizeNavItems'
import { headers } from 'next/headers'
import type { Footer as FooterType, Header as HeaderType } from '@/payload-types'

const LIVE_PATIENT_ACCOUNT_MENU_LINKS: Partial<PublicAccountMenuLinks> = {
  dashboard: '/patient/inquiries',
  favorites: '/patient/favorites',
  profile: null,
  signOut: '/logout',
}

const DEFAULT_ACCOUNT_MENU_STATE: PublicAccountMenuState = { kind: 'guest' }

const buildPatientDisplayName = (firstName?: string, lastName?: string, email?: string): string => {
  const displayName = `${firstName} ${lastName}`.trim()
  return displayName || email || 'Patient account'
}

function resolvePublicAccountMenuState(authData: AuthData | null): PublicAccountMenuState {
  if (!authData || authData.userType !== 'patient') {
    return DEFAULT_ACCOUNT_MENU_STATE
  }

  return {
    displayName: buildPatientDisplayName(authData.firstName, authData.lastName, authData.userEmail),
    email: authData.userEmail,
    kind: 'patient',
  }
}

export default async function FrontendTemplate({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers()
  const isGuardLocked = requestHeaders.get(PREVIEW_GUARD_LOCK_REQUEST_HEADER) === '1'
  const isPreviewGuardActive =
    requestHeaders.get(PREVIEW_GUARD_ACTIVE_REQUEST_HEADER) === '1' || isPreviewDeployment(process.env)
  const requestMode = readPublicSiteModeRequestHeader(requestHeaders)
  const siteOrigin = getServerSideURL()
  const requestHost = requestHeaders.get('host')
  let requestUrl = new URL(siteOrigin)
  if (requestHost) {
    try {
      requestUrl = new URL(`http://${requestHost}`)
    } catch {
      // Fall back to the configured site origin when the request host is malformed.
    }
  }
  const resolvedMode = requestMode ?? (isPreviewGuardActive ? null : (await resolveHoldingMode(requestUrl)).mode)
  const showSiteChrome = !isGuardLocked
  const authData = showSiteChrome ? await extractSupabaseUserData({ headers: requestHeaders }) : null
  const isHoldingPublicView = resolvedMode === 'holding' && !isPreviewGuardActive && authData?.userType !== 'platform'
  const showPreviewBadge = isNonProductionDeployment(process.env)
  const configuredHeaderLogoSrc = process.env.NEXT_PUBLIC_HEADER_LOGO_SRC?.trim() || undefined
  const configuredFooterLogoSrc = process.env.NEXT_PUBLIC_FOOTER_LOGO_SRC?.trim() || undefined
  const headerLogoSrc = configuredHeaderLogoSrc
  const footerLogoSrc = configuredFooterLogoSrc

  const normalizedFooterGroups = showSiteChrome
    ? normalizeFooterNavGroups((await getCachedGlobal('footer', 1)()) as FooterType)
    : []
  const normalizedHeaderNavItems = showSiteChrome
    ? normalizeHeaderNavItems((await getCachedGlobal('header', 1)()) as HeaderType)
    : []
  const footerGroups = isHoldingPublicView
    ? projectHoldingFooterGroups(normalizedFooterGroups, siteOrigin)
    : normalizedFooterGroups
  const headerNavItems = isHoldingPublicView
    ? projectHoldingHeaderNavItems(normalizedHeaderNavItems, siteOrigin)
    : normalizedHeaderNavItems
  const accountMenuState =
    showSiteChrome && !isHoldingPublicView ? resolvePublicAccountMenuState(authData) : DEFAULT_ACCOUNT_MENU_STATE

  return (
    <>
      <FrontendChrome holdingMode={isHoldingPublicView}>
        {showSiteChrome ? (
          <div className="full-width">
            <Header
              navItems={headerNavItems}
              logoSrc={headerLogoSrc}
              rightActions={
                isHoldingPublicView ? null : (
                  <PublicAccountMenu links={LIVE_PATIENT_ACCOUNT_MENU_LINKS} state={accountMenuState} />
                )
              }
              showPreviewBadge={showPreviewBadge}
            />
          </div>
        ) : null}

        {showSiteChrome && showPreviewBadge ? (
          <div className="full-width">
            <PreviewDataNotice />
          </div>
        ) : null}
      </FrontendChrome>

      <main className="min-w-0 flex-1">{children}</main>

      <FrontendChrome holdingMode={isHoldingPublicView}>
        {showSiteChrome ? (
          <div className="full-width">
            <Footer
              footerGroups={footerGroups}
              logoSrc={footerLogoSrc}
              showPreviewBadge={showPreviewBadge}
              holdingMode={isHoldingPublicView}
            />
          </div>
        ) : null}
      </FrontendChrome>
    </>
  )
}
