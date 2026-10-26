// @vitest-environment jsdom

import '@testing-library/jest-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

import {
  COOKIE_CONSENT_COOKIE_NAME,
  DEFAULT_COOKIE_CONSENT_CONFIG,
  createCookieConsentState,
  normalizeCookieConsentGlobal,
  parseCookieConsentState,
  serializeCookieConsentState,
  type CookieConsentConfig,
} from '@/features/cookieConsent'
import { renderToString } from 'react-dom/server'
import { hydrateRoot } from 'react-dom/client'

import { CookieConsentClientAdapter } from '@/features/cookieConsent/CookieConsentClientAdapter.client'

const posthogClientMocks = vi.hoisted(() => ({
  setPostHogAnalyticsConsent: vi.fn(),
}))

vi.mock('@/posthog/client-api', () => ({
  setPostHogAnalyticsConsent: posthogClientMocks.setPostHogAnalyticsConsent,
  usePostHogAnalyticsReady: () => false,
  getPostHogBrowserDiagnostics: () => ({
    analyticsAllowed: false,
    sdkReady: false,
    sessionAvailable: false,
    reason: 'consent_required',
  }),
}))

const navigation = vi.hoisted(() => ({ pathname: '/' }))

vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
}))

const config: CookieConsentConfig = DEFAULT_COOKIE_CONSENT_CONFIG

function clearConsentCookie() {
  document.cookie = `${COOKIE_CONSENT_COOKIE_NAME}=; Max-Age=0; Path=/`
}

describe('CookieConsentManager', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    Reflect.deleteProperty(document, 'cookie')
    clearConsentCookie()
    navigation.pathname = '/'
    vi.clearAllMocks()
  })

  it('stores acceptance and enables analytics', async () => {
    render(<CookieConsentClientAdapter config={config} initialConsent={null} />)

    expect(screen.queryByRole('link', { name: 'Privacy Policy' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Accept all' }))

    await waitFor(() => {
      expect(posthogClientMocks.setPostHogAnalyticsConsent).toHaveBeenLastCalledWith(true)
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

  it('keeps the current cookie authoritative when server props are refreshed after acceptance', async () => {
    const view = render(<CookieConsentClientAdapter config={config} initialConsent={null} />)
    fireEvent.click(screen.getByRole('button', { name: 'Accept all' }))
    expect(posthogClientMocks.setPostHogAnalyticsConsent).toHaveBeenLastCalledWith(true)

    view.rerender(
      <CookieConsentClientAdapter
        config={{ ...config, categories: config.categories.map((category) => ({ ...category })) }}
        initialConsent={null}
      />,
    )

    expect(posthogClientMocks.setPostHogAnalyticsConsent).toHaveBeenLastCalledWith(true)
    expect(screen.getByRole('button', { name: 'Cookie settings' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Accept all' })).not.toBeInTheDocument()
  })

  it('requires a new choice when the configured consent version changes', () => {
    const view = render(<CookieConsentClientAdapter config={config} initialConsent={null} />)
    fireEvent.click(screen.getByRole('button', { name: 'Accept all' }))
    view.rerender(<CookieConsentClientAdapter config={{ ...config, consentVersion: 4 }} initialConsent={null} />)
    expect(posthogClientMocks.setPostHogAnalyticsConsent).toHaveBeenLastCalledWith(false)
    expect(screen.getByRole('button', { name: 'Accept all' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Accept all' }))
    expect(posthogClientMocks.setPostHogAnalyticsConsent).toHaveBeenLastCalledWith(true)
    expect(screen.getByRole('button', { name: 'Cookie settings' })).toBeEnabled()
  })

  it.each(['ignored', 'throws'] as const)('keeps analytics closed when cookie persistence %s', (failure) => {
    render(<CookieConsentClientAdapter config={config} initialConsent={null} />)
    vi.spyOn(document, 'cookie', 'set').mockImplementation(() => {
      if (failure === 'throws') throw new Error('synthetic cookie write failure')
    })
    fireEvent.click(screen.getByRole('button', { name: 'Accept all' }))
    expect(posthogClientMocks.setPostHogAnalyticsConsent).toHaveBeenLastCalledWith(false)
    expect(screen.getByRole('button', { name: 'Accept all' })).toBeInTheDocument()
  })

  it('keeps analytics closed after a failed withdrawal even when server props refresh', () => {
    const view = render(<CookieConsentClientAdapter config={config} initialConsent={null} />)
    fireEvent.click(screen.getByRole('button', { name: 'Accept all' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cookie settings' }))
    const failedWrite = vi.spyOn(document, 'cookie', 'set').mockImplementation(() => {})
    fireEvent.click(screen.getByRole('button', { name: 'Reject all' }))
    expect(posthogClientMocks.setPostHogAnalyticsConsent).toHaveBeenLastCalledWith(false)
    view.rerender(
      <CookieConsentClientAdapter config={{ ...config, categories: [...config.categories] }} initialConsent={null} />,
    )
    expect(posthogClientMocks.setPostHogAnalyticsConsent).toHaveBeenLastCalledWith(false)
    failedWrite.mockRestore()
    fireEvent.click(screen.getByRole('button', { name: 'Accept all' }))
    expect(posthogClientMocks.setPostHogAnalyticsConsent).toHaveBeenLastCalledWith(true)
  })

  it('discards an accepted HTML snapshot when the current cookie is absent', () => {
    render(
      <CookieConsentClientAdapter
        config={config}
        initialConsent={createCookieConsentState({ choice: 'accepted', categories: { analytics: true }, version: 3 })}
      />,
    )
    expect(posthogClientMocks.setPostHogAnalyticsConsent).not.toHaveBeenCalledWith(true)
    expect(screen.getByRole('button', { name: 'Accept all' })).toBeEnabled()
  })

  it.each([
    ['/', null],
    ['/login/patient', null],
    ['/', createCookieConsentState({ choice: 'accepted', categories: { analytics: true }, version: 3 })],
    ['/login/patient', createCookieConsentState({ choice: 'accepted', categories: { analytics: true }, version: 3 })],
  ] as const)(
    'disables server-rendered consent actions until hydration reconciles the cookie on %s, snapshot=%s',
    async (pathname, initialConsent) => {
      navigation.pathname = pathname
      if (initialConsent) {
        document.cookie = `${COOKIE_CONSENT_COOKIE_NAME}=${serializeCookieConsentState(initialConsent)}; Path=/`
      }
      const element = <CookieConsentClientAdapter config={config} initialConsent={initialConsent} />
      const host = document.createElement('div')
      host.innerHTML = renderToString(element)
      document.body.append(host)
      const buttons = host.querySelectorAll('button')
      expect(buttons.length).toBe(initialConsent ? 1 : 3)
      for (const button of buttons) expect(button).toBeDisabled()
      buttons[0]!.click()
      expect(posthogClientMocks.setPostHogAnalyticsConsent).not.toHaveBeenCalled()

      let root: ReturnType<typeof hydrateRoot> | undefined
      await act(async () => {
        root = hydrateRoot(host, element)
      })
      for (const button of host.querySelectorAll('button')) expect(button).toBeEnabled()
      await act(async () => root?.unmount())
      host.remove()
    },
  )

  it('shows the privacy policy link in the settings dialog', async () => {
    render(<CookieConsentClientAdapter config={config} initialConsent={null} />)

    fireEvent.click(screen.getByRole('button', { name: 'Customize' }))

    expect(screen.getByRole('dialog', { name: 'Cookie settings' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy-policy')
  })

  it('can switch from accepted to rejected and disables analytics again', async () => {
    render(<CookieConsentClientAdapter config={config} initialConsent={null} />)

    fireEvent.click(screen.getByRole('button', { name: 'Accept all' }))

    await waitFor(() => {
      expect(posthogClientMocks.setPostHogAnalyticsConsent).toHaveBeenLastCalledWith(true)
    })

    fireEvent.click(screen.getByRole('button', { name: 'Cookie settings' }))
    expect(screen.getByRole('dialog', { name: 'Cookie settings' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Reject all' }))

    await waitFor(() => {
      expect(posthogClientMocks.setPostHogAnalyticsConsent).toHaveBeenLastCalledWith(false)
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
    render(<CookieConsentClientAdapter config={config} initialConsent={null} />)

    fireEvent.click(screen.getByRole('button', { name: 'Customize' }))

    expect(screen.getByRole('dialog', { name: 'Cookie settings' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('checkbox', { name: 'Functional cookies' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save preferences' }))

    await waitFor(() => {
      expect(posthogClientMocks.setPostHogAnalyticsConsent).toHaveBeenLastCalledWith(false)
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

    document.cookie = `${COOKIE_CONSENT_COOKIE_NAME}=${serializeCookieConsentState(initialConsent)}; Path=/`
    render(<CookieConsentClientAdapter config={disabledAnalyticsConfig} initialConsent={initialConsent} />)

    await waitFor(() => {
      expect(posthogClientMocks.setPostHogAnalyticsConsent).toHaveBeenLastCalledWith(false)
    })

    fireEvent.click(screen.getByRole('button', { name: 'Cookie settings' }))

    expect(screen.getByRole('dialog', { name: 'Cookie settings' })).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: 'Analytics cookies' })).not.toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Functional cookies' })).toBeInTheDocument()
  })
})
