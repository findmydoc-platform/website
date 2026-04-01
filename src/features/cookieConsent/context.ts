import type { CookieConsent as CookieConsentGlobal } from '@/payload-types'

import { parseCookieConsentState } from './cookie'
import { normalizeCookieConsentGlobal } from './normalizeGlobal'
import type { CookieConsentConfig, CookieConsentState } from './types'

export type CookieConsentContext = {
  config: CookieConsentConfig | null
  initialConsent: CookieConsentState | null
}

type CookieConsentGlobalInput = CookieConsentGlobal & {
  privacyPolicyPage?: unknown
  optionalCategories?: unknown
}

export function resolveCookieConsentContext(
  global: CookieConsentGlobalInput | null | undefined,
  cookieValue: string | null | undefined,
): CookieConsentContext {
  const config = normalizeCookieConsentGlobal(global)

  if (!config) {
    return {
      config: null,
      initialConsent: null,
    }
  }

  return {
    config,
    initialConsent: parseCookieConsentState(cookieValue ?? null, config.consentVersion),
  }
}
