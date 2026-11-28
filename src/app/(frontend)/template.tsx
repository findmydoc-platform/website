import React from 'react'

import { localizePublicNavigation, resolveAccountHref } from '@/app/(frontend)/_data/publicNavigation'
import { getHoldingLegalLinks, getPublishedNavigationPageSlugs } from '@/app/(frontend)/_data/holdingLegalLinks'
import { resolveCmsDocumentLocale } from '@/app/(frontend)/_data/documentLocale'
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
import { languageSwitcherCopy } from '@/features/languageSwitch/copy'
import { HeaderLanguageSwitcher } from '@/features/languageSwitch/HeaderLanguageSwitcher.client'
import { isNonProductionRuntime } from '@/features/runtimePolicy'
import { projectHoldingFooterGroups, projectHoldingHeaderNavItems } from '@/features/temporaryLandingMode/navigation'
import { readHoldingViewRequestHeader, readPublicSiteModeRequestHeader } from '@/features/temporaryLandingMode'
import { resolveHoldingMode } from '@/features/temporaryLandingMode/resolver'
import { PATIENT_LOGIN_PATH, PATIENT_LOGOUT_PATH } from '@/i18n/patientAuthPath'
import { FRONTEND_PATH_HEADER, UI_COPY_LOCALE_HEADER } from '@/i18n/requestLocale'
import { publicPageLocaleFromPath } from '@/i18n/publicNavigationPath'
import { getPublicChromeCopy } from '@/features/uiCopy/publicChrome'
import { getCachedGlobal } from '@/utilities/getGlobals'
import { getServerSideURL } from '@/utilities/getURL'
import { normalizeFooterNavGroups, normalizeHeaderNavItems } from '@/utilities/normalizeNavItems'
import { headers } from 'next/headers'
import type { Footer as FooterType, Header as HeaderType } from '@/payload-types'

const LIVE_PATIENT_ACCOUNT_MENU_LINKS: Partial<PublicAccountMenuLinks> = {
  profile: null,
}

const DEFAULT_ACCOUNT_MENU_STATE: PublicAccountMenuState = { kind: 'guest' }

const buildPatientDisplayName = (firstName?: string, lastName?: string): string =>
  [firstName, lastName].filter(Boolean).join(' ').trim()

function resolvePublicAccountMenuState(authData: AuthData | null, fallbackName: string): PublicAccountMenuState {
  if (!authData || authData.userType !== 'patient') {
    return DEFAULT_ACCOUNT_MENU_STATE
  }

  return {
    displayName: buildPatientDisplayName(authData.firstName, authData.lastName) || authData.userEmail || fallbackName,
    email: authData.userEmail,
    kind: 'patient',
  }
}

export default async function FrontendTemplate({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers()
  const holdingView = readHoldingViewRequestHeader(requestHeaders)
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
  const resolvedMode = requestMode ?? (await resolveHoldingMode(requestUrl)).mode
  const showSiteChrome = holdingView !== 'standalone'
  const authData = showSiteChrome ? await extractSupabaseUserData({ headers: requestHeaders }) : null
  const isHoldingPublicView = resolvedMode === 'holding' && authData?.userType !== 'platform'
  const showPreviewBadge = isNonProductionRuntime(process.env)
  const configuredHeaderLogoSrc = process.env.NEXT_PUBLIC_HEADER_LOGO_SRC?.trim() || undefined
  const configuredFooterLogoSrc = process.env.NEXT_PUBLIC_FOOTER_LOGO_SRC?.trim() || undefined
  const headerLogoSrc = configuredHeaderLogoSrc
  const footerLogoSrc = configuredFooterLogoSrc

  const pathname = requestHeaders.get(FRONTEND_PATH_HEADER) ?? '/'
  const explicitLocale = requestHeaders.get(UI_COPY_LOCALE_HEADER)
  const cmsLocale = showSiteChrome && !explicitLocale ? await resolveCmsDocumentLocale(requestHeaders) : undefined
  const locale =
    cmsLocale ??
    (explicitLocale === 'de' || explicitLocale === 'en' ? explicitLocale : publicPageLocaleFromPath(pathname))
  const copy = getPublicChromeCopy(locale)
  const [footerGlobal, headerGlobal, legalLinks, englishPages] = showSiteChrome
    ? await Promise.all([
        getCachedGlobal('footer', 1, locale)(),
        getCachedGlobal('header', 1, locale)(),
        getHoldingLegalLinks(locale),
        locale === 'en' && !isHoldingPublicView ? getPublishedNavigationPageSlugs('en') : [],
      ])
    : ([null, null, {}, []] as const)
  const localized = localizePublicNavigation({
    headerItems: normalizeHeaderNavItems(headerGlobal as HeaderType | null, locale),
    footerGroups: normalizeFooterNavGroups(footerGlobal as FooterType | null, locale),
    locale,
    holding: isHoldingPublicView,
    copy,
    legalLinks,
  })
  const footerGroups = isHoldingPublicView
    ? projectHoldingFooterGroups(localized.footerGroups, siteOrigin)
    : localized.footerGroups
  const headerNavItems = isHoldingPublicView
    ? projectHoldingHeaderNavItems(localized.headerItems, siteOrigin)
    : localized.headerItems
  const homeHref = locale === 'en' && (isHoldingPublicView || englishPages.some((slug) => slug === 'home')) ? '/en' : '/'
  const accountMenuState =
    showSiteChrome && !isHoldingPublicView
      ? resolvePublicAccountMenuState(authData, copy.account.title)
      : DEFAULT_ACCOUNT_MENU_STATE
  const accountMenuLinks: Partial<PublicAccountMenuLinks> = {
    ...LIVE_PATIENT_ACCOUNT_MENU_LINKS,
    clinicPartner: resolveAccountHref('/partners/clinics', locale),
    dashboard: resolveAccountHref('/patient/inquiries', locale),
    favorites: resolveAccountHref('/patient/favorites', locale),
    login: resolveAccountHref(PATIENT_LOGIN_PATH, locale),
    signOut: resolveAccountHref(PATIENT_LOGOUT_PATH, locale),
    registerPatient: resolveAccountHref('/register/patient', locale),
  }
  const { openPatient, ...accountCopy } = copy.account

  return (
    <>
      <FrontendChrome holdingMode={isHoldingPublicView}>
        {showSiteChrome ? (
          <div className="full-width" lang={locale}>
            <Header
              navItems={headerNavItems}
              navigationCopy={copy.nav}
              homeHref={homeHref}
              languageSwitcher={
                <HeaderLanguageSwitcher copyByLocale={languageSwitcherCopy} hideWithoutRoute={isHoldingPublicView} />
              }
              logoSrc={headerLogoSrc}
              rightActions={
                isHoldingPublicView ? null : (
                  <PublicAccountMenu
                    copy={{
                      ...accountCopy,
                      openPatient:
                        accountMenuState.kind === 'patient' ? openPatient(accountMenuState.displayName) : undefined,
                    }}
                    lang={locale}
                    links={accountMenuLinks}
                    state={accountMenuState}
                  />
                )
              }
              showPreviewBadge={showPreviewBadge}
            />
          </div>
        ) : null}

        {showSiteChrome && showPreviewBadge ? (
          <div className="full-width">
            <PreviewDataNotice {...copy.preview} lang={locale} />
          </div>
        ) : null}
      </FrontendChrome>

      <main className="min-w-0 flex-1">{children}</main>

      <FrontendChrome holdingMode={isHoldingPublicView}>
        {showSiteChrome ? (
          <div className="full-width" lang={locale}>
            <Footer
              footerGroups={footerGroups}
              copy={copy.footer}
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
