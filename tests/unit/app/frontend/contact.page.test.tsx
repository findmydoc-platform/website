import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createSiteMetadataMock: vi.fn((args: unknown) => args),
  landingContactComponent: vi.fn(() => null),
}))

vi.mock('@/components/organisms/Landing/LandingContact', () => ({
  LandingContact: mocks.landingContactComponent,
}))

vi.mock('@/utilities/generateMeta', () => ({
  createSiteMetadata: mocks.createSiteMetadataMock,
}))

describe('frontend contact page route', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('sets metadata for the canonical contact route', async () => {
    const pageModule = await import('@/app/(frontend)/contact/page')

    expect(pageModule.metadata).toEqual({
      title: 'Contact',
      description:
        'Send us your request about clinic comparisons, patient support, clinic partnerships, or platform questions.',
      path: '/contact',
      alternates: {
        canonical: '/contact',
      },
    })
    expect(mocks.createSiteMetadataMock).toHaveBeenCalledWith({
      title: 'Contact',
      description:
        'Send us your request about clinic comparisons, patient support, clinic partnerships, or platform questions.',
      path: '/contact',
    })
  })

  it('renders the shared contact form with an h1 and allowed tracking fields', async () => {
    const pageModule = await import('@/app/(frontend)/contact/page')

    const result = await pageModule.default({
      searchParams: Promise.resolve({
        clinic: [' berlin-health-clinic ', 'ignored-second-value'],
        source: 'clinic-detail',
        ignored: 'not-forwarded',
      }),
    })

    expect(result.type).toBe('main')
    expect(result.props.children.type).toBe(mocks.landingContactComponent)
    expect(result.props.children.props).toMatchObject({
      title: 'Contact findmydoc',
      headingAs: 'h1',
      trackingFields: {
        clinic: 'berlin-health-clinic',
        source: 'clinic-detail',
      },
    })
    expect(result.props.children.props.trackingFields).not.toHaveProperty('ignored')
  })
})
