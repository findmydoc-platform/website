import { describe, expect, it, vi } from 'vitest'

import { sharePostUrl, type SharePostUrlEnvironment } from '@/utilities/blog/sharePostUrl'

const createEnvironment = (overrides: Partial<SharePostUrlEnvironment> = {}): SharePostUrlEnvironment => {
  const base: SharePostUrlEnvironment = {
    location: {
      origin: 'https://findmydoc.com',
      href: 'https://findmydoc.com/posts/current-post',
    },
    share: vi.fn(async () => {}),
    clipboard: {
      writeText: vi.fn(async () => {}),
    },
    logger: {
      error: vi.fn(),
    },
  }

  return {
    ...base,
    ...overrides,
    location: {
      ...base.location,
      ...(overrides.location ?? {}),
    },
  }
}

describe('sharePostUrl', () => {
  it('returns unavailable when browser environment is missing', async () => {
    await expect(sharePostUrl('/posts/example', null)).resolves.toBe('unavailable')
  })

  it('shares with a portable absolute URL when share API is available', async () => {
    const share = vi.fn(async () => {})
    const environment = createEnvironment({ share })

    await expect(sharePostUrl('/posts/example', environment)).resolves.toBe('shared')
    expect(share).toHaveBeenCalledWith({ url: 'https://findmydoc.com/posts/example' })
  })

  it('shares with url, title and description when provided', async () => {
    const share = vi.fn(async () => {})
    const environment = createEnvironment({ share })

    await expect(
      sharePostUrl(
        {
          url: '/posts/example',
          title: 'Kosten in der Medizin verstehen',
          description: 'Ein kurzer Überblick über Eigenanteile und wichtige Fragen.',
        },
        environment,
      ),
    ).resolves.toBe('shared')

    expect(share).toHaveBeenCalledWith({
      title: 'Kosten in der Medizin verstehen',
      text: 'Kosten in der Medizin verstehen\n\nEin kurzer Überblick über Eigenanteile und wichtige Fragen.\n\nhttps://findmydoc.com/posts/example',
    })
  })

  it('falls back to clipboard when share API is unavailable', async () => {
    const writeText = vi.fn(async () => {})
    const environment = createEnvironment({
      share: undefined,
      clipboard: { writeText },
    })

    await expect(sharePostUrl('/posts/example', environment)).resolves.toBe('copied')
    expect(writeText).toHaveBeenCalledWith('https://findmydoc.com/posts/example')
  })

  it('copies a richer share text to clipboard when title/description are provided', async () => {
    const writeText = vi.fn(async () => {})
    const environment = createEnvironment({
      share: undefined,
      clipboard: { writeText },
    })

    await expect(
      sharePostUrl(
        {
          url: '/posts/example',
          title: 'Kosten in der Medizin verstehen',
          description: 'Ein kurzer Überblick über Eigenanteile und wichtige Fragen.',
        },
        environment,
      ),
    ).resolves.toBe('copied')

    expect(writeText).toHaveBeenCalledWith(
      'Kosten in der Medizin verstehen\n\nEin kurzer Überblick über Eigenanteile und wichtige Fragen.\n\nhttps://findmydoc.com/posts/example',
    )
  })

  it('uses the current page URL when no share URL is provided', async () => {
    const writeText = vi.fn(async () => {})
    const environment = createEnvironment({
      share: undefined,
      clipboard: { writeText },
    })

    await expect(sharePostUrl(undefined, environment)).resolves.toBe('copied')
    expect(writeText).toHaveBeenCalledWith('https://findmydoc.com/posts/current-post')
  })

  it('returns failed and logs when share API throws', async () => {
    const logger = { error: vi.fn() }
    const environment = createEnvironment({
      share: vi.fn(async () => {
        throw new Error('share failed')
      }),
      logger,
    })

    await expect(sharePostUrl('/posts/example', environment)).resolves.toBe('failed')
    expect(logger.error).toHaveBeenCalled()
  })

  it('returns canceled and does not log when user aborts native share', async () => {
    const logger = { error: vi.fn() }
    const environment = createEnvironment({
      share: vi.fn(async () => {
        const abortError = new Error('Share canceled')
        abortError.name = 'AbortError'
        throw abortError
      }),
      logger,
    })

    await expect(sharePostUrl('/posts/example', environment)).resolves.toBe('canceled')
    expect(logger.error).not.toHaveBeenCalled()
  })
})
