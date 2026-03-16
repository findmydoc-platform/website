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
  })

  it('loads regular homepage data when landing request header is missing', async () => {
    const pageModule = await import('@/app/(frontend)/page')
    await pageModule.default()

    expect(mocks.getPayloadMock).toHaveBeenCalledTimes(1)
    expect(mocks.payloadFindMock).toHaveBeenCalledTimes(1)
    expect(mocks.getLandingMedicalSpecialtyCategoriesMock).toHaveBeenCalledTimes(1)
  })
})
