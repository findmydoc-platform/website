// @vitest-environment jsdom

import '@testing-library/jest-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import { isCookieConsentToolAllowed, normalizeCookieConsentGlobal } from '@/features/cookieConsent'
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
vi.mock('next/navigation', () => ({ usePathname: () => '/' }))

describe('cookie consent content through the shared adapter', () => {
  afterEach(cleanup)

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

  it('keeps operator copy and legal links accessible without making a choice', () => {
    const config = normalizeCookieConsentGlobal({
      bannerTitle: 'Our own title',
      bannerDescription: 'Our own explanation',
      germanPrompt: { bannerTitle: 'Ignored alternate title', bannerDescription: 'Ignored alternate explanation' },
      customizeLabel: 'Review options',
      privacyPolicyPage: { slug: 'privacy-policy' },
    } as never)
    render(<CookieConsentClientAdapter config={config} initialConsent={null} />)
    expect(screen.getByText('Our own title')).toBeInTheDocument()
    expect(screen.getByText('Our own explanation')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Review options' }))
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy-policy')
    expect(screen.getByRole('link', { name: 'Imprint' })).toHaveAttribute('href', '/imprint')
    expect(document.cookie).not.toContain('findmydoc_cookie_consent=')
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
