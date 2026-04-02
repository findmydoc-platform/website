import type { Metadata } from 'next'
import { cookies, draftMode } from 'next/headers'
import { notFound } from 'next/navigation'
import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { ClinicDetail } from '@/components/templates/ClinicDetailConcepts'
import { COOKIE_CONSENT_COOKIE_NAME, resolveCookieConsentContext } from '@/features/cookieConsent'
import { getClinicDetailServerData } from '@/utilities/clinicDetail/serverData'
import { getGlobal } from '@/utilities/getGlobals'
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

  return (
    <ClinicDetail
      data={clinicDetailData}
      cookieConsentConfig={cookieConsentContext.config}
      cookieConsentInitialConsent={cookieConsentContext.initialConsent}
    />
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
    return {
      title: 'Clinic Profile | findmydoc',
    }
  }

  return {
    title: `${clinicDetailData.clinicName} | findmydoc`,
    description: clinicDetailData.description,
  }
}
