import { describe, expect, it, vi } from 'vitest'

import { sharePostUrl, type SharePostUrlEnvironment } from '@/utilities/blog/sharePostUrl'

const createEnvironment = (
  overrides: Partial<SharePostUrlEnvironment> = {},
): SharePostUrlEnvironment => {
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

  it('falls back to clipboard when share API is unavailable', async () => {
    const writeText = vi.fn(async () => {})
    const environment = createEnvironment({
      share: undefined,
      clipboard: { writeText },
    })

    await expect(sharePostUrl('/posts/example', environment)).resolves.toBe('copied')
    expect(writeText).toHaveBeenCalledWith('https://findmydoc.com/posts/example')
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
})
