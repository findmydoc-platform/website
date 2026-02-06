type SharePayload = { url: string; title?: string; text?: string }
type ShareApi = (data: SharePayload) => Promise<void>
type ClipboardApi = { writeText: (text: string) => Promise<void> }
type LoggerApi = { error: (...args: unknown[]) => void }
type ErrorLike = { name?: string; message?: string }

export type SharePostUrlEnvironment = {
  location: {
    origin: string
    href: string
  }
  share?: ShareApi
  clipboard?: ClipboardApi
  logger?: LoggerApi
}

export type SharePostInput =
  | string
  | {
      url?: string
      title?: string
      description?: string
    }

const getBrowserEnvironment = (): SharePostUrlEnvironment | null => {
  if (typeof window === 'undefined') return null

  const navigatorLike = window.navigator as Navigator & {
    share?: ShareApi
    clipboard?: ClipboardApi
  }

  const share = navigatorLike.share ? (data: SharePayload) => navigatorLike.share!(data) : undefined
  const clipboard = navigatorLike.clipboard
    ? {
        writeText: (text: string) => navigatorLike.clipboard!.writeText(text),
      }
    : undefined

  return {
    location: {
      origin: window.location.origin,
      href: window.location.href,
    },
    share,
    clipboard,
    logger: console,
  }
}

const resolveShareUrl = (rawUrl: string | undefined, environment: SharePostUrlEnvironment): string => {
  const trimmedUrl = rawUrl?.trim()
  if (!trimmedUrl) return environment.location.href

  return new URL(trimmedUrl, environment.location.origin).toString()
}

const resolveShareInput = (
  input: SharePostInput | undefined,
  environment: SharePostUrlEnvironment,
): { url: string; title?: string; description?: string } => {
  if (typeof input === 'string' || input === undefined) {
    return { url: resolveShareUrl(input, environment) }
  }

  return {
    url: resolveShareUrl(input.url, environment),
    title: input.title?.trim() || undefined,
    description: input.description?.trim() || undefined,
  }
}

const buildShareMessage = (input: { title?: string; description?: string }): string | undefined => {
  const sections: string[] = []
  if (input.title) sections.push(input.title)
  if (input.description) sections.push(input.description)
  return sections.length > 0 ? sections.join('\n\n') : undefined
}

const buildSharePayload = (input: { url: string; title?: string; description?: string }): SharePayload => {
  const message = buildShareMessage(input)
  const textWithLink = message ? `${message}\n\n${input.url}` : undefined
  const payload: SharePayload = textWithLink ? { text: textWithLink } : { url: input.url }

  if (input.title) payload.title = input.title

  return payload
}

const buildClipboardText = (input: { url: string; title?: string; description?: string }): string => {
  const message = buildShareMessage(input)
  if (!message) return input.url

  const sections = [message, input.url]

  return sections.join('\n\n')
}

const isShareCanceledError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false

  const { name, message } = error as ErrorLike
  if (name === 'AbortError') return true
  if (typeof message === 'string' && message.toLowerCase().includes('share canceled')) return true

  return false
}

export const sharePostUrl = async (
  input?: SharePostInput,
  environment: SharePostUrlEnvironment | null = getBrowserEnvironment(),
): Promise<'shared' | 'copied' | 'unavailable' | 'failed' | 'canceled'> => {
  if (!environment) return 'unavailable'

  const resolvedInput = resolveShareInput(input, environment)
  const sharePayload = buildSharePayload(resolvedInput)

  if (environment.share) {
    try {
      await environment.share(sharePayload)
      return 'shared'
    } catch (error) {
      if (isShareCanceledError(error)) return 'canceled'
      environment.logger?.error('Share failed:', error)
      return 'failed'
    }
  }

  if (environment.clipboard) {
    try {
      await environment.clipboard.writeText(buildClipboardText(resolvedInput))
      return 'copied'
    } catch (error) {
      environment.logger?.error('Copy failed:', error)
      return 'failed'
    }
  }

  return 'unavailable'
}
