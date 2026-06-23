import type { Metadata } from 'next'
import { cookies, draftMode, headers } from 'next/headers'
import { notFound } from 'next/navigation'
import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { ClinicDetail } from '@/components/templates/ClinicDetailConcepts'
import { COOKIE_CONSENT_COOKIE_NAME, resolveCookieConsentContext } from '@/features/cookieConsent'
import { buildPatientLoginHref } from '@/features/favorites/redirects'
import { findFavoriteClinicStateRecord, resolveFavoriteClinicAuthContext } from '@/features/favorites/server'
import { getClinicDetailServerData } from '@/utilities/clinicDetail/serverData'
import { createSiteMetadata } from '@/utilities/generateMeta'
import { getGlobal } from '@/utilities/getGlobals'
import { JsonLdScript, buildClinicDetailPageJsonLd } from '@/utilities/structuredData'
import type { CookieConsent as CookieConsentType } from '@/payload-types'

type ClinicDetailPageArgs = {
  params: Promise<{
    slug: string
  }>
}

export const dynamic = 'force-dynamic'

export default async function ClinicDetailPage({ params: paramsPromise }: ClinicDetailPageArgs) {
  const { slug } = await paramsPromise
  const { isEnabled: draft } = await draftMode()
  const payload = await getPayload({ config: configPromise })
  const requestHeaders = await headers()
  const requestCookies = await cookies()

  const clinicDetailData = await getClinicDetailServerData(payload, slug, {
    draft,
  })
  const cookieConsentContext = resolveCookieConsentContext(
    (await getGlobal('cookieConsent', 1)) as CookieConsentType,
    requestCookies.get(COOKIE_CONSENT_COOKIE_NAME)?.value ?? null,
  )

  if (!clinicDetailData) {
    notFound()
  }

  const favoriteAuthContext = await resolveFavoriteClinicAuthContext({
    payload,
    headers: requestHeaders,
  })
  const favoriteStateByClinicId = favoriteAuthContext.patient
    ? await findFavoriteClinicStateRecord({
        payload,
        patientId: favoriteAuthContext.patient.id,
        clinicIds: [clinicDetailData.clinicId],
      })
    : {}
  const clinicPath = `/clinics/${encodeURIComponent(slug)}`

  return (
    <>
      <JsonLdScript data={draft ? null : buildClinicDetailPageJsonLd(clinicDetailData)} />
      <ClinicDetail
        data={clinicDetailData}
        favorite={{
          isPatient: favoriteAuthContext.isPatient,
          favoriteId: favoriteStateByClinicId[String(clinicDetailData.clinicId)] ?? null,
          loginHref: buildPatientLoginHref(clinicPath),
        }}
        cookieConsentConfig={cookieConsentContext.config}
        cookieConsentInitialConsent={cookieConsentContext.initialConsent}
      />
    </>
  )
}

export async function generateMetadata({ params: paramsPromise }: ClinicDetailPageArgs): Promise<Metadata> {
  const { slug } = await paramsPromise
  const { isEnabled: draft } = await draftMode()
  const payload = await getPayload({ config: configPromise })

  const clinicDetailData = await getClinicDetailServerData(payload, slug, {
    draft,
  })

  if (!clinicDetailData) {
    return createSiteMetadata({
      title: 'Clinic Profile',
      path: `/clinics/${slug}`,
    })
  }

  return createSiteMetadata({
    title: clinicDetailData.clinicName,
    description: clinicDetailData.description,
    path: `/clinics/${slug}`,
    freshness: clinicDetailData.freshness,
  })
}
