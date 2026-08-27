import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const routeMocks = vi.hoisted(() => ({
  buildClinicDetailPageJsonLd: vi.fn(() => [{ '@type': 'MedicalClinic' }]),
  clinicDetailComponent: vi.fn(() => null),
  cookies: vi.fn(),
  draftMode: vi.fn(),
  findFavoriteClinicStateRecord: vi.fn(),
  getCachedPublicClinicDetailServerData: vi.fn(),
  getClinicDetailServerData: vi.fn(),
  getGlobal: vi.fn(),
  getPayload: vi.fn(),
  headers: vi.fn(),
  jsonLdScriptComponent: vi.fn(() => null),
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

vi.mock('@/features/cookieConsent', () => ({
  COOKIE_CONSENT_COOKIE_NAME: 'cookie-consent',
  resolveCookieConsentContext: routeMocks.resolveCookieConsentContext,
}))

vi.mock('@/features/favorites/server', () => ({
  findFavoriteClinicStateRecord: routeMocks.findFavoriteClinicStateRecord,
  resolveFavoriteClinicAuthContext: routeMocks.resolveFavoriteClinicAuthContext,
}))

vi.mock('@/utilities/clinicDetail/serverData', () => ({
  getCachedPublicClinicDetailServerData: routeMocks.getCachedPublicClinicDetailServerData,
  getClinicDetailServerData: routeMocks.getClinicDetailServerData,
}))

vi.mock('@/utilities/getGlobals', () => ({
  getGlobal: routeMocks.getGlobal,
}))

vi.mock('@/utilities/structuredData', () => ({
  buildClinicDetailPageJsonLd: routeMocks.buildClinicDetailPageJsonLd,
  JsonLdScript: routeMocks.jsonLdScriptComponent,
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

    routeMocks.cookies.mockResolvedValue({ get: vi.fn(() => null), getAll: vi.fn(() => []) })
    routeMocks.draftMode.mockResolvedValue({ isEnabled: false })
    routeMocks.getCachedPublicClinicDetailServerData.mockResolvedValue(clinicDetailData)
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

  it('renders clinic detail JSON-LD from clinic detail server data', async () => {
    const pageModule = await import('@/app/(frontend)/clinics/[slug]/page')
    const result = await pageModule.default({
      params: Promise.resolve({ slug: 'berlin-health' }),
    })

    expect(routeMocks.buildClinicDetailPageJsonLd).toHaveBeenCalledWith(clinicDetailData)
    expect(routeMocks.getCachedPublicClinicDetailServerData).toHaveBeenCalledWith('berlin-health')
    expect(routeMocks.getClinicDetailServerData).not.toHaveBeenCalled()
    const jsonLdElement = findElementByType(result, routeMocks.jsonLdScriptComponent) as React.ReactElement<{
      data: unknown
    }> | null
    expect(jsonLdElement?.props.data).toEqual([{ '@type': 'MedicalClinic' }])

    const clinicDetailElement = findElementByType(result, routeMocks.clinicDetailComponent) as React.ReactElement<{
      data: unknown
    }> | null
    expect(clinicDetailElement?.props.data).toBe(clinicDetailData)
  })

  it('keeps draft clinic detail reads live', async () => {
    routeMocks.draftMode.mockResolvedValue({ isEnabled: true })
    const pageModule = await import('@/app/(frontend)/clinics/[slug]/page')

    await pageModule.default({
      params: Promise.resolve({ slug: 'berlin-health' }),
    })

    expect(routeMocks.getClinicDetailServerData).toHaveBeenCalledWith({}, 'berlin-health', { draft: true })
    expect(routeMocks.getCachedPublicClinicDetailServerData).not.toHaveBeenCalled()
  })

  it('passes server-resolved patient account data to the private clinic form context', async () => {
    routeMocks.resolveFavoriteClinicAuthContext.mockResolvedValue({
      isPatient: true,
      patient: {
        id: 17,
        email: 'account.patient@example.com',
        firstName: 'Account',
        lastName: 'Patient',
        phoneNumber: '+49 30 123456',
      },
    })
    routeMocks.findFavoriteClinicStateRecord.mockResolvedValue({})
    const pageModule = await import('@/app/(frontend)/clinics/[slug]/page')
    const result = await pageModule.default({ params: Promise.resolve({ slug: 'berlin-health' }) })

    const clinicDetailElement = findElementByType(result, routeMocks.clinicDetailComponent)
    expect(clinicDetailElement?.props.inquiryCreation).toEqual({
      kind: 'authenticated',
      loginHref: '/login/patient?next=%2Fclinics%2Fberlin-health',
      account: {
        email: 'account.patient@example.com',
        firstName: 'Account',
        lastName: 'Patient',
        phoneNumber: '+49 30 123456',
      },
    })
  })

  it('marks an unresolved Supabase session for reauthentication instead of guest submission', async () => {
    routeMocks.cookies.mockResolvedValue({
      get: vi.fn(() => null),
      getAll: vi.fn(() => [{ name: 'sb-synthetic-auth-token', value: 'expired' }]),
    })
    const pageModule = await import('@/app/(frontend)/clinics/[slug]/page')
    const result = await pageModule.default({ params: Promise.resolve({ slug: 'berlin-health' }) })

    const clinicDetailElement = findElementByType(result, routeMocks.clinicDetailComponent)
    expect(clinicDetailElement?.props.inquiryCreation).toEqual({
      kind: 'reauthentication-required',
      loginHref: '/login/patient?next=%2Fclinics%2Fberlin-health',
    })
  })
})
