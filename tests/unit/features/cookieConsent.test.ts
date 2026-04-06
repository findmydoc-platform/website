// @vitest-environment jsdom

import '@testing-library/jest-dom'

import * as React from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { APIError } from 'payload'
import {
  COOKIE_CONSENT_CHANGE_EVENT,
  COOKIE_CONSENT_COOKIE_NAME,
  clearCookieConsentFromDocument,
  createCookieConsentState,
  DEFAULT_COOKIE_CONSENT_CONFIG,
  isCookieConsentToolAllowed,
  normalizeCookieConsentGlobal,
  parseCookieConsentState,
  readCookieConsentFromDocument,
  resolveCookieConsentContext,
  serializeCookieConsentState,
  useCookieConsentToolAllowed,
  writeCookieConsentToDocument,
} from '@/features/cookieConsent'
import { validateCookieConsentToolAssignments } from '@/globals/CookieConsent/validateCookieConsent'

function clearConsentCookie() {
  document.cookie = `${COOKIE_CONSENT_COOKIE_NAME}=; Max-Age=0; Path=/`
}

function CookieConsentToolProbe() {
  const isAllowed = useCookieConsentToolAllowed('openstreetmap', DEFAULT_COOKIE_CONSENT_CONFIG, null)

  return isAllowed ? 'allowed' : 'blocked'
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
        marketing: false,
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
        marketing: true,
      },
      version: 2,
      decidedAt: '2026-03-31T10:00:00.000Z',
    })

    expect(parseCookieConsentState(serializeCookieConsentState(state), 3)).toBeNull()
  })

  it('writes and reads consent from the browser cookie', () => {
    const state = createCookieConsentState({
      choice: 'rejected',
      categories: {
        analytics: false,
        functional: false,
        marketing: false,
      },
      version: 3,
      decidedAt: '2026-03-31T10:00:00.000Z',
    })

    writeCookieConsentToDocument(state)

    expect(readCookieConsentFromDocument(3)).toEqual(state)
  })

  it('clears the browser cookie', () => {
    const state = createCookieConsentState({
      choice: 'accepted',
      categories: {
        analytics: true,
        functional: true,
        marketing: true,
      },
      version: 3,
      decidedAt: '2026-03-31T10:00:00.000Z',
    })

    writeCookieConsentToDocument(state)
    clearCookieConsentFromDocument()

    expect(readCookieConsentFromDocument(3)).toBeNull()
  })

  it('emits a consent change event when the cookie is updated', () => {
    const listener = vi.fn()
    window.addEventListener(COOKIE_CONSENT_CHANGE_EVENT, listener)

    const state = createCookieConsentState({
      choice: 'accepted',
      categories: {
        analytics: true,
        functional: true,
        marketing: true,
      },
      version: 3,
      decidedAt: '2026-03-31T10:00:00.000Z',
    })

    writeCookieConsentToDocument(state)
    clearCookieConsentFromDocument()

    expect(listener).toHaveBeenCalledTimes(2)

    window.removeEventListener(COOKIE_CONSENT_CHANGE_EVENT, listener)
  })

  it('tracks tool consent updates without triggering unstable snapshot warnings', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    writeCookieConsentToDocument(
      createCookieConsentState({
        choice: 'accepted',
        categories: {
          analytics: true,
          functional: true,
          marketing: false,
        },
        version: 3,
        decidedAt: '2026-03-31T10:00:00.000Z',
      }),
    )

    render(React.createElement(CookieConsentToolProbe))

    expect(screen.getByText('allowed')).toBeInTheDocument()

    act(() => {
      writeCookieConsentToDocument(
        createCookieConsentState({
          choice: 'rejected',
          categories: {
            analytics: false,
            functional: false,
            marketing: false,
          },
          version: 3,
          decidedAt: '2026-03-31T10:05:00.000Z',
        }),
      )
    })

    await waitFor(() => {
      expect(screen.getByText('blocked')).toBeInTheDocument()
    })

    expect(consoleErrorSpy.mock.calls.map((call) => call.join(' '))).not.toContain(
      expect.stringContaining('The result of getSnapshot should be cached'),
    )
    consoleErrorSpy.mockRestore()
  })

  it('normalizes fixed optional categories from optionalCategorySettings and the privacy policy href', () => {
    const config = normalizeCookieConsentGlobal({
      enabled: true,
      consentVersion: 3,
      bannerTitle: 'Cookies on findmydoc',
      bannerDescription: 'We use cookies.',
      acceptLabel: 'Accept all',
      rejectLabel: 'Reject all',
      customizeLabel: 'Customize',
      settingsTitle: 'Cookie settings',
      settingsDescription: 'Choose optional cookies.',
      essentialLabel: 'Essential cookies',
      essentialDescription: 'Required for core functionality.',
      optionalCategorySettings: {
        functional: {
          enabled: true,
          label: 'Functional cookies',
          tools: ['openstreetmap'],
        },
        analytics: {
          enabled: true,
          label: 'Statistics cookies',
          tools: ['posthog'],
        },
        marketing: {
          enabled: true,
          label: 'Marketing cookies',
          tools: [],
        },
      },
      cancelLabel: 'Cancel',
      saveLabel: 'Save preferences',
      reopenLabel: 'Cookie settings',
      privacyPolicyLabel: 'Privacy Policy',
      privacyPolicyPage: { slug: 'privacy-policy' },
    } as never)

    expect(config?.privacyPolicyHref).toBe('/privacy-policy')
    expect(config?.categories).toEqual([
      {
        key: 'functional',
        label: 'Functional cookies',
        description: 'Remember helpful preferences and support a smoother experience.',
        tools: ['openstreetmap'],
      },
      {
        key: 'analytics',
        label: 'Statistics cookies',
        description: 'Help us understand how the site is used so we can improve it.',
        tools: ['posthog'],
      },
      {
        key: 'marketing',
        label: 'Marketing cookies',
        description: 'Support campaign measurement and more relevant marketing communication.',
        tools: [],
      },
    ])
    expect(DEFAULT_COOKIE_CONSENT_CONFIG.categories).toHaveLength(3)
  })

  it('hides the privacy policy link when no page is selected', () => {
    const config = normalizeCookieConsentGlobal({
      enabled: true,
      consentVersion: 3,
      bannerTitle: 'Cookies on findmydoc',
      bannerDescription: 'We use cookies.',
      acceptLabel: 'Accept all',
      rejectLabel: 'Reject all',
      customizeLabel: 'Customize',
      settingsTitle: 'Cookie settings',
      settingsDescription: 'Choose optional cookies.',
      essentialLabel: 'Essential cookies',
      essentialDescription: 'Required for core functionality.',
      optionalCategorySettings: {},
      cancelLabel: 'Cancel',
      saveLabel: 'Save preferences',
      reopenLabel: 'Cookie settings',
      privacyPolicyLabel: 'Privacy Policy',
    } as never)

    expect(config?.privacyPolicyHref).toBeNull()
  })

  it('filters disabled optional categories from the frontend config', () => {
    const config = normalizeCookieConsentGlobal({
      enabled: true,
      consentVersion: 3,
      bannerTitle: 'Cookies on findmydoc',
      bannerDescription: 'We use cookies.',
      acceptLabel: 'Accept all',
      rejectLabel: 'Reject all',
      customizeLabel: 'Customize',
      settingsTitle: 'Cookie settings',
      settingsDescription: 'Choose optional cookies.',
      essentialLabel: 'Essential cookies',
      essentialDescription: 'Required for core functionality.',
      optionalCategorySettings: {
        functional: {
          enabled: true,
          label: 'Functional cookies',
          tools: ['openstreetmap'],
        },
        analytics: {
          enabled: false,
          label: 'Analytics cookies',
          tools: ['posthog'],
        },
        marketing: {
          enabled: false,
          label: 'Marketing cookies',
          tools: [],
        },
      },
      cancelLabel: 'Cancel',
      saveLabel: 'Save preferences',
      reopenLabel: 'Cookie settings',
      privacyPolicyLabel: 'Privacy Policy',
    } as never)

    expect(config?.categories).toEqual([
      {
        key: 'functional',
        label: 'Functional cookies',
        description: 'Remember helpful preferences and support a smoother experience.',
        tools: ['openstreetmap'],
      },
    ])
  })

  it('maps OpenStreetMap to the functional consent category', () => {
    const config = normalizeCookieConsentGlobal({
      enabled: true,
      consentVersion: 3,
      bannerTitle: 'Cookies on findmydoc',
      bannerDescription: 'We use cookies.',
      acceptLabel: 'Accept all',
      rejectLabel: 'Reject all',
      customizeLabel: 'Customize',
      settingsTitle: 'Cookie settings',
      settingsDescription: 'Choose optional cookies.',
      essentialLabel: 'Essential cookies',
      essentialDescription: 'Required for core functionality.',
      optionalCategorySettings: {
        functional: {
          enabled: true,
          label: 'Functional cookies',
          tools: ['openstreetmap'],
        },
        analytics: {
          enabled: true,
          label: 'Analytics cookies',
          tools: ['posthog'],
        },
        marketing: {
          enabled: true,
          label: 'Marketing cookies',
          tools: [],
        },
      },
      cancelLabel: 'Cancel',
      saveLabel: 'Save preferences',
      reopenLabel: 'Cookie settings',
      privacyPolicyLabel: 'Privacy Policy',
    } as never)

    expect(
      isCookieConsentToolAllowed(
        'openstreetmap',
        config,
        createCookieConsentState({
          choice: 'customized',
          categories: {
            functional: true,
          },
          version: 3,
          decidedAt: '2026-03-31T10:00:00.000Z',
        }).categories,
      ),
    ).toBe(true)

    expect(
      isCookieConsentToolAllowed(
        'openstreetmap',
        config,
        createCookieConsentState({
          choice: 'customized',
          categories: {
            functional: false,
          },
          version: 3,
          decidedAt: '2026-03-31T10:00:00.000Z',
        }).categories,
      ),
    ).toBe(false)
  })

  it('falls back to the fixed official categories when category settings are missing', () => {
    const config = normalizeCookieConsentGlobal({
      enabled: true,
      consentVersion: 3,
      bannerTitle: 'Cookies on findmydoc',
      bannerDescription: 'We use cookies.',
      acceptLabel: 'Accept all',
      rejectLabel: 'Reject all',
      customizeLabel: 'Customize',
      settingsTitle: 'Cookie settings',
      settingsDescription: 'Choose optional cookies.',
      essentialLabel: 'Essential cookies',
      essentialDescription: 'Required for core functionality.',
      cancelLabel: 'Cancel',
      saveLabel: 'Save preferences',
      reopenLabel: 'Cookie settings',
      privacyPolicyLabel: 'Privacy Policy',
    } as never)

    expect(config?.categories).toEqual(DEFAULT_COOKIE_CONSENT_CONFIG.categories)
  })

  it('normalizes legacy optionalCategories into optionalCategorySettings', () => {
    const data = {
      optionalCategories: [
        {
          key: 'analytics',
          enabled: true,
          label: 'Analytics cookies',
          tools: ['posthog'],
        },
        {
          key: 'functional',
          enabled: true,
          label: 'Functional cookies',
          tools: ['openstreetmap'],
        },
      ],
    }

    validateCookieConsentToolAssignments(data as never)

    expect(data).toEqual({
      optionalCategorySettings: {
        functional: {
          enabled: true,
          label: 'Functional cookies',
          tools: ['openstreetmap'],
        },
        analytics: {
          enabled: true,
          label: 'Analytics cookies',
          tools: ['posthog'],
        },
        marketing: {
          enabled: true,
          label: 'Marketing cookies',
          tools: [],
        },
      },
    })
  })

  it('rejects duplicate tool assignments across fixed categories', () => {
    const data = {
      optionalCategorySettings: {
        functional: {
          enabled: true,
          label: 'Functional cookies',
          tools: ['openstreetmap'],
        },
        analytics: {
          enabled: true,
          label: 'Analytics cookies',
          tools: ['posthog'],
        },
        marketing: {
          enabled: true,
          label: 'Marketing cookies',
          tools: ['posthog'],
        },
      },
    }

    const validate = () => validateCookieConsentToolAssignments(data as never)

    expect(validate).toThrow(APIError)
    expect(validate).toThrow('Tool "PostHog" can only be assigned to one consent category.')
  })

  it('resolves the initial consent context from the cookie and global', () => {
    const state = createCookieConsentState({
      choice: 'accepted',
      categories: {
        analytics: true,
        functional: false,
        marketing: true,
      },
      version: 3,
      decidedAt: '2026-03-31T10:00:00.000Z',
    })

    const context = resolveCookieConsentContext(
      {
        enabled: true,
        consentVersion: 3,
        bannerTitle: 'Cookies on findmydoc',
        bannerDescription: 'We use cookies.',
        acceptLabel: 'Accept all',
        rejectLabel: 'Reject all',
        customizeLabel: 'Customize',
        settingsTitle: 'Cookie settings',
        settingsDescription: 'Choose optional cookies.',
        essentialLabel: 'Essential cookies',
        essentialDescription: 'Required for core functionality.',
        optionalCategorySettings: {
          functional: {
            enabled: true,
            label: 'Functional cookies',
            tools: ['openstreetmap'],
          },
          analytics: {
            enabled: true,
            label: 'Analytics cookies',
            tools: ['posthog'],
          },
          marketing: {
            enabled: true,
            label: 'Marketing cookies',
            tools: [],
          },
        },
        cancelLabel: 'Cancel',
        saveLabel: 'Save preferences',
        reopenLabel: 'Cookie settings',
        privacyPolicyLabel: 'Privacy Policy',
        privacyPolicyPage: { slug: 'privacy-policy' },
      } as never,
      serializeCookieConsentState(state),
    )

    expect(context.config?.consentVersion).toBe(3)
    expect(context.initialConsent).toEqual(state)
  })
})
