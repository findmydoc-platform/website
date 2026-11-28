import type { Metadata } from 'next'

import { headers } from 'next/headers'

import { LocalizedPublicContactSection } from '@/features/contactRequests/LocalizedPublicContactSection'
import { LanguageSwitchRoute } from '@/features/languageSwitch/LanguageSwitchRouteProvider.client'
import { isTemporaryLandingModeRequest } from '@/features/temporaryLandingMode'
import { publicContactCopy } from '@/features/uiCopy/publicContact'
import { CONTACT_PATHS } from '@/i18n/contactPath'
import type { UiCopyLocale } from '@/i18n/requestLocale'
import { createSiteMetadata } from '@/utilities/generateMeta'

const TRACKING_QUERY_FIELDS = ['clinic', 'source'] as const
const MAX_TRACKING_VALUE_LENGTH = 120
const TRACKING_VALUE_PATTERN = /^[a-zA-Z0-9_-]+$/

type ContactSearchParams = Record<string, string | string[] | undefined>
type TrackingQueryField = (typeof TRACKING_QUERY_FIELDS)[number]

export async function contactMetadata(locale: UiCopyLocale): Promise<Metadata> {
  const [copy, requestHeaders] = await Promise.all([publicContactCopy(locale), headers()])
  const path = CONTACT_PATHS[locale]
  const metadata = createSiteMetadata({ title: copy.title, description: copy.description, path })
  if (isTemporaryLandingModeRequest(requestHeaders)) return { ...metadata, robots: { index: false, follow: false } }

  return {
    ...metadata,
    alternates: {
      canonical: path,
      languages: { ...CONTACT_PATHS, 'x-default': CONTACT_PATHS.de },
    },
  }
}

function readSearchParamValue(value: string | string[] | undefined): string | null {
  const rawValue = Array.isArray(value) ? value[0] : value
  const normalizedValue = rawValue?.trim()

  if (!normalizedValue) return null

  const truncatedValue = normalizedValue.slice(0, MAX_TRACKING_VALUE_LENGTH)
  return TRACKING_VALUE_PATTERN.test(truncatedValue) ? truncatedValue : null
}

function buildSubmissionMetadata(searchParams: ContactSearchParams): Partial<Record<TrackingQueryField, string>> {
  return Object.fromEntries(
    TRACKING_QUERY_FIELDS.flatMap((field) => {
      const value = readSearchParamValue(searchParams[field])

      return value ? [[field, value]] : []
    }),
  ) as Partial<Record<TrackingQueryField, string>>
}

export type ContactPageArgs = { searchParams?: Promise<ContactSearchParams> }

export async function renderContactPage(locale: UiCopyLocale, { searchParams }: ContactPageArgs) {
  const submissionMetadata = buildSubmissionMetadata((await searchParams) ?? {})
  const tracking = new URLSearchParams(submissionMetadata).toString()
  const query = tracking ? `?${tracking}` : ''

  return (
    <main>
      <LanguageSwitchRoute locale={locale} targets={{ de: CONTACT_PATHS.de + query, en: CONTACT_PATHS.en + query }} />
      <LocalizedPublicContactSection locale={locale} headingAs="h1" submissionMetadata={submissionMetadata} />
    </main>
  )
}
