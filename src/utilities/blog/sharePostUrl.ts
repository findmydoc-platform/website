type ShareApi = (data: { url: string }) => Promise<void>
type ClipboardApi = { writeText: (text: string) => Promise<void> }
type LoggerApi = { error: (...args: unknown[]) => void }

export type SharePostUrlEnvironment = {
  location: {
    origin: string
    href: string
  }
  share?: ShareApi
  clipboard?: ClipboardApi
  logger?: LoggerApi
}

const getBrowserEnvironment = (): SharePostUrlEnvironment | null => {
  if (typeof window === 'undefined') return null

  const navigatorLike = window.navigator as Navigator & {
    share?: ShareApi
    clipboard?: ClipboardApi
  }

  return {
    location: {
      origin: window.location.origin,
      href: window.location.href,
    },
    share: navigatorLike.share,
    clipboard: navigatorLike.clipboard,
    logger: console,
  }
}

const resolveShareUrl = (rawUrl: string | undefined, environment: SharePostUrlEnvironment): string => {
  const trimmedUrl = rawUrl?.trim()
  if (!trimmedUrl) return environment.location.href

  return new URL(trimmedUrl, environment.location.origin).toString()
}

export const sharePostUrl = async (
  rawUrl?: string,
  environment: SharePostUrlEnvironment | null = getBrowserEnvironment(),
): Promise<'shared' | 'copied' | 'unavailable' | 'failed'> => {
  if (!environment) return 'unavailable'

  const url = resolveShareUrl(rawUrl, environment)

  if (environment.share) {
    try {
      await environment.share({ url })
      return 'shared'
    } catch (error) {
      environment.logger?.error('Share failed:', error)
      return 'failed'
    }
  }

  if (environment.clipboard) {
    try {
      await environment.clipboard.writeText(url)
      return 'copied'
    } catch (error) {
      environment.logger?.error('Copy failed:', error)
      return 'failed'
    }
  }

  return 'unavailable'
}
