// @vitest-environment jsdom

import React from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ usePathname: () => '/clinics/synthetic-clinic' }))

const profile = {
  clinic_id: '42',
  clinic_slug: 'synthetic-clinic',
  page_path: '/clinics/synthetic-clinic',
  source_route: 'clinic_detail' as const,
}

beforeEach(() => {
  vi.resetModules()
  vi.useFakeTimers()
  // Keep the installed SDK implementation, with a fresh instance for each browser lifecycle.
  vi.doMock('posthog-js', async (importOriginal) => {
    const actual = await importOriginal<typeof import('posthog-js')>()
    return { ...actual, default: new actual.PostHog() }
  })
  vi.stubGlobal('localStorage', window.localStorage)
  vi.stubGlobal('sessionStorage', window.sessionStorage)
  localStorage.clear()
  sessionStorage.clear()
  for (const cookie of document.cookie.split(';')) {
    document.cookie = `${cookie.split('=')[0]}=; Max-Age=0; Path=/`
  }
  HTMLElement.prototype.scrollIntoView = vi.fn()
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn(() => 0),
  )
  vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', 'phc_synthetic_consent_test')
  vi.stubEnv('NEXT_PUBLIC_POSTHOG_HOST', 'https://analytics.example.test')
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('{}', { status: 200 })),
  )
  vi.spyOn(XMLHttpRequest.prototype, 'send').mockImplementation(() => {})
  Object.defineProperty(navigator, 'sendBeacon', { configurable: true, value: vi.fn(() => true) })
})

afterEach(() => {
  cleanup()
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.restoreAllMocks()
  Reflect.deleteProperty(document, 'cookie')
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.doUnmock('posthog-js')
})

describe('browser consent with the installed PostHog SDK', () => {
  it('captures the current profile once after same-page consent and only later CTA actions', async () => {
    const { CookieConsentClientAdapter } = await import('@/features/cookieConsent/CookieConsentClientAdapter.client')
    const { ClinicDetailClientAdapter } =
      await import('@/app/(frontend)/clinics/[slug]/ClinicDetailClientAdapter.client')
    const { DEFAULT_COOKIE_CONSENT_CONFIG } = await import('@/features/cookieConsent')
    const { clinicDetailFixture } = await import('@/stories/fixtures/clinicDetail')
    const api = await import('@/posthog/client-api')
    const { default: sdk } = await import('posthog-js')
    const events: string[] = []
    sdk.on('eventCaptured', (event) => events.push(event.event))
    const init = vi.spyOn(sdk, 'init')
    const view = render(
      <React.StrictMode>
        <ClinicDetailClientAdapter data={clinicDetailFixture} />
        <CookieConsentClientAdapter config={DEFAULT_COOKIE_CONSENT_CONFIG} initialConsent={null} />
      </React.StrictMode>,
    )
    fireEvent.click(screen.getAllByRole('button', { name: 'Choose Treatment' })[0]!)
    expect(events).toEqual([])
    fireEvent.click(screen.getByRole('button', { name: 'Accept all' }))
    expect(events.filter((name) => name === 'clinic_profile_viewed')).toHaveLength(1)
    fireEvent.click(screen.getAllByRole('button', { name: 'Choose Treatment' })[0]!)
    expect(events.filter((name) => name === 'clinic_cta_clicked')).toHaveLength(1)
    act(() => {
      api.setPostHogAnalyticsConsent(false)
    })
    fireEvent.click(screen.getAllByRole('button', { name: 'Choose Treatment' })[0]!)
    act(() => {
      api.setPostHogAnalyticsConsent(true)
    })
    expect(events.filter((name) => name === 'clinic_profile_viewed')).toHaveLength(1)
    expect(events.filter((name) => name === 'clinic_cta_clicked')).toHaveLength(1)
    expect(init).toHaveBeenCalledTimes(1)
    expect(api.getConsentedPostHogSessionId()).toBeTypeOf('string')
    view.unmount()
  })

  it.each([true, false])('logout preserves consent=%s while clearing identity', async (consent) => {
    const api = await import('@/posthog/client-api')
    const { default: sdk } = await import('posthog-js')
    api.setPostHogAnalyticsConsent(true)
    const oldIdentity = sdk.get_distinct_id()
    api.setPostHogAnalyticsConsent(consent)
    api.resetPostHogBrowserIdentity()
    expect(sdk.get_distinct_id()).not.toBe(oldIdentity)
    expect(sdk.has_opted_in_capturing()).toBe(consent)
    expect(sdk.has_opted_out_capturing()).toBe(!consent)
    expect(api.postHogBrowserEvents.clinicProfileViewed(profile)).toBe(consent)
  })

  it('restores accepted consent through the real consent controller', async () => {
    const { CookieConsentClientAdapter } = await import('@/features/cookieConsent/CookieConsentClientAdapter.client')
    const { DEFAULT_COOKIE_CONSENT_CONFIG, createCookieConsentState } = await import('@/features/cookieConsent')
    const api = await import('@/posthog/client-api')
    render(
      <CookieConsentClientAdapter
        config={DEFAULT_COOKIE_CONSENT_CONFIG}
        initialConsent={createCookieConsentState({
          choice: 'accepted',
          categories: { analytics: true },
          version: DEFAULT_COOKIE_CONSENT_CONFIG.consentVersion,
        })}
      />,
    )
    expect(api.postHogBrowserEvents.clinicProfileViewed(profile)).toBe(true)
  })

  it('keeps capture closed when both SDK consent stores are unavailable', async () => {
    const api = await import('@/posthog/client-api')
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('synthetic storage failure')
    })
    vi.spyOn(document, 'cookie', 'get').mockImplementation(() => {
      throw new Error('synthetic storage failure')
    })
    vi.spyOn(document, 'cookie', 'set').mockImplementation(() => {
      throw new Error('synthetic storage failure')
    })
    expect(api.setPostHogAnalyticsConsent(true)).toBe(false)
    expect(api.postHogBrowserEvents.clinicProfileViewed(profile)).toBe(false)
    expect(api.getConsentedPostHogSessionId()).toBeUndefined()
  })

  it('retains a final token-specific opt-out after withdrawal', async () => {
    const api = await import('@/posthog/client-api')
    const { default: sdk } = await import('posthog-js')
    api.setPostHogAnalyticsConsent(true)
    api.setPostHogAnalyticsConsent(false)
    expect(sdk.has_opted_out_capturing()).toBe(true)
  })

  it('does not persist SDK consent before initialization', async () => {
    const api = await import('@/posthog/client-api')

    api.setPostHogAnalyticsConsent(false)
    api.resetPostHogBrowserIdentity()

    expect(localStorage.getItem('__ph_opt_in_out_')).toBeNull()
    expect(api.postHogBrowserEvents.clinicProfileViewed(profile)).toBe(false)
  })
})
