// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'
import {
  COOKIE_CONSENT_COOKIE_NAME,
  clearCookieConsentFromDocument,
  createCookieConsentState,
  DEFAULT_COOKIE_CONSENT_CONFIG,
  normalizeCookieConsentGlobal,
  parseCookieConsentState,
  readCookieConsentFromDocument,
  resolveCookieConsentContext,
  serializeCookieConsentState,
  writeCookieConsentToDocument,
} from '@/features/cookieConsent'

function clearConsentCookie() {
  document.cookie = `${COOKIE_CONSENT_COOKIE_NAME}=; Max-Age=0; Path=/`
}

describe('cookie consent helpers', () => {
  afterEach(() => {
    clearConsentCookie()
  })

  it('round-trips consent state through serialization', () => {
    const state = createCookieConsentState({
      choice: 'customized',
      categories: {
        analytics: false,
        functional: true,
      },
      version: 3,
      decidedAt: '2026-03-31T10:00:00.000Z',
    })

    const serialized = serializeCookieConsentState(state)
    const parsed = parseCookieConsentState(serialized, 3)

    expect(parsed).toEqual(state)
  })

  it('rejects stale consent versions', () => {
    const state = createCookieConsentState({
      choice: 'accepted',
      categories: {
        analytics: true,
        functional: true,
      },
      version: 1,
      decidedAt: '2026-03-31T10:00:00.000Z',
    })

    expect(parseCookieConsentState(serializeCookieConsentState(state), 2)).toBeNull()
  })

  it('writes and reads consent from the browser cookie', () => {
    const state = createCookieConsentState({
      choice: 'rejected',
      categories: {
        analytics: false,
        functional: false,
      },
      version: 2,
      decidedAt: '2026-03-31T10:00:00.000Z',
    })

    writeCookieConsentToDocument(state)

    expect(readCookieConsentFromDocument(2)).toEqual(state)
  })

  it('clears the browser cookie', () => {
    const state = createCookieConsentState({
      choice: 'accepted',
      categories: {
        analytics: true,
        functional: true,
      },
      version: 2,
      decidedAt: '2026-03-31T10:00:00.000Z',
    })

    writeCookieConsentToDocument(state)
    clearCookieConsentFromDocument()

    expect(readCookieConsentFromDocument(2)).toBeNull()
  })

  it('normalizes the optional categories and privacy policy href from the global', () => {
    const config = normalizeCookieConsentGlobal({
      enabled: true,
      consentVersion: 2,
      bannerTitle: 'Cookies on findmydoc',
      bannerDescription: 'We use cookies.',
      acceptLabel: 'Accept all',
      rejectLabel: 'Reject all',
      customizeLabel: 'Customize',
      settingsTitle: 'Cookie settings',
      settingsDescription: 'Choose optional cookies.',
      essentialLabel: 'Essential cookies',
      essentialDescription: 'Required for core functionality.',
      optionalCategories: [
        {
          key: 'analytics',
          label: 'Analytics cookies',
          description: 'Help us improve the site.',
        },
      ],
      cancelLabel: 'Cancel',
      saveLabel: 'Save preferences',
      reopenLabel: 'Cookie settings',
      privacyPolicyLabel: 'Privacy Policy',
      privacyPolicyUrl: '/privacy-policy',
      privacyPolicyPage: { slug: 'privacy-policy' },
    } as never)

    expect(config?.privacyPolicyHref).toBe('/privacy-policy')
    expect(config?.categories).toEqual([
      {
        key: 'analytics',
        label: 'Analytics cookies',
        description: 'Help us improve the site.',
      },
    ])
    expect(DEFAULT_COOKIE_CONSENT_CONFIG.categories).toHaveLength(2)
  })

  it('allows an explicitly empty optional category list', () => {
    const config = normalizeCookieConsentGlobal({
      enabled: true,
      consentVersion: 2,
      bannerTitle: 'Cookies on findmydoc',
      bannerDescription: 'We use cookies.',
      acceptLabel: 'Accept all',
      rejectLabel: 'Reject all',
      customizeLabel: 'Customize',
      settingsTitle: 'Cookie settings',
      settingsDescription: 'Choose optional cookies.',
      essentialLabel: 'Essential cookies',
      essentialDescription: 'Required for core functionality.',
      optionalCategories: [],
      cancelLabel: 'Cancel',
      saveLabel: 'Save preferences',
      reopenLabel: 'Cookie settings',
      privacyPolicyLabel: 'Privacy Policy',
      privacyPolicyUrl: '/privacy-policy',
    } as never)

    expect(config?.categories).toEqual([])
  })

  it('resolves the initial consent context from the cookie and global', () => {
    const state = createCookieConsentState({
      choice: 'accepted',
      categories: {
        analytics: true,
        functional: false,
      },
      version: 2,
      decidedAt: '2026-03-31T10:00:00.000Z',
    })

    const context = resolveCookieConsentContext(
      {
        enabled: true,
        consentVersion: 2,
        bannerTitle: 'Cookies on findmydoc',
        bannerDescription: 'We use cookies.',
        acceptLabel: 'Accept all',
        rejectLabel: 'Reject all',
        customizeLabel: 'Customize',
        settingsTitle: 'Cookie settings',
        settingsDescription: 'Choose optional cookies.',
        essentialLabel: 'Essential cookies',
        essentialDescription: 'Required for core functionality.',
        optionalCategories: [
          {
            key: 'analytics',
            label: 'Analytics cookies',
            description: 'Help us improve the site.',
          },
        ],
        cancelLabel: 'Cancel',
        saveLabel: 'Save preferences',
        reopenLabel: 'Cookie settings',
        privacyPolicyLabel: 'Privacy Policy',
        privacyPolicyUrl: '/privacy-policy',
      } as never,
      serializeCookieConsentState(state),
    )

    expect(context.config?.consentVersion).toBe(2)
    expect(context.initialConsent).toEqual(state)
  })
})
