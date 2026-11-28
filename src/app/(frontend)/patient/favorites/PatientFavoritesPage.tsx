import configPromise from '@payload-config'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload, type Payload } from 'payload'
import { Suspense } from 'react'

import { Button } from '@/components/atoms/button'
import { Heading } from '@/components/atoms/Heading'
import { Container } from '@/components/molecules/Container'
import { getSavedClinicsTranslator } from '@/features/favorites/copy'
import { FavoriteClinicsList } from '@/features/favorites/FavoriteClinicsList.client'
import { buildPatientLoginHref } from '@/features/favorites/redirects'
import { findPatientFavoriteClinicListItems, resolveFavoriteClinicAuthContext } from '@/features/favorites/server'
import { LanguageSwitchRoute } from '@/features/languageSwitch/LanguageSwitchRouteProvider.client'
import type { UiCopyLocale } from '@/i18n/requestLocale'
import { SAVED_CLINICS_PATHS } from '@/i18n/savedClinicsPath'
import { createSiteMetadata } from '@/utilities/generateMeta'

export function patientFavoritesMetadata(locale: UiCopyLocale): Metadata {
  const translate = getSavedClinicsTranslator(locale)
  return {
    ...createSiteMetadata({
      title: translate('title'),
      description: translate('description'),
      path: SAVED_CLINICS_PATHS[locale],
    }),
    robots: { index: false, follow: false, noarchive: true },
  }
}

async function SavedClinicsContent({
  payload,
  patientId,
  locale,
}: {
  payload: Payload
  patientId: number
  locale: UiCopyLocale
}) {
  try {
    const items = await findPatientFavoriteClinicListItems({ payload, patientId })
    return <FavoriteClinicsList initialItems={items} locale={locale} />
  } catch {
    payload.logger.error('Could not read saved clinics')
    const translate = getSavedClinicsTranslator(locale)

    return (
      <div className="space-y-4">
        <Heading as="h1" size="h2" align="left">
          {translate('title')}
        </Heading>
        <p role="alert">{translate('loadError')}</p>
        <form action={SAVED_CLINICS_PATHS[locale]}>
          <Button type="submit">{translate('retry')}</Button>
        </form>
      </div>
    )
  }
}

export async function renderPatientFavoritesPage(locale: UiCopyLocale) {
  const [requestHeaders, payload] = await Promise.all([headers(), getPayload({ config: configPromise })])
  const { patient } = await resolveFavoriteClinicAuthContext({ payload, headers: requestHeaders })

  if (!patient) redirect(buildPatientLoginHref(SAVED_CLINICS_PATHS[locale], locale))

  const translate = getSavedClinicsTranslator(locale)
  return (
    <div className="bg-site-section py-8 sm:py-12 lg:py-14">
      <LanguageSwitchRoute locale={locale} targets={SAVED_CLINICS_PATHS} />
      <Container>
        <Suspense fallback={<p role="status">{translate('loading')}</p>}>
          <SavedClinicsContent payload={payload} patientId={patient.id} locale={locale} />
        </Suspense>
      </Container>
    </div>
  )
}
