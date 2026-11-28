import type { Metadata } from 'next'
import { cookies, draftMode, headers } from 'next/headers'
import { notFound } from 'next/navigation'
import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { COOKIE_CONSENT_COOKIE_NAME, parseCookieConsentState } from '@/features/cookieConsent'
import { CmsLanguageSwitchRoute } from '@/features/languageSwitch/CmsLanguageSwitchRoute.client'
import { clinicProfilePath } from '@/i18n/clinicProfilePath'
import type { UiCopyLocale } from '@/i18n/requestLocale'
import { getCookieConsentConfigs } from '@/app/(frontend)/_data/cookieConsent'
import { buildPatientLoginHref } from '@/features/favorites/redirects'
import { findFavoriteClinicStateRecord, resolveFavoriteClinicAuthContext } from '@/features/favorites/server'
import { hasSupabaseAuthenticationAttempt } from '@/features/patientInquiries/creationContext'
import { getCachedPublicClinicDetailServerData, getClinicDetailServerData } from '@/utilities/clinicDetail/serverData'
import { createSiteMetadata } from '@/utilities/generateMeta'
import { JsonLdScript, buildClinicDetailPageJsonLd } from '@/utilities/structuredData'

import { ClinicDetailClientAdapter } from './ClinicDetailClientAdapter.client'

export type ClinicDetailPageArgs = {
  params: Promise<{
    slug: string
  }>
}

export async function renderClinicProfile({ params }: ClinicDetailPageArgs, locale: UiCopyLocale) {
  const { slug } = await params
  const [{ isEnabled: draft }, payload, requestHeaders, requestCookies] = await Promise.all([
    draftMode(),
    getPayload({ config: configPromise }),
    headers(),
    cookies(),
  ])

  const clinicDetailData = draft
    ? await getClinicDetailServerData(payload, slug, { draft, locale })
    : await getCachedPublicClinicDetailServerData(slug, locale)
  if (!clinicDetailData) notFound()

  const [cookieConsentConfigs, favoriteAuthContext] = await Promise.all([
    getCookieConsentConfigs(),
    resolveFavoriteClinicAuthContext({ payload, headers: requestHeaders }),
  ])
  const cookieConsentConfig = cookieConsentConfigs[locale]
  const cookieConsentInitialConsent = cookieConsentConfig
    ? parseCookieConsentState(
        requestCookies.get(COOKIE_CONSENT_COOKIE_NAME)?.value ?? null,
        cookieConsentConfig.consentVersion,
      )
    : null

  const favoriteStateByClinicId = favoriteAuthContext.patient
    ? await findFavoriteClinicStateRecord({
        payload,
        patientId: favoriteAuthContext.patient.id,
        clinicIds: [clinicDetailData.clinicId],
      })
    : {}
  const clinicPath = clinicProfilePath(clinicDetailData.clinicSlug, locale)
  const loginHref = buildPatientLoginHref(clinicPath, locale)
  const inquiryCreation = favoriteAuthContext.patient
    ? {
        account: {
          email: favoriteAuthContext.patient.email,
          firstName: favoriteAuthContext.patient.firstName,
          lastName: favoriteAuthContext.patient.lastName,
          phoneNumber: favoriteAuthContext.patient.phoneNumber ?? '',
        },
        kind: 'authenticated' as const,
        loginHref,
      }
    : hasSupabaseAuthenticationAttempt({
          cookieNames: requestCookies.getAll().map(({ name }) => name),
          headers: requestHeaders,
        })
      ? { kind: 'reauthentication-required' as const, loginHref }
      : { kind: 'guest' as const }

  return (
    <>
      {!draft ? (
        <CmsLanguageSwitchRoute locale={locale} targets={clinicLanguagePaths(clinicDetailData.clinicSlug)} />
      ) : null}
      <JsonLdScript data={draft ? null : buildClinicDetailPageJsonLd(clinicDetailData, locale)} />
      <ClinicDetailClientAdapter
        data={clinicDetailData}
        locale={locale}
        favorite={{
          isPatient: favoriteAuthContext.isPatient,
          favoriteId: favoriteStateByClinicId[String(clinicDetailData.clinicId)] ?? null,
          loginHref,
          locale,
        }}
        inquiryCreation={inquiryCreation}
        cookieConsentConfig={cookieConsentConfig}
        cookieConsentInitialConsent={cookieConsentInitialConsent}
      />
    </>
  )
}

function clinicLanguagePaths(slug: string) {
  return { de: clinicProfilePath(slug, 'de'), en: clinicProfilePath(slug, 'en') }
}

export async function generateClinicProfileMetadata(
  { params }: ClinicDetailPageArgs,
  locale: UiCopyLocale,
): Promise<Metadata> {
  const { slug } = await params
  const { isEnabled: draft } = await draftMode()
  if (draft) return { robots: { index: false, follow: false } }

  const clinic = await getCachedPublicClinicDetailServerData(slug, locale)
  if (!clinic) return { robots: { index: false, follow: false } }

  const paths = clinicLanguagePaths(clinic.clinicSlug)
  return {
    ...createSiteMetadata({
      title: clinic.clinicName,
      description: clinic.description,
      path: paths[locale],
      freshness: clinic.freshness,
    }),
    alternates: { canonical: paths[locale], languages: { ...paths, 'x-default': paths.de } },
  }
}
