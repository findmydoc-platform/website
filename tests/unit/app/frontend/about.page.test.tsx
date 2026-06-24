import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const aboutContent = {
    metadata: {
      title: 'About findmydoc',
      description: 'Meet the team behind findmydoc.',
    },
    hero: {
      title: 'About hero',
      description: 'About hero description',
      image: {
        src: '/platform-media/about-hero.webp',
        alt: 'About hero',
      },
    },
    why: {
      title: 'Why we exist',
      items: [{ text: 'We make clinic information clearer.' }],
    },
    team: [
      {
        name: 'Volkan Kablan',
        role: 'CEO',
        whatWeDo: 'Shape finance and partner operations.',
        image: {
          src: '/platform-media/volkan.webp',
          alt: 'Volkan Kablan portrait',
        },
      },
    ],
    transparency: {
      title: 'What stays transparent',
      items: [{ text: 'Clinics own their profile information.' }],
    },
  }

  return {
    aboutContent,
    aboutPageComponent: vi.fn(() => null),
    createSiteMetadataMock: vi.fn((args: unknown) => args),
    getAboutLandingContentMock: vi.fn(async () => aboutContent),
  }
})

vi.mock('@/components/templates/AboutPage/Component', () => ({
  AboutPage: mocks.aboutPageComponent,
}))

vi.mock('@/utilities/generateMeta', () => ({
  createSiteMetadata: mocks.createSiteMetadataMock,
}))

vi.mock('@/utilities/landing/landingPageContent', () => ({
  getAboutLandingContent: mocks.getAboutLandingContentMock,
}))

describe('frontend about page route', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mocks.getAboutLandingContentMock.mockResolvedValue(mocks.aboutContent)
  })

  it('sets metadata for the canonical about route', async () => {
    const pageModule = await import('@/app/(frontend)/about/page')

    const metadata = await pageModule.generateMetadata()

    expect(metadata).toEqual({
      title: 'About findmydoc',
      description: 'Meet the team behind findmydoc.',
      path: '/about',
      alternates: {
        canonical: '/about',
      },
    })
    expect(mocks.createSiteMetadataMock).toHaveBeenCalledWith({
      title: 'About findmydoc',
      description: 'Meet the team behind findmydoc.',
      path: '/about',
    })
  })

  it('renders the about template with normalized landing content', async () => {
    const pageModule = await import('@/app/(frontend)/about/page')

    const result = await pageModule.default()

    expect(result.type).toBe(mocks.aboutPageComponent)
    expect(result.props).toEqual({
      hero: mocks.aboutContent.hero,
      why: mocks.aboutContent.why,
      team: mocks.aboutContent.team,
      transparency: mocks.aboutContent.transparency,
    })
  })
})
