import path from 'node:path'
import { chromium } from 'playwright'
import { build } from 'vite'
import { describe, expect, it } from 'vitest'
import { decodeCaptureRequest, isCaptureRequest } from '../../../scripts/testing/posthog-observer'

// Bundle the real browser composition without starting Next.js or connecting to Payload.
const entry = `
  import React from 'react'
  import sdk from 'posthog-js'
  const captured = []
  globalThis.syntheticSession = () => sdk.get_session_id()
  sdk.on('eventCaptured', (event) => captured.push(event.event))
  globalThis.consentDiagnostics = () => ({ captured, capturing: sdk.is_capturing(), webdriver: navigator.webdriver, bot: sdk._is_bot(), hasToken: Boolean(sdk.config.token), loaded: sdk.__loaded, optedIn: sdk.has_opted_in_capturing(), optedOut: sdk.has_opted_out_capturing() })
  import { createRoot } from 'react-dom/client'
  import { ClinicDetailClientAdapter } from '@/app/(frontend)/clinics/[slug]/ClinicDetailClientAdapter.client'
  import { CookieConsentClientAdapter } from '@/features/cookieConsent/CookieConsentClientAdapter.client'
  import { DEFAULT_COOKIE_CONSENT_CONFIG } from '@/features/cookieConsent'
  import { clinicDetailFixture } from '@/stories/fixtures/clinicDetail'
  createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <ClinicDetailClientAdapter data={clinicDetailFixture} />
      <CookieConsentClientAdapter config={DEFAULT_COOKIE_CONSENT_CONFIG} initialConsent={null} />
    </React.StrictMode>
  )
`

describe.skipIf(process.env.POSTHOG_BROWSER_TEST !== '1')('consent-controlled browser transport', () => {
  it('sends one current profile and one later CTA, with no replay after withdrawal', async ({ skip }) => {
    const result = await build({
      configFile: false,
      logLevel: 'silent',
      resolve: { alias: { '@': path.resolve('src') } },
      define: {
        process: JSON.stringify({
          env: {
            NODE_ENV: 'production',
            NEXT_PUBLIC_POSTHOG_KEY: 'phc_synthetic_browser_test',
            NEXT_PUBLIC_POSTHOG_HOST: 'https://analytics.example.test',
          },
        }),
      },
      plugins: [
        {
          name: 'consent-browser-entry',
          enforce: 'pre',
          resolveId: (id) =>
            id === 'next/image'
              ? 'next-image-bridge'
              : id === 'consent-browser-entry.tsx' || id === path.resolve('consent-browser-entry.tsx')
                ? path.resolve('consent-browser-entry.tsx')
                : undefined,
          load: (id) =>
            id === 'next-image-bridge'
              ? `import { Image } from 'next/dist/client/image-component.js'; export default Image;`
              : id === path.resolve('consent-browser-entry.tsx')
                ? entry
                : undefined,
        },
      ],
      build: {
        write: false,
        minify: false,
        lib: { entry: 'consent-browser-entry.tsx', formats: ['iife'], name: 'ConsentTest' },
      },
    })
    const output = Array.isArray(result) ? result[0] : result
    if (!output || !('output' in output)) throw new Error('Browser test bundle is unavailable')
    const bundle = output.output.find((item) => item.type === 'chunk')
    if (!bundle || bundle.type !== 'chunk') throw new Error('Browser test entry is unavailable')
    const browser = await chromium.launch({ channel: 'chrome', headless: false })
    try {
      const context = await browser.newContext({ serviceWorkers: 'block' })
      const events: string[] = []
      const errors: string[] = []
      // Every request is intercepted, including config, recorder scripts, and event transport.
      await context.route('**/*', async (route) => {
        const request = route.request()
        if (
          new URL(request.url()).origin === 'https://consent.example.test' &&
          new URL(request.url()).pathname !== '/entry.js'
        ) {
          await route.fulfill({
            contentType: 'text/html',
            body: '<div id="root"></div><script>globalThis.process={env:{}}</script><script src="/entry.js"></script>',
          })
        } else if (request.url() === 'https://consent.example.test/entry.js') {
          await route.fulfill({ contentType: 'application/javascript', body: bundle.code })
        } else {
          const body = request.postDataBuffer()
          if (body && isCaptureRequest(request.url(), request.method())) {
            const evidence = decodeCaptureRequest({ url: request.url(), method: request.method(), body }, 'clinic-1')
            expect(evidence.decoded).toBe(true)
            events.push(...evidence.eventNames)
          }
          await route.fulfill({ contentType: 'application/json', body: '{}' })
        }
      })
      const page = await context.newPage()
      page.setDefaultTimeout(3000)
      page.on('pageerror', (error) => errors.push(error.message))
      await page.goto('https://consent.example.test/')
      expect(errors).toEqual([])
      await page.getByRole('button', { name: 'Choose Treatment' }).first().click()
      expect(events).toEqual([])
      await page.getByRole('button', { name: 'Accept all' }).click()
      const automationFiltered = await page.evaluate('consentDiagnostics().bot && consentDiagnostics().webdriver')
      if (automationFiltered)
        skip(true, 'The installed SDK rejects WebDriver-controlled browsers before event transport.')
      await expect
        .poll(() => events.filter((event) => event === 'clinic_profile_viewed').length, { timeout: 10000 })
        .toBe(1)
      expect(
        await page.evaluate("consentDiagnostics().captured.filter(name => name === 'clinic_profile_viewed').length"),
      ).toBe(1)
      await page.getByRole('button', { name: 'Choose Treatment' }).first().click()
      await expect
        .poll(() => events.filter((event) => event === 'clinic_cta_clicked').length, { timeout: 10000 })
        .toBe(1)
      await page.getByRole('button', { name: 'Cookie settings', exact: true }).click()
      await page.getByRole('button', { name: 'Reject all' }).click()
      await page.getByRole('button', { name: 'Choose Treatment' }).first().click()
      await page.getByRole('button', { name: 'Cookie settings', exact: true }).click()
      await page.getByRole('checkbox', { name: /Analytics/ }).check()
      await page.getByRole('button', { name: /Save/ }).click()
      // A new CTA after reconsent proves transport is active without replaying the earlier view or click.
      await page.getByRole('button', { name: 'Choose Treatment' }).first().click()
      await expect
        .poll(() => events.filter((event) => event === 'clinic_cta_clicked').length, { timeout: 10000 })
        .toBe(2)
      expect(events).toEqual(['clinic_profile_viewed', 'clinic_cta_clicked', 'clinic_cta_clicked'])
      // Full documents restore the consent cookie; a reload is another intended view.
      const session = await page.evaluate('syntheticSession()')
      await page.goto('https://consent.example.test/authenticated-profile')
      await expect
        .poll(() => events.filter((name) => name === 'clinic_profile_viewed').length, { timeout: 10000 })
        .toBe(2)
      expect(await page.evaluate('syntheticSession()')).toBe(session)
      expect(await page.getByRole('button', { name: 'Accept all' }).count()).toBe(0)
      await page.reload()
      await expect
        .poll(() => events.filter((name) => name === 'clinic_profile_viewed').length, { timeout: 10000 })
        .toBe(3)
      expect(await page.evaluate('syntheticSession()')).toBe(session)
      expect(errors).toEqual([])
    } finally {
      await browser.close()
    }
  }, 30000)
})
