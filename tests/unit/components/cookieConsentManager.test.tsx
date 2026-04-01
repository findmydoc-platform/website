// @vitest-environment jsdom

import '@testing-library/jest-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import {
  COOKIE_CONSENT_COOKIE_NAME,
  DEFAULT_COOKIE_CONSENT_CONFIG,
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

    expect(parseCookieConsentState(cookieValue ?? null, 2)).toMatchObject({
      choice: 'accepted',
      categories: {
        analytics: true,
        functional: true,
      },
      version: 2,
    })
    expect(screen.queryByText('Cookies on findmydoc')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cookie settings' })).toBeInTheDocument()
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

    expect(parseCookieConsentState(cookieValue ?? null, 2)).toMatchObject({
      choice: 'rejected',
      categories: {
        analytics: false,
        functional: false,
      },
      version: 2,
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

    expect(parseCookieConsentState(cookieValue ?? null, 2)).toMatchObject({
      choice: 'customized',
      categories: {
        analytics: false,
        functional: true,
      },
      version: 2,
    })
    expect(screen.queryByRole('dialog', { name: 'Cookie settings' })).not.toBeInTheDocument()
  })
})
