// @vitest-environment jsdom

import '@testing-library/jest-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import {
  COOKIE_CONSENT_COOKIE_NAME,
  DEFAULT_COOKIE_CONSENT_CONFIG,
  createCookieConsentState,
  normalizeCookieConsentGlobal,
  parseCookieConsentState,
  type CookieConsentConfig,
} from '@/features/cookieConsent'
import { CookieConsentManager } from '@/components/organisms/CookieConsent/CookieConsentManager.client'

const posthogClientMocks = vi.hoisted(() => ({
  setAnalyticsConsent: vi.fn(),
}))

vi.mock('@/posthog/analytics', () => ({
  setAnalyticsConsent: posthogClientMocks.setAnalyticsConsent,
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}))

const config: CookieConsentConfig = DEFAULT_COOKIE_CONSENT_CONFIG

function clearConsentCookie() {
  document.cookie = `${COOKIE_CONSENT_COOKIE_NAME}=; Max-Age=0; Path=/`
}

describe('CookieConsentManager', () => {
  afterEach(() => {
    clearConsentCookie()
    vi.clearAllMocks()
  })

  it('stores acceptance and enables analytics', async () => {
    render(<CookieConsentManager config={config} initialConsent={null} />)

    expect(screen.queryByRole('link', { name: 'Privacy Policy' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Accept all' }))

    await waitFor(() => {
      expect(posthogClientMocks.setAnalyticsConsent).toHaveBeenLastCalledWith(true)
    })

    const cookieValue = document.cookie
      .split('; ')
      .find((entry) => entry.startsWith(`${COOKIE_CONSENT_COOKIE_NAME}=`))
      ?.split('=')
      .slice(1)
      .join('=')

    expect(parseCookieConsentState(cookieValue ?? null, 3)).toMatchObject({
      choice: 'accepted',
      categories: {
        analytics: true,
        functional: true,
      },
      version: 3,
    })
    expect(screen.queryByText('Cookies on findmydoc')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cookie settings' })).toBeInTheDocument()
  })

  it('shows the privacy policy link in the settings dialog', async () => {
    render(<CookieConsentManager config={config} initialConsent={null} />)

    fireEvent.click(screen.getByRole('button', { name: 'Customize' }))

    expect(screen.getByRole('dialog', { name: 'Cookie settings' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy-policy')
  })

  it('can switch from accepted to rejected and disables analytics again', async () => {
    render(<CookieConsentManager config={config} initialConsent={null} />)

    fireEvent.click(screen.getByRole('button', { name: 'Accept all' }))

    await waitFor(() => {
      expect(posthogClientMocks.setAnalyticsConsent).toHaveBeenLastCalledWith(true)
    })

    fireEvent.click(screen.getByRole('button', { name: 'Cookie settings' }))
    expect(screen.getByRole('dialog', { name: 'Cookie settings' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Reject all' }))

    await waitFor(() => {
      expect(posthogClientMocks.setAnalyticsConsent).toHaveBeenLastCalledWith(false)
    })

    const cookieValue = document.cookie
      .split('; ')
      .find((entry) => entry.startsWith(`${COOKIE_CONSENT_COOKIE_NAME}=`))
      ?.split('=')
      .slice(1)
      .join('=')

    expect(parseCookieConsentState(cookieValue ?? null, 3)).toMatchObject({
      choice: 'rejected',
      categories: {
        analytics: false,
        functional: false,
      },
      version: 3,
    })
    expect(screen.queryByRole('dialog', { name: 'Cookie settings' })).not.toBeInTheDocument()
  })

  it('opens settings, stores a customized preference, and disables analytics', async () => {
    render(<CookieConsentManager config={config} initialConsent={null} />)

    fireEvent.click(screen.getByRole('button', { name: 'Customize' }))

    expect(screen.getByRole('dialog', { name: 'Cookie settings' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('checkbox', { name: 'Functional cookies' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save preferences' }))

    await waitFor(() => {
      expect(posthogClientMocks.setAnalyticsConsent).toHaveBeenLastCalledWith(false)
    })

    const cookieValue = document.cookie
      .split('; ')
      .find((entry) => entry.startsWith(`${COOKIE_CONSENT_COOKIE_NAME}=`))
      ?.split('=')
      .slice(1)
      .join('=')

    expect(parseCookieConsentState(cookieValue ?? null, 3)).toMatchObject({
      choice: 'customized',
      categories: {
        analytics: false,
        functional: true,
      },
      version: 3,
    })
    expect(screen.queryByRole('dialog', { name: 'Cookie settings' })).not.toBeInTheDocument()
  })

  it('hides disabled categories and keeps PostHog disabled when analytics is switched off in the CMS', async () => {
    const disabledAnalyticsConfig = normalizeCookieConsentGlobal({
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

    const initialConsent = createCookieConsentState({
      choice: 'accepted',
      categories: {
        analytics: true,
        functional: true,
      },
      version: 3,
      decidedAt: '2026-03-31T10:00:00.000Z',
    })

    render(<CookieConsentManager config={disabledAnalyticsConfig} initialConsent={initialConsent} />)

    await waitFor(() => {
      expect(posthogClientMocks.setAnalyticsConsent).toHaveBeenLastCalledWith(false)
    })

    fireEvent.click(screen.getByRole('button', { name: 'Cookie settings' }))

    expect(screen.getByRole('dialog', { name: 'Cookie settings' })).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: 'Analytics cookies' })).not.toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Functional cookies' })).toBeInTheDocument()
  })
})
