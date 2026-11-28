// @vitest-environment jsdom

import '@testing-library/jest-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import {
  clearCookieConsentFromDocument,
  DEFAULT_COOKIE_CONSENT_CONFIG,
  isCookieConsentToolAllowed,
  normalizeCookieConsentGlobal,
  readCookieConsentFromDocument,
} from '@/features/cookieConsent'
import { CookieConsentClientAdapter } from '@/features/cookieConsent/CookieConsentClientAdapter.client'

vi.mock('@/posthog/client-api', () => ({
  setPostHogAnalyticsConsent: vi.fn(),
  usePostHogAnalyticsReady: () => false,
  getPostHogBrowserDiagnostics: () => ({
    analyticsAllowed: false,
    sdkReady: false,
    sessionAvailable: false,
    reason: 'consent_required',
  }),
}))
const router = vi.hoisted(() => ({ pathname: '/' }))
vi.mock('next/navigation', () => ({ usePathname: () => router.pathname }))

describe('cookie consent content through the shared adapter', () => {
  afterEach(() => {
    cleanup()
    clearCookieConsentFromDocument()
    router.pathname = '/'
  })

  it('lists assigned services and privacy links before consent', () => {
    const config = normalizeCookieConsentGlobal({} as never)
    expect(
      isCookieConsentToolAllowed('posthog', config, { functional: false, analytics: true, marketing: false }),
    ).toBe(true)
    expect(isCookieConsentToolAllowed('posthog', config, { functional: true, analytics: false, marketing: true })).toBe(
      false,
    )
    render(<CookieConsentClientAdapter config={config} initialConsent={null} />)
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(screen.getByText('PostHog')).toBeInTheDocument()
    expect(screen.getByText('OpenStreetMap')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'PostHog privacy notice' })).toHaveAttribute(
      'href',
      'https://posthog.com/privacy',
    )
    expect(screen.getByRole('link', { name: 'OpenStreetMap privacy notice' })).toHaveAttribute(
      'href',
      'https://osmfoundation.org/wiki/Privacy_Policy',
    )
  })

  it.each([
    ['en', 'Our own title', 'Our own explanation', 'Review options'],
    ['de', 'Eigener Titel', 'Eigene Erklärung', 'Auswahl bearbeiten'],
  ] as const)('uses the CMS prompt in %s before a visitor makes a choice', (locale, title, description, options) => {
    const config = normalizeCookieConsentGlobal(
      {
        bannerTitle: 'Our own title',
        bannerDescription: 'Our own explanation',
        customizeLabel: 'Review options',
        germanPrompt: {
          bannerTitle: 'Eigener Titel',
          bannerDescription: 'Eigene Erklärung',
          customizeLabel: 'Auswahl bearbeiten',
        },
        privacyPolicyPage: { slug: 'privacy-policy' },
      } as never,
      locale,
    )
    render(<CookieConsentClientAdapter config={config} initialConsent={null} />)
    const prompt = screen.getByRole('dialog', { name: title })
    expect(prompt).toHaveAttribute('lang', locale)
    expect(screen.getByText(description)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: options }))
    expect(screen.getByRole('dialog')).toHaveAttribute('lang', locale)
    expect(document.cookie).not.toContain('findmydoc_cookie_consent=')
  })

  it('relabels the launcher after navigation and preserves the visitor’s saved decision', () => {
    const config = {
      de: {
        ...DEFAULT_COOKIE_CONSENT_CONFIG,
        locale: 'de',
        banner: { ...DEFAULT_COOKIE_CONSENT_CONFIG.banner, acceptLabel: 'Test-Auswahl bestätigen' },
        reopenLabel: 'Test-Auswahl öffnen',
      },
      en: { ...DEFAULT_COOKIE_CONSENT_CONFIG, reopenLabel: 'Reopen test choice' },
    } as const
    const rendered = render(<CookieConsentClientAdapter config={config} initialConsent={null} />)
    fireEvent.click(screen.getByRole('button', { name: 'Test-Auswahl bestätigen' }))
    expect(screen.getByRole('button', { name: 'Test-Auswahl öffnen' })).toHaveAttribute('lang', 'de')
    const saved = readCookieConsentFromDocument(DEFAULT_COOKIE_CONSENT_CONFIG.consentVersion)
    expect(saved).toMatchObject({ choice: 'accepted', categories: { functional: true, analytics: true } })

    router.pathname = '/en'
    rendered.rerender(<CookieConsentClientAdapter config={config} initialConsent={null} />)
    expect(screen.queryByRole('button', { name: 'Test-Auswahl öffnen' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reopen test choice' }))
    expect(screen.getByRole('dialog')).toHaveAttribute('lang', 'en')
    expect(screen.getByRole('checkbox', { name: 'Functional cookies' })).toBeChecked()
    expect(readCookieConsentFromDocument(DEFAULT_COOKIE_CONSENT_CONFIG.consentVersion)).toEqual(saved)
  })

  it.each([
    [
      'unassigned',
      {
        functional: { enabled: true, tools: [] },
        analytics: { enabled: true, tools: [] },
        marketing: { enabled: true, tools: [] },
      },
    ],
    [
      'disabled',
      {
        functional: { enabled: false, tools: ['openstreetmap'] },
        analytics: { enabled: false, tools: ['posthog'] },
        marketing: { enabled: true, tools: [] },
      },
    ],
    [
      'ambiguous',
      {
        functional: { enabled: true, tools: ['openstreetmap', 'posthog'] },
        analytics: { enabled: true, tools: ['openstreetmap', 'posthog'] },
        marketing: { enabled: true, tools: [] },
      },
    ],
  ])('does not describe inactive services as available for %s assignments', (_name, optionalCategorySettings) => {
    const config = normalizeCookieConsentGlobal({ optionalCategorySettings } as never)
    const allAllowed = { functional: true, analytics: true, marketing: true }
    expect(isCookieConsentToolAllowed('posthog', config, allAllowed)).toBe(false)
    expect(isCookieConsentToolAllowed('openstreetmap', config, allAllowed)).toBe(false)
    render(<CookieConsentClientAdapter config={config} initialConsent={null} />)
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(screen.queryByText('PostHog')).not.toBeInTheDocument()
    expect(screen.queryByText('OpenStreetMap')).not.toBeInTheDocument()
    expect(document.cookie).not.toContain('findmydoc_cookie_consent=')
  })
})
