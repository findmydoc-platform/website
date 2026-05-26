import type { CookieConsent as CookieConsentType } from '@/payload-types'
import {
  COOKIE_CONSENT_COOKIE_NAME,
  isCookieConsentToolAllowed,
  resolveCookieConsentContext,
} from '@/features/cookieConsent'
import { fallbackConsoleLogger } from '@/utilities/logging/consoleLogger'
import { createScopedLogger, toLoggedError } from '@/utilities/logging/shared'

import type { PostHogServerAnalyticsConsent } from './api'

type ResolvePostHogServerAnalyticsConsentInput = {
  headers: Headers
}

const logger = createScopedLogger(fallbackConsoleLogger, {
  component: 'posthog-server-consent',
  scope: 'telemetry.posthog',
})

const readCookieHeaderValue = (cookieHeader: string | null, cookieName: string): string | null => {
  if (!cookieHeader) return null

  const prefix = `${cookieName}=`
  const cookie = cookieHeader.split(';').find((entry) => entry.trim().startsWith(prefix))
  if (!cookie) return null

  const [, ...valueParts] = cookie.trim().split('=')
  const value = valueParts.join('=')
  return value || null
}

export interface PostHogServerConsentInterface {
  resolveAnalyticsConsent(input: ResolvePostHogServerAnalyticsConsentInput): Promise<PostHogServerAnalyticsConsent>
}

export const postHogServerConsent: PostHogServerConsentInterface = {
  async resolveAnalyticsConsent({ headers }) {
    try {
      const { getGlobal } = await import('@/utilities/getGlobals')
      const cookieConsentContext = resolveCookieConsentContext(
        (await getGlobal('cookieConsent', 1)) as CookieConsentType,
        readCookieHeaderValue(headers.get('cookie'), COOKIE_CONSENT_COOKIE_NAME),
      )

      return {
        isAllowed: isCookieConsentToolAllowed(
          'posthog',
          cookieConsentContext.config,
          cookieConsentContext.initialConsent?.categories,
        ),
      }
    } catch (error) {
      logger.warn(
        {
          err: toLoggedError(error),
          event: 'telemetry.posthog.analytics_consent_resolve_failed',
        },
        'PostHog analytics consent could not be resolved; skipping server analytics event',
      )

      return { isAllowed: false }
    }
  },
}
