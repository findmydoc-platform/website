import path from 'node:path'
import { expect, test } from '@playwright/test'
import { build } from 'vite'
import { isCaptureRequest } from '../../../scripts/testing/posthog-observer'

test('keeps analytics transport off for functional consent and after withdrawal @consent @smoke', async ({
  browser,
}) => {
  test.setTimeout(30000)
  const entry = `
    import React from 'react'
    import { createRoot } from 'react-dom/client'
    import posthog from 'posthog-js'
    import { CookieConsentClientAdapter } from '@/features/cookieConsent/CookieConsentClientAdapter.client'
    import { DEFAULT_COOKIE_CONSENT_CONFIG } from '@/features/cookieConsent'
    // Keep the SDK transport-capable in every phase of this automated browser test.
    const originalInit = posthog.init.bind(posthog)
    posthog.init = (key, options, name) => originalInit(key, {...options, opt_out_useragent_filter: true}, name)
    function App() {
      return <><button onClick={() => posthog.capture('consent_transport_probe')}>Send probe</button>
        <CookieConsentClientAdapter config={DEFAULT_COOKIE_CONSENT_CONFIG} initialConsent={null} /></>
    }
    createRoot(document.getElementById('root')).render(<App />)
  `
  const built = await build({
    configFile: false,
    logLevel: 'silent',
    resolve: { alias: { '@': path.resolve('src') } },
    define: {
      process: JSON.stringify({
        env: {
          NODE_ENV: 'production',
          NEXT_PUBLIC_POSTHOG_KEY: 'phc_synthetic_test',
          NEXT_PUBLIC_POSTHOG_HOST: 'https://analytics.example.test',
        },
      }),
    },
    plugins: [
      {
        name: 'functional-consent-test-entry',
        enforce: 'pre',
        resolveId: (id) =>
          id === 'next/navigation'
            ? '\0test-navigation'
            : id === 'next/link'
              ? '\0test-link'
              : id === 'functional-consent-entry.tsx' || id === path.resolve('functional-consent-entry.tsx')
                ? path.resolve('functional-consent-entry.tsx')
                : undefined,
        load: (id) =>
          id === '\0test-navigation'
            ? "export const usePathname = () => '/'"
            : id === '\0test-link'
              ? "import React from 'react'; export default function Link({children, href, ...props}) { return React.createElement('a', {href, ...props}, children) }"
              : id === path.resolve('functional-consent-entry.tsx')
                ? entry
                : undefined,
      },
    ],
    build: {
      write: false,
      minify: false,
      lib: { entry: 'functional-consent-entry.tsx', formats: ['iife'], name: 'ConsentTest' },
    },
  })
  const output = Array.isArray(built) ? built[0] : built
  if (!output || !('output' in output)) throw new Error('Browser test bundle is unavailable')
  const bundle = output.output.find((item) => item.type === 'chunk')
  if (!bundle || bundle.type !== 'chunk') throw new Error('Browser test entry is unavailable')

  const context = await browser.newContext({ serviceWorkers: 'block' })
  try {
    const requests: string[] = []
    const captures: string[] = []
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url())
      if (url.origin === 'https://consent.example.test') {
        await route.fulfill(
          url.pathname === '/entry.js'
            ? { contentType: 'application/javascript', body: bundle.code }
            : {
                contentType: 'text/html',
                body: '<div id="root"></div><script>globalThis.process={env:{}}</script><script src="/entry.js"></script>',
              },
        )
      } else {
        requests.push(route.request().url())
        if (isCaptureRequest(route.request().url(), route.request().method())) captures.push(route.request().url())
        await route.fulfill({ contentType: 'application/json', body: '{}' })
      }
    })
    const page = await context.newPage()
    page.setDefaultTimeout(5000)
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto('https://consent.example.test/')
    expect(requests).toEqual([])
    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    await page.getByRole('checkbox', { name: 'Functional cookies' }).check()
    await page.getByRole('button', { name: 'Save preferences' }).click()
    await page.getByRole('button', { name: 'Send probe' }).click()
    await page.waitForTimeout(1500)
    expect(requests).toEqual([])

    await page.getByRole('button', { name: 'Cookie settings', exact: true }).click()
    await page.getByRole('checkbox', { name: 'Analytics cookies' }).check()
    await page.getByRole('button', { name: 'Save preferences' }).click()
    await expect
      .poll(
        async () =>
          JSON.parse(
            (await page.locator('[data-analytics-diagnostics]').getAttribute('data-analytics-diagnostics')) ?? '{}',
          ).sdkReady,
        { timeout: 5000 },
      )
      .toBe(true)
    await expect.poll(() => captures.length, { timeout: 10000 }).toBeGreaterThan(0)
    const initialCaptureCount = captures.length
    await page.getByRole('button', { name: 'Send probe' }).click()
    await expect.poll(() => captures.length, { timeout: 10000 }).toBeGreaterThan(initialCaptureCount)

    await page.getByRole('button', { name: 'Cookie settings', exact: true }).click()
    await page.getByRole('button', { name: 'Reject all' }).click()
    await page.waitForTimeout(1500)
    const afterWithdrawal = requests.length
    await page.getByRole('button', { name: 'Send probe' }).click()
    await page.waitForTimeout(1500)
    expect(requests).toHaveLength(afterWithdrawal)
    expect(errors).toEqual([])
  } finally {
    await context.close()
  }
})
