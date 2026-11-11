// @vitest-environment jsdom

import React from 'react'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }))
vi.mock('next/navigation', () => ({ usePathname: () => '/clinics/synthetic-clinic', useRouter: () => router }))
vi.mock('@/auth/utilities/loginHandler', () => ({ handleLogin: vi.fn() }))

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

async function mountInquiry(phoneNumber?: string) {
  const { ClinicDetailClientAdapter } = await import('@/app/(frontend)/clinics/[slug]/ClinicDetailClientAdapter.client')
  const { CookieConsentClientAdapter } = await import('@/features/cookieConsent/CookieConsentClientAdapter.client')
  const { DEFAULT_COOKIE_CONSENT_CONFIG } = await import('@/features/cookieConsent')
  const { clinicDetailFixture } = await import('@/stories/fixtures/clinicDetail')
  const { default: sdk } = await import('posthog-js')
  const starts: { properties: Record<string, unknown>; at: number }[] = []
  sdk.on('eventCaptured', (event) => {
    if (event.event === 'clinic_inquiry_started') starts.push({ properties: event.properties, at: Date.now() })
  })
  const inquiryCreation =
    phoneNumber === undefined
      ? { kind: 'guest' as const }
      : {
          kind: 'authenticated' as const,
          loginHref: '/login/patient',
          account: { firstName: 'Synthetic', lastName: 'Patient', email: 'synthetic@example.test', phoneNumber },
        }
  const view = render(
    <>
      <ClinicDetailClientAdapter data={clinicDetailFixture} inquiryCreation={inquiryCreation} />
      <CookieConsentClientAdapter config={DEFAULT_COOKIE_CONSENT_CONFIG} initialConsent={null} />
    </>,
  )
  return {
    starts,
    sdk,
    view,
    form: within(screen.getByRole('form', { name: 'Clinic appointment request', hidden: true })),
  }
}

describe('inquiry starts through the rendered clinic form and installed SDK', () => {
  it('captures an invalid guest edit with clinic context only', async () => {
    const { ClinicDetailClientAdapter } =
      await import('@/app/(frontend)/clinics/[slug]/ClinicDetailClientAdapter.client')
    const { CookieConsentClientAdapter } = await import('@/features/cookieConsent/CookieConsentClientAdapter.client')
    const { DEFAULT_COOKIE_CONSENT_CONFIG } = await import('@/features/cookieConsent')
    const { clinicDetailFixture } = await import('@/stories/fixtures/clinicDetail')
    const { default: sdk } = await import('posthog-js')
    const starts: Record<string, unknown>[] = []
    sdk.on('eventCaptured', (event) => {
      if (event.event === 'clinic_inquiry_started') starts.push(event.properties)
    })
    render(
      <>
        <ClinicDetailClientAdapter data={clinicDetailFixture} />
        <CookieConsentClientAdapter config={DEFAULT_COOKIE_CONSENT_CONFIG} initialConsent={null} />
      </>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Accept all' }))
    fireEvent.input(screen.getByRole('textbox', { name: 'Email' }), {
      target: { value: 'invalid-private-value' },
      inputType: 'insertText',
    })
    expect(starts).toHaveLength(1)
    const custom = Object.fromEntries(
      Object.entries(starts[0]!).filter(([key]) => !key.startsWith('$') && !['distinct_id', 'token'].includes(key)),
    )
    expect(custom).toEqual({ clinic_id: String(clinicDetailFixture.clinicId) })
    expect(JSON.stringify(starts)).not.toContain('invalid-private-value')
  })

  it('includes incomplete edits, clearing and every in-form select without sending content', async () => {
    const { form, starts } = await mountInquiry()
    fireEvent.click(screen.getByRole('button', { name: 'Accept all' }))
    const message = form.getByRole('textbox', { name: 'Message' })
    fireEvent.input(message, { target: { value: 'private message' }, inputType: 'insertText' })
    fireEvent.input(message, { target: { value: '' }, inputType: 'deleteContentBackward' })
    for (const name of [
      'How Soon Are You Considering Treatment?',
      'When Should We Contact You?',
      'Doctor',
      'Treatment',
    ]) {
      const select = form.getByRole('combobox', { name }) as HTMLSelectElement
      fireEvent.change(select, { target: { value: select.options[1]!.value } })
    }
    expect(starts).toHaveLength(6)
    expect(JSON.stringify(starts)).not.toContain('private message')
    expect(starts.every(({ properties }) => !('doctor_id' in properties) && !('treatment_id' in properties))).toBe(true)
  })

  it.each(['', '+49 30 123456'])(
    'excludes authenticated prefill, focus, consent and external selections before a direct edit with phone %s',
    async (phone) => {
      const { form, starts } = await mountInquiry(phone)
      fireEvent.click(screen.getByRole('button', { name: 'Accept all' }))
      fireEvent.focus(form.getByRole('textbox', { name: 'Message' }))
      fireEvent.scroll(window)
      fireEvent.click(form.getByRole('checkbox'))
      fireEvent.click(screen.getAllByRole('button', { name: 'Choose Treatment' })[0]!)
      fireEvent.click(screen.getAllByRole('button', { name: 'Select Dr. Amelia Carter' })[0]!)
      fireEvent.click(screen.getAllByRole('link', { name: 'Contact Doctor' })[0]!)
      expect(starts).toHaveLength(0)
      fireEvent.input(form.getByRole('textbox', { name: phone ? 'Message' : 'Phone Number' }), {
        target: { value: phone ? 'own edit' : '+49 30 654321' },
        inputType: 'insertText',
      })
      expect(starts).toHaveLength(1)
    },
  )

  it('does not treat native replacement autofill as an own edit', async () => {
    const { form, starts } = await mountInquiry()
    fireEvent.click(screen.getByRole('button', { name: 'Accept all' }))
    const email = form.getByRole('textbox', { name: 'Email' })
    act(() => email.focus())
    fireEvent.input(email, {
      target: { value: 'autofilled@example.test' },
      inputType: 'insertReplacementText',
    })
    fireEvent.input(form.getByRole('textbox', { name: 'First Name' }), { target: { value: 'Autofilled' } })
    expect(starts).toHaveLength(0)
    fireEvent.input(form.getByRole('textbox', { name: 'Email' }), {
      target: { value: 'autofilled@example.tes' },
      inputType: 'deleteContentBackward',
    })
    expect(starts).toHaveLength(1)
  })

  it.each([undefined, '+49 30 123456'])(
    'counts an accepted correction in the focused form after automatic prefill with phone %s',
    async (phone) => {
      const { form, starts } = await mountInquiry(phone)
      fireEvent.click(screen.getByRole('button', { name: 'Accept all' }))
      const message = form.getByRole('textbox', { name: 'Message' })
      fireEvent.input(message, { target: { value: 'Please corect this' } })
      act(() => message.focus())
      expect(starts).toHaveLength(0)
      // W3C Input Events defines replacement text for accepted spelling/writing suggestions.
      fireEvent(
        message,
        new InputEvent('beforeinput', {
          bubbles: true,
          cancelable: true,
          data: 'correct',
          inputType: 'insertReplacementText',
        }),
      )
      fireEvent.input(message, {
        target: { value: 'Please correct this' },
        data: 'correct',
        inputType: 'insertReplacementText',
      })
      expect(starts).toHaveLength(1)
      expect(JSON.stringify(starts)).not.toContain('correct')
    },
  )

  it.each([':autofill', ':-webkit-autofill'])(
    'excludes browser-marked %s even when a focused replacement includes text',
    async (autofillSelector) => {
      const { form, starts } = await mountInquiry()
      fireEvent.click(screen.getByRole('button', { name: 'Accept all' }))
      const email = form.getByRole('textbox', { name: 'Email' })
      act(() => email.focus())
      // jsdom has no native autofill; substitute only the browser's observable marker.
      vi.spyOn(email, 'matches').mockImplementation((selector) => selector === autofillSelector)
      fireEvent.input(email, {
        target: { value: 'autofilled@example.test' },
        data: 'autofilled@example.test',
        inputType: 'insertReplacementText',
      })
      expect(starts).toHaveLength(0)
    },
  )

  it('does not replay edits after consent and keeps later-period edits on the mounted browser', async () => {
    const { form, starts, sdk } = await mountInquiry()
    const message = form.getByRole('textbox', { name: 'Message', hidden: true })
    fireEvent.input(message, { target: { value: 'before consent' }, inputType: 'insertText' })
    fireEvent.click(screen.getByRole('button', { name: 'Accept all' }))
    expect(starts).toHaveLength(0)
    fireEvent.input(message, { target: { value: 'after consent' }, inputType: 'insertText' })
    const browser = sdk.get_distinct_id()
    const earlier = Date.now()
    vi.setSystemTime(earlier + 91 * 24 * 60 * 60 * 1000)
    fireEvent.input(message, { target: { value: 'next period' }, inputType: 'insertText' })
    expect(starts).toHaveLength(2)
    expect(starts[1]!.at).toBeGreaterThan(starts[0]!.at)
    expect(sdk.get_distinct_id()).toBe(browser)
    fireEvent.click(screen.getByRole('button', { name: 'Cookie settings' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reject all' }))
    fireEvent.input(message, { target: { value: 'after withdrawal' }, inputType: 'insertText' })
    expect(starts).toHaveLength(2)
  })

  it.each(['declined', 'capture_failed', 'accepted'] as const)(
    'submits an otherwise valid request when analytics is %s',
    async (mode) => {
      const { form, starts, sdk } = await mountInquiry('+49 30 123456')
      fireEvent.click(screen.getByRole('button', { name: mode === 'declined' ? 'Reject all' : 'Accept all' }))
      if (mode === 'capture_failed')
        vi.spyOn(sdk, 'capture').mockImplementation(() => {
          throw new Error('synthetic analytics failure')
        })
      fireEvent.change(form.getByRole('combobox', { name: 'Doctor' }), { target: { value: 'doctor-1' } })
      fireEvent.input(form.getByRole('textbox', { name: 'Message' }), {
        target: { value: 'Synthetic valid request' },
        inputType: 'insertText',
      })
      fireEvent.click(form.getByRole('checkbox'))
      const startsBeforeSubmission = starts.length
      const submitted: string[] = []
      vi.mocked(fetch).mockImplementation(async (input) => {
        submitted.push(String(input))
        return Response.json({ inquiry: { id: 'synthetic-inquiry' } })
      })
      await act(async () => fireEvent.click(form.getByRole('button', { name: 'Submit Contact Request' })))
      expect(submitted).toEqual(['/api/patient/inquiries'])
      expect(form.getByRole('button', { name: 'Request sent' })).toBeTruthy()
      expect(starts).toHaveLength(startsBeforeSubmission)
      expect(starts.length).toBe(mode === 'accepted' ? 2 : 0)
    },
  )
})
