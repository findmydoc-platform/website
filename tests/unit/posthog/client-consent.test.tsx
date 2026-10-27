// @vitest-environment jsdom

import React from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }))
vi.mock('next/navigation', () => ({ usePathname: () => '/clinics/synthetic-clinic', useRouter: () => router }))
vi.mock('@/auth/utilities/loginHandler', () => ({ handleLogin: vi.fn() }))

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

  it('accepts one profile per SPA mount and keeps the session through rerenders', async () => {
    const { CookieConsentClientAdapter } = await import('@/features/cookieConsent/CookieConsentClientAdapter.client')
    const { ClinicDetailClientAdapter } =
      await import('@/app/(frontend)/clinics/[slug]/ClinicDetailClientAdapter.client')
    const { DEFAULT_COOKIE_CONSENT_CONFIG } = await import('@/features/cookieConsent')
    const { clinicDetailFixture } = await import('@/stories/fixtures/clinicDetail')
    const { default: sdk } = await import('posthog-js')
    const api = await import('@/posthog/client-api')
    const accepted: string[] = []
    sdk.on('eventCaptured', (event) => accepted.push(event.event))
    const composition = (profileVisible: boolean) => (
      <>
        <CookieConsentClientAdapter config={DEFAULT_COOKIE_CONSENT_CONFIG} initialConsent={null} />
        {profileVisible ? <ClinicDetailClientAdapter data={clinicDetailFixture} /> : <div>Clinic listing</div>}
      </>
    )
    const view = render(composition(false))
    fireEvent.click(screen.getByRole('button', { name: 'Accept all' }))
    const session = api.getConsentedPostHogSessionId()
    view.rerender(composition(true))
    view.rerender(composition(true))
    expect(accepted.filter((name) => name === 'clinic_profile_viewed')).toHaveLength(1)
    view.rerender(composition(false))
    view.rerender(composition(true))
    expect(accepted.filter((name) => name === 'clinic_profile_viewed')).toHaveLength(2)
    expect(api.getConsentedPostHogSessionId()).toBe(session)
  })

  it('retains consent after the real patient login form requests navigation and refresh', async () => {
    const Login = await import('@/components/organisms/Auth/LoginForm')
    const { CookieConsentClientAdapter } = await import('@/features/cookieConsent/CookieConsentClientAdapter.client')
    const { ClinicDetailClientAdapter } =
      await import('@/app/(frontend)/clinics/[slug]/ClinicDetailClientAdapter.client')
    const { DEFAULT_COOKIE_CONSENT_CONFIG } = await import('@/features/cookieConsent')
    const { clinicDetailFixture } = await import('@/stories/fixtures/clinicDetail')
    const api = await import('@/posthog/client-api')
    const { default: sdk } = await import('posthog-js')
    const accepted: string[] = []
    sdk.on('eventCaptured', (event) => accepted.push(event.event))
    const loginHandler = vi.fn(async () => ({
      success: true as const,
      user: { id: 'synthetic-patient', email: 'synthetic@example.test', userType: 'patient' as const },
      redirectUrl: '/clinics',
    }))
    const consent = <CookieConsentClientAdapter config={DEFAULT_COOKIE_CONSENT_CONFIG} initialConsent={null} />
    const view = render(
      <>
        {consent}
        <Login.Root userTypes="patient" loginHandler={loginHandler}>
          <Login.Form>
            <Login.EmailField />
            <Login.PasswordField />
            <Login.SubmitButton>Sign in</Login.SubmitButton>
          </Login.Form>
        </Login.Root>
      </>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Accept all' }))
    const session = api.getConsentedPostHogSessionId()
    fireEvent.change(screen.getByRole('textbox', { name: 'Email' }), { target: { value: 'synthetic@example.test' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Synthetic-test-only' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    })
    expect(loginHandler).toHaveBeenCalledOnce()
    expect(router.push).toHaveBeenCalledWith('/clinics')
    expect(router.refresh).toHaveBeenCalled()
    view.rerender(
      <>
        {consent}
        <ClinicDetailClientAdapter data={clinicDetailFixture} />
      </>,
    )
    expect(api.getConsentedPostHogSessionId()).toBe(session)
    expect(accepted.filter((name) => name === 'clinic_profile_viewed')).toHaveLength(1)
    expect(screen.queryByRole('button', { name: 'Accept all' })).toBeNull()
  })

  it.each(['declined', 'version_changed', 'persistence_failed'] as const)(
    'closes the real SDK gate for %s consent',
    async (failure) => {
      const { CookieConsentClientAdapter } = await import('@/features/cookieConsent/CookieConsentClientAdapter.client')
      const { DEFAULT_COOKIE_CONSENT_CONFIG } = await import('@/features/cookieConsent')
      const api = await import('@/posthog/client-api')
      const { default: sdk } = await import('posthog-js')
      const accepted: string[] = []
      sdk.on('eventCaptured', (event) => accepted.push(event.event))
      const view = render(<CookieConsentClientAdapter config={DEFAULT_COOKIE_CONSENT_CONFIG} initialConsent={null} />)
      if (failure === 'persistence_failed') vi.spyOn(document, 'cookie', 'set').mockImplementation(() => {})
      fireEvent.click(screen.getByRole('button', { name: failure === 'declined' ? 'Reject all' : 'Accept all' }))
      if (failure === 'version_changed') {
        expect(api.getConsentedPostHogSessionId()).toBeTypeOf('string')
        view.rerender(
          <CookieConsentClientAdapter
            config={{
              ...DEFAULT_COOKIE_CONSENT_CONFIG,
              consentVersion: DEFAULT_COOKIE_CONSENT_CONFIG.consentVersion + 1,
            }}
            initialConsent={null}
          />,
        )
      }
      expect(api.postHogBrowserEvents.clinicProfileViewed(profile)).toBe(false)
      expect(api.getConsentedPostHogSessionId()).toBeUndefined()
      expect(accepted.filter((name) => name === 'clinic_profile_viewed')).toEqual([])
    },
  )

  it('exposes only consent and SDK booleans with a fixed reason for browser inspection', async () => {
    const { CookieConsentClientAdapter } = await import('@/features/cookieConsent/CookieConsentClientAdapter.client')
    const { DEFAULT_COOKIE_CONSENT_CONFIG } = await import('@/features/cookieConsent')
    const { default: sdk } = await import('posthog-js')
    const sessionRead = vi.spyOn(sdk, 'get_session_id')
    const view = render(<CookieConsentClientAdapter config={DEFAULT_COOKIE_CONSENT_CONFIG} initialConsent={null} />)
    const read = () =>
      JSON.parse(
        view.container.querySelector('[data-analytics-diagnostics]')!.getAttribute('data-analytics-diagnostics')!,
      )
    expect(read()).toEqual({
      cookieValid: false,
      analyticsAllowed: false,
      sdkReady: false,
      sessionAvailable: false,
      reason: 'cookie_invalid',
    })
    expect(sessionRead).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Accept all' }))
    expect(read()).toEqual({
      cookieValid: true,
      analyticsAllowed: true,
      sdkReady: true,
      sessionAvailable: true,
      reason: 'ready',
    })
    fireEvent.click(screen.getByRole('button', { name: 'Cookie settings' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reject all' }))
    expect(read()).toEqual({
      cookieValid: true,
      analyticsAllowed: false,
      sdkReady: false,
      sessionAvailable: false,
      reason: 'consent_required',
    })
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

  it.each([false, true])(
    'serializes the real SDK session for authenticated=%s only with persisted consent',
    async (authenticated) => {
      const { CookieConsentClientAdapter } = await import('@/features/cookieConsent/CookieConsentClientAdapter.client')
      const { DEFAULT_COOKIE_CONSENT_CONFIG } = await import('@/features/cookieConsent')
      const { submitClinicContactRequest } =
        await import('@/app/(frontend)/clinics/[slug]/ClinicDetailClientAdapter.client')
      const api = await import('@/posthog/client-api')
      const requests: { endpoint: string; payload: Record<string, unknown> }[] = []
      vi.mocked(fetch).mockImplementation(async (input, init) => {
        requests.push({ endpoint: String(input), payload: JSON.parse(String(init?.body)) })
        return new Response(JSON.stringify({ id: 'synthetic-inquiry' }), { status: 200 })
      })
      const request = {
        clinicId: '42',
        doctorId: '7',
        idempotencyKey: 'synthetic-request',
        message: 'Synthetic request.',
        consent: true,
      }
      render(<CookieConsentClientAdapter config={DEFAULT_COOKIE_CONSENT_CONFIG} initialConsent={null} />)
      await submitClinicContactRequest(request, authenticated)
      expect(requests[0]?.payload).not.toHaveProperty('session_id')
      fireEvent.click(screen.getByRole('button', { name: 'Accept all' }))
      const session = api.getConsentedPostHogSessionId()
      expect(session).toBeTypeOf('string')
      await submitClinicContactRequest(request, authenticated)
      expect(requests[1]).toEqual({
        endpoint: authenticated ? '/api/patient/inquiries' : '/api/clinic-contact-requests',
        payload: { ...request, session_id: session },
      })
      fireEvent.click(screen.getByRole('button', { name: 'Cookie settings' }))
      fireEvent.click(screen.getByRole('button', { name: 'Reject all' }))
      await submitClinicContactRequest(request, authenticated)
      expect(requests[2]?.payload).not.toHaveProperty('session_id')
    },
  )

  it('keeps consent through a refreshed authenticated profile and submits a direct doctor choice with a required phone', async () => {
    const { CookieConsentClientAdapter } = await import('@/features/cookieConsent/CookieConsentClientAdapter.client')
    const { ClinicDetailClientAdapter } =
      await import('@/app/(frontend)/clinics/[slug]/ClinicDetailClientAdapter.client')
    const { DEFAULT_COOKIE_CONSENT_CONFIG } = await import('@/features/cookieConsent')
    const { clinicDetailFixture } = await import('@/stories/fixtures/clinicDetail')
    const api = await import('@/posthog/client-api')
    const { default: sdk } = await import('posthog-js')
    const events: string[] = []
    sdk.on('eventCaptured', (event) => events.push(event.event))
    const view = render(<CookieConsentClientAdapter config={DEFAULT_COOKIE_CONSENT_CONFIG} initialConsent={null} />)
    fireEvent.click(screen.getByRole('button', { name: 'Accept all' }))
    const session = api.getConsentedPostHogSessionId()
    const inquiryCreation = {
      kind: 'authenticated' as const,
      loginHref: '/login/patient',
      account: { firstName: 'Synthetic', lastName: 'Patient', email: 'synthetic@example.test', phoneNumber: '' },
    }
    const composition = () => (
      <>
        <CookieConsentClientAdapter
          config={{ ...DEFAULT_COOKIE_CONSENT_CONFIG, categories: [...DEFAULT_COOKIE_CONSENT_CONFIG.categories] }}
          initialConsent={null}
        />
        <ClinicDetailClientAdapter data={clinicDetailFixture} inquiryCreation={inquiryCreation} />
      </>
    )
    view.rerender(composition())
    view.rerender(composition())
    expect(api.getConsentedPostHogSessionId()).toBe(session)
    expect(events.filter((name) => name === 'clinic_profile_viewed')).toHaveLength(1)
    fireEvent.click(screen.getAllByRole('button', { name: 'Select Dr. Amelia Carter' })[0]!)
    expect(screen.getByRole('combobox', { name: 'Doctor' })).toHaveProperty('value', 'doctor-1')
    fireEvent.change(screen.getByRole('textbox', { name: 'Phone Number' }), { target: { value: '+49 30 123456' } })
    fireEvent.change(screen.getByRole('textbox', { name: 'Message' }), {
      target: { value: 'Synthetic inquiry for testing.' },
    })
    fireEvent.click(screen.getByRole('checkbox', { name: /I agree/ }))
    const requests: { endpoint: string; payload: Record<string, unknown> }[] = []
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      requests.push({ endpoint: String(input), payload: JSON.parse(String(init?.body)) })
      return new Response(JSON.stringify({ inquiry: { id: 'synthetic-inquiry' } }), { status: 200 })
    })
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Submit Contact Request' })))
    expect(requests).toHaveLength(1)
    expect(requests[0]?.endpoint).toBe('/api/patient/inquiries')
    expect(requests[0]?.payload).toMatchObject({
      doctorId: 'doctor-1',
      phoneNumber: '+49 30 123456',
      session_id: session,
    })
    expect(requests[0]?.payload).not.toHaveProperty('email')
    expect(api.getConsentedPostHogSessionId()).toBe(session)
  })

  it('restores the current accepted cookie on remount without withdrawing consent or changing the session', async () => {
    const { CookieConsentClientAdapter } = await import('@/features/cookieConsent/CookieConsentClientAdapter.client')
    const { DEFAULT_COOKIE_CONSENT_CONFIG } = await import('@/features/cookieConsent')
    const api = await import('@/posthog/client-api')
    const view = render(<CookieConsentClientAdapter config={DEFAULT_COOKIE_CONSENT_CONFIG} initialConsent={null} />)
    fireEvent.click(screen.getByRole('button', { name: 'Accept all' }))
    const session = api.getConsentedPostHogSessionId()
    view.unmount()
    render(<CookieConsentClientAdapter config={DEFAULT_COOKIE_CONSENT_CONFIG} initialConsent={null} />)
    expect(api.getConsentedPostHogSessionId()).toBe(session)
  })

  it('restores accepted consent through the real consent controller', async () => {
    const { CookieConsentClientAdapter } = await import('@/features/cookieConsent/CookieConsentClientAdapter.client')
    const { DEFAULT_COOKIE_CONSENT_CONFIG, createCookieConsentState, writeCookieConsentToDocument } =
      await import('@/features/cookieConsent')
    const api = await import('@/posthog/client-api')
    const acceptedConsent = createCookieConsentState({
      choice: 'accepted',
      categories: { analytics: true },
      version: DEFAULT_COOKIE_CONSENT_CONFIG.consentVersion,
    })
    writeCookieConsentToDocument(acceptedConsent)
    render(<CookieConsentClientAdapter config={DEFAULT_COOKIE_CONSENT_CONFIG} initialConsent={acceptedConsent} />)
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
