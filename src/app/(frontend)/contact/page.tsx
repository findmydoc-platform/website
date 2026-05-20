import type { Metadata } from 'next'

import { PublicContactSection } from '@/components/organisms/Contact'
import { createSiteMetadata } from '@/utilities/generateMeta'

const CONTACT_TITLE = 'Contact findmydoc'
const CONTACT_DESCRIPTION =
  'Send us your request about clinic comparisons, patient support, clinic partnerships, or platform questions.'

const TRACKING_QUERY_FIELDS = ['clinic', 'source'] as const
const MAX_TRACKING_VALUE_LENGTH = 200

type ContactSearchParams = Record<string, string | string[] | undefined>
type TrackingQueryField = (typeof TRACKING_QUERY_FIELDS)[number]

export const metadata: Metadata = {
  ...createSiteMetadata({
    title: 'Contact',
    description: CONTACT_DESCRIPTION,
    path: '/contact',
  }),
  alternates: {
    canonical: '/contact',
  },
}

function readSearchParamValue(value: string | string[] | undefined): string | null {
  const rawValue = Array.isArray(value) ? value[0] : value
  const normalizedValue = rawValue?.trim()

  if (!normalizedValue) return null

  return normalizedValue.slice(0, MAX_TRACKING_VALUE_LENGTH)
}

function buildTrackingFields(searchParams: ContactSearchParams): Partial<Record<TrackingQueryField, string>> {
  return Object.fromEntries(
    TRACKING_QUERY_FIELDS.flatMap((field) => {
      const value = readSearchParamValue(searchParams[field])

      return value ? [[field, value]] : []
    }),
  ) as Partial<Record<TrackingQueryField, string>>
}

export default async function ContactPage({
  searchParams: searchParamsPromise,
}: {
  searchParams?: Promise<ContactSearchParams>
} = {}) {
  const searchParams = (await searchParamsPromise) ?? {}
  const trackingFields = buildTrackingFields(searchParams)

  return (
    <main>
      <PublicContactSection
        title={CONTACT_TITLE}
        description={CONTACT_DESCRIPTION}
        headingAs="h1"
        trackingFields={trackingFields}
      />
    </main>
  )
}
