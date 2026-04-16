import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { TEMPORARY_LANDING_MODE_REQUEST_HEADER } from '@/features/temporaryLandingMode'

const mocks = vi.hoisted(() => ({
  headersMock: vi.fn(),
  getPayloadMock: vi.fn(),
  payloadFindMock: vi.fn(),
  getLandingMedicalSpecialtyCategoriesMock: vi.fn(),
  normalizePostMock: vi.fn((post: unknown) => post),
  temporaryLandingPageComponent: vi.fn(() => null),
}))

vi.mock('next/headers', () => ({
  headers: mocks.headersMock,
}))

vi.mock('@payload-config', () => ({
  default: {},
}))

vi.mock('payload', async (importOriginal) => {
  const actual = await importOriginal<typeof import('payload')>()
  return {
    ...actual,
    getPayload: mocks.getPayloadMock,
  }
})

vi.mock('@/utilities/landing/medicalSpecialtyCategories', () => ({
  getLandingMedicalSpecialtyCategories: mocks.getLandingMedicalSpecialtyCategoriesMock,
}))

vi.mock('@/utilities/blog/normalizePost', () => ({
  normalizePost: mocks.normalizePostMock,
}))

vi.mock('@/components/templates/TemporaryLandingPage', () => ({
  TemporaryLandingPage: mocks.temporaryLandingPageComponent,
}))

describe('frontend home page route', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()

    mocks.headersMock.mockResolvedValue(new Headers())
    mocks.payloadFindMock.mockResolvedValue({ docs: [] })
    mocks.getLandingMedicalSpecialtyCategoriesMock.mockResolvedValue({
      categories: [],
      items: [],
      featuredIds: [],
    })

    mocks.getPayloadMock.mockResolvedValue({
      find: mocks.payloadFindMock,
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('returns temporary landing page when landing request header is set', async () => {
    mocks.headersMock.mockResolvedValue(new Headers({ [TEMPORARY_LANDING_MODE_REQUEST_HEADER]: '1' }))

    const pageModule = await import('@/app/(frontend)/page')
    const result = await pageModule.default()

    expect(mocks.getPayloadMock).not.toHaveBeenCalled()
    expect(result.type).toBe(mocks.temporaryLandingPageComponent)
    expect(result.props.locale).toBe('en')
    expect(result.props.languageOptions).toEqual([
      { value: 'en', label: 'EN', href: '/?lang=en' },
      { value: 'de', label: 'DE', href: '/?lang=de' },
      { value: 'tr', label: 'TR', href: '/?lang=tr' },
    ])
  })

  it('passes resolved locale and language options to temporary landing page', async () => {
    mocks.headersMock.mockResolvedValue(new Headers({ [TEMPORARY_LANDING_MODE_REQUEST_HEADER]: '1' }))

    const pageModule = await import('@/app/(frontend)/page')
    const result = await pageModule.default({
      searchParams: Promise.resolve({
        foo: 'bar',
        lang: 'de',
      }),
    })

    expect(result.type).toBe(mocks.temporaryLandingPageComponent)
    expect(result.props.locale).toBe('de')
    expect(result.props.languageOptions).toEqual([
      { value: 'en', label: 'EN', href: '/?foo=bar&lang=en' },
      { value: 'de', label: 'DE', href: '/?foo=bar&lang=de' },
      { value: 'tr', label: 'TR', href: '/?foo=bar&lang=tr' },
    ])
  })

  it('returns temporary landing metadata from the localized landing copy', async () => {
    mocks.headersMock.mockResolvedValue(new Headers({ [TEMPORARY_LANDING_MODE_REQUEST_HEADER]: '1' }))

    const pageModule = await import('@/app/(frontend)/page')
    await expect(
      pageModule.generateMetadata({
        searchParams: Promise.resolve({
          lang: 'en',
        }),
      }),
    ).resolves.toEqual({
      title: 'findmydoc | Better matches for treatments abroad.',
      description:
        'Structured clinic profiles and transparent quality signals - so patients can compare faster and clinics receive suitable inquiries.',
    })

    await expect(
      pageModule.generateMetadata({
        searchParams: Promise.resolve({
          lang: 'de',
        }),
      }),
    ).resolves.toEqual({
      title: 'findmydoc | Eine Vergleichsplattform für Schönheitskliniken.',
      description:
        'Strukturierte Klinikprofile und transparente Qualitäts-Signale - damit du die passende Klinik mit mehr Vertrauen findest.',
    })

    await expect(
      pageModule.generateMetadata({
        searchParams: Promise.resolve({
          lang: 'tr',
        }),
      }),
    ).resolves.toEqual({
      title: 'findmydoc | Avrupa’dan daha nitelikli başvurular.',
      description:
        'Yapılandırılmış klinik profilleri ve net kalite göstergeleri - böylece klinikler görünür olur ve kendilerine uygun başvurular alır.',
    })
  })

  it('loads regular homepage data when landing request header is missing', async () => {
    const pageModule = await import('@/app/(frontend)/page')
    await pageModule.default()

    expect(mocks.getPayloadMock).toHaveBeenCalledTimes(1)
    expect(mocks.payloadFindMock).toHaveBeenCalledTimes(1)
    expect(mocks.getLandingMedicalSpecialtyCategoriesMock).toHaveBeenCalledTimes(1)
  })

  it('returns default homepage metadata when landing request header is missing', async () => {
    const pageModule = await import('@/app/(frontend)/page')
    const metadata = await pageModule.generateMetadata()

    expect(metadata).toEqual({
      title: 'Gain International Patients | Global Clinic Visibility Platform',
      description:
        'Gain international patients through a trusted comparison platform. Increase clinic reach, visibility, and qualified global patient inquiries.',
    })
  })
})
