import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const routeMocks = vi.hoisted(() => ({
  breadcrumbJsonLdComponent: vi.fn(() => null),
  clinicDetailComponent: vi.fn(() => null),
  cookies: vi.fn(),
  draftMode: vi.fn(),
  findFavoriteClinicStateRecord: vi.fn(),
  getClinicDetailServerData: vi.fn(),
  getGlobal: vi.fn(),
  getPayload: vi.fn(),
  headers: vi.fn(),
  notFound: vi.fn(),
  resolveCookieConsentContext: vi.fn(),
  resolveFavoriteClinicAuthContext: vi.fn(),
}))

vi.mock('@payload-config', () => ({
  default: {},
}))

vi.mock('payload', async (importOriginal) => {
  const actual = await importOriginal<typeof import('payload')>()
  return {
    ...actual,
    getPayload: routeMocks.getPayload,
  }
})

vi.mock('next/headers', () => ({
  cookies: routeMocks.cookies,
  draftMode: routeMocks.draftMode,
  headers: routeMocks.headers,
}))

vi.mock('next/navigation', () => ({
  notFound: routeMocks.notFound,
}))

vi.mock('@/components/templates/ClinicDetailConcepts', () => ({
  ClinicDetail: routeMocks.clinicDetailComponent,
}))

vi.mock('@/components/molecules/Breadcrumb/BreadcrumbJsonLd', () => ({
  BreadcrumbJsonLd: routeMocks.breadcrumbJsonLdComponent,
}))

vi.mock('@/features/cookieConsent', () => ({
  COOKIE_CONSENT_COOKIE_NAME: 'cookie-consent',
  resolveCookieConsentContext: routeMocks.resolveCookieConsentContext,
}))

vi.mock('@/features/favorites/server', () => ({
  findFavoriteClinicStateRecord: routeMocks.findFavoriteClinicStateRecord,
  resolveFavoriteClinicAuthContext: routeMocks.resolveFavoriteClinicAuthContext,
}))

vi.mock('@/utilities/clinicDetail/serverData', () => ({
  getClinicDetailServerData: routeMocks.getClinicDetailServerData,
}))

vi.mock('@/utilities/getGlobals', () => ({
  getGlobal: routeMocks.getGlobal,
}))

type ReactNodeLike = React.ReactNode

const findElementByType = (node: ReactNodeLike, type: unknown): React.ReactElement<Record<string, unknown>> | null => {
  if (Array.isArray(node)) {
    for (const child of node) {
      const match = findElementByType(child, type)
      if (match) {
        return match
      }
    }

    return null
  }

  if (!React.isValidElement(node)) {
    return null
  }

  const element = node as React.ReactElement<{ children?: ReactNodeLike }>

  if (element.type === type) {
    return element as React.ReactElement<Record<string, unknown>>
  }

  return findElementByType(element.props.children, type)
}

const clinicDetailData = {
  clinicId: 42,
  clinicSlug: 'berlin-health',
  clinicName: 'Berlin Health',
  breadcrumbs: [
    { label: 'Home', href: '/' },
    { label: 'Clinics', href: '/listing-comparison' },
    { label: 'Berlin Health', href: '/clinics/berlin-health' },
  ],
  heroImage: { src: '/hero.jpg', alt: 'Berlin Health' },
  description: 'Clinic description.',
  trust: {
    ratingValue: null,
    reviewCount: 0,
    verification: 'gold' as const,
    accreditations: [],
    languages: [],
  },
  reviews: {
    totalCount: 0,
    items: [],
  },
  treatments: [],
  doctors: [],
  beforeAfterEntries: [],
  location: {},
  freshness: {
    sourceCollections: ['clinics'],
  },
  contactHref: '/contact?clinic=berlin-health&source=clinic-detail',
}

describe('frontend clinic detail route', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()

    routeMocks.cookies.mockResolvedValue({ get: vi.fn(() => null) })
    routeMocks.draftMode.mockResolvedValue({ isEnabled: false })
    routeMocks.getClinicDetailServerData.mockResolvedValue(clinicDetailData)
    routeMocks.getGlobal.mockResolvedValue(null)
    routeMocks.getPayload.mockResolvedValue({})
    routeMocks.headers.mockResolvedValue(new Headers())
    routeMocks.resolveCookieConsentContext.mockReturnValue({
      config: null,
      initialConsent: null,
    })
    routeMocks.resolveFavoriteClinicAuthContext.mockResolvedValue({
      isPatient: false,
      patient: null,
    })
  })

  it('renders BreadcrumbList JSON-LD from clinic detail server data', async () => {
    const pageModule = await import('@/app/(frontend)/clinics/[slug]/page')
    const result = await pageModule.default({
      params: Promise.resolve({ slug: 'berlin-health' }),
    })

    const breadcrumbJsonLdElement = findElementByType(
      result,
      routeMocks.breadcrumbJsonLdComponent,
    ) as React.ReactElement<{
      items: Array<{ href: string; label: string }>
    }> | null
    expect(breadcrumbJsonLdElement?.props.items).toEqual(clinicDetailData.breadcrumbs)

    const clinicDetailElement = findElementByType(result, routeMocks.clinicDetailComponent) as React.ReactElement<{
      data: unknown
    }> | null
    expect(clinicDetailElement?.props.data).toBe(clinicDetailData)
  })
})
