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
    createSiteMetadataMock: vi.fn((args: unknown) => args),
    getAboutLandingContentMock: vi.fn(async () => aboutContent),
    getLandingLanguages: vi.fn(async () => ({ de: true, en: true })),
  }
})

vi.mock('@/utilities/generateMeta', () => ({
  createSiteMetadata: mocks.createSiteMetadataMock,
}))

vi.mock('@/utilities/landing/editorialLandingAvailability', () => ({
  getEditorialLandingLanguages: mocks.getLandingLanguages,
}))

vi.mock('@/utilities/landing/landingPageContent', () => ({
  getAboutLandingContent: mocks.getAboutLandingContentMock,
}))

describe('frontend about page route', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mocks.getAboutLandingContentMock.mockResolvedValue(mocks.aboutContent)
    mocks.getLandingLanguages.mockResolvedValue({ de: true, en: true })
  })

  it.each([
    ['de', '/about'],
    ['en', '/en/about'],
  ] as const)('uses the %s route canonical and links both renditions', async (locale, path) => {
    const pageModule =
      locale === 'de' ? await import('@/app/(frontend)/about/page') : await import('@/app/(frontend)/en/about/page')

    const metadata = await pageModule.generateMetadata()

    expect(metadata).toEqual({
      title: 'About findmydoc',
      description: 'Meet the team behind findmydoc.',
      path,
      alternates: {
        canonical: path,
        languages: { de: '/about', en: '/en/about', 'x-default': '/about' },
      },
    })
    expect(mocks.getAboutLandingContentMock).toHaveBeenCalledWith(locale)
    expect(mocks.createSiteMetadataMock).toHaveBeenCalledWith({
      title: 'About findmydoc',
      description: 'Meet the team behind findmydoc.',
      path,
    })
  })

  it('leaves an unavailable English rendition out of German alternates and search', async () => {
    mocks.getLandingLanguages.mockResolvedValue({ de: true, en: false })
    const german = await import('@/app/(frontend)/about/page')
    const english = await import('@/app/(frontend)/en/about/page')

    expect(await german.generateMetadata()).toMatchObject({ alternates: { canonical: '/about' } })
    expect((await german.generateMetadata()).alternates?.languages).toBeUndefined()
    expect(await english.generateMetadata()).toMatchObject({ robots: { index: false, follow: false } })
  })
})
