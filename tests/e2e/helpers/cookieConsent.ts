import type { BrowserContext } from '@playwright/test'

import {
  COOKIE_CONSENT_COOKIE_NAME,
  COOKIE_CONSENT_DEFAULT_VERSION,
  createCookieConsentState,
  serializeCookieConsentState,
} from '../../../src/features/cookieConsent'

const resolveBaseUrl = () => process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3100'

type CookieConsentOptions = {
  functional?: boolean
  analytics?: boolean
  marketing?: boolean
}

export async function setCookieConsent(
  context: BrowserContext,
  { functional = false, analytics = false, marketing = false }: CookieConsentOptions = {},
) {
  const consent = createCookieConsentState({
    choice: functional || analytics || marketing ? 'customized' : 'rejected',
    categories: {
      functional,
      analytics,
      marketing,
    },
    version: COOKIE_CONSENT_DEFAULT_VERSION,
  })

  await context.addCookies([
    {
      name: COOKIE_CONSENT_COOKIE_NAME,
      value: serializeCookieConsentState(consent),
      url: resolveBaseUrl(),
    },
  ])
}
