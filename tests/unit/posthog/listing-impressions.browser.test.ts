import path from 'node:path'
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { once } from 'node:events'
import { chromium, type Page } from 'playwright'
import { build } from 'vite'
import { beforeAll, describe, expect, it } from 'vitest'
import { decodeCaptureRequest, isCaptureRequest } from '../../../scripts/testing/posthog-observer'

const entry = `
  import React from 'react'
  import { createRoot } from 'react-dom/client'
  import sdk from 'posthog-js'
  import { ListingComparisonPageClient } from '@/app/(frontend)/listing-comparison/ListingComparisonPage.client'
  import { setPostHogAnalyticsConsent, getPostHogBrowserDiagnostics } from '@/posthog/client-api'
  import '@/app/(frontend)/globals.css'
  const captured = []
  const starts = []
  sdk.on('eventCaptured', event => {
    if (event.event === 'clinic_search_result_viewed') captured.push(event)
    if (event.event === 'clinic_inquiry_started') starts.push(event)
  })
  globalThis.impressions = () => captured.map(event => ({ clinic_id: event.properties.clinic_id,
    customKeys: Object.keys(event.properties).filter(key => !key.startsWith('$') && !['token','distinct_id'].includes(key)),
    containsSearchInput: JSON.stringify(event).includes('synthetic-private-selection') }))
  globalThis.allowAnalytics = value => setPostHogAnalyticsConsent(value)
  globalThis.rejectNextImpression = () => {
    const filter = sdk.config.before_send
    let pending = true
    sdk.set_config({ before_send: event => {
      if (event.event === 'clinic_search_result_viewed' && event.properties.clinic_id === '104' && pending) { pending = false; return null }
      return filter(event)
    } })
  }
  globalThis.syntheticStarterPrivacyProbe = () => {
    sdk.register({ search_choice: 'synthetic-private-selection' })
    sdk.capture('clinic_inquiry_started', { clinic_id: '101' }, { $set: { patient_note: 'synthetic-private-selection' }, $set_once: { first_search: 'synthetic-private-selection' } })
    return starts.map(event => ({ containsInput: JSON.stringify(event).includes('synthetic-private-selection'),
      hasPersonUpdates: Boolean(event.$set || event.$set_once), hasBrowser: Boolean(event.properties.distinct_id), hasSession: Boolean(event.properties.$session_id) }))
  }
  globalThis.browserState = () => ({ visible: document.visibilityState, focused: document.hasFocus(), webdriver: navigator.webdriver, bot: sdk._is_bot(), ...getPostHogBrowserDiagnostics() })
  const clinic = id => ({ id, name: 'Synthetic clinic ' + id, location: 'Istanbul, Türkiye',
    media: { src: '/clinic.svg', alt: 'Synthetic clinic' }, verification: { variant: 'gold' },
    rating: { value: 4.8, count: 20 }, tags: [], actions: { details: { href: '#details', label: 'View clinic' } } })
  const initial = { hero: { title: 'Find a clinic', subtitle: 'Synthetic search results', features: [], bulletStyle: 'circle' },
    trust: null, results: [clinic('101'), clinic('102'), clinic('103'), clinic('104')],
    favorites: { isPatient: true, favoriteStateByClinicId: {} },
    filterOptions: { cities: [], waitTimes: [], specialties: [], treatments: [] },
    priceBounds: { min: 0, max: 20000 },
    queryState: { page: 1, sort: 'rank', cities: [], treatments: [], specialties: [], ratingMin: null, priceMin: 0, priceMax: 20000 },
    pagination: { page: 1, perPage: 4, totalPages: 4, totalResults: 16, totalAvailableResults: 16 },
    specialtyContext: { selected: [], breadcrumbs: [] } }
  const root = createRoot(document.getElementById('root'))
  let props = initial
  const render = () => root.render(<React.StrictMode><ListingComparisonPageClient {...props} /></React.StrictMode>)
  globalThis.commitResults = (query, ids) => {
    props = { ...props, queryState: { ...props.queryState, ...query },
      pagination: { ...props.pagination, page: query.page ?? props.pagination.page },
      results: (ids ?? props.results.map(row => row.id)).map(clinic) }
    render()
  }
  render()
`

let javascript: string
let css: string
const pendingNavigation: string[] = []

describe.skipIf(process.env.POSTHOG_BROWSER_TEST !== '1')('actual listing viewport capture', () => {
  beforeAll(async () => {
    const result = await build({
      configFile: false,
      logLevel: 'silent',
      resolve: { alias: { '@': path.resolve('src') } },
      esbuild: { jsx: 'automatic' },
      define: {
        process: JSON.stringify({
          env: {
            NODE_ENV: 'production',
            NEXT_PUBLIC_POSTHOG_KEY: 'phc_listing_synthetic',
            NEXT_PUBLIC_POSTHOG_HOST: 'https://analytics.example.test',
          },
        }),
      },
      plugins: [
        {
          name: 'listing-browser-composition',
          enforce: 'pre',
          resolveId: (id) =>
            id === 'next/navigation'
              ? 'navigation-boundary'
              : id === 'next/image'
                ? 'image-boundary'
                : id.endsWith('listing-browser-entry.tsx')
                  ? path.resolve('listing-browser-entry.tsx')
                  : undefined,
          load: (id) =>
            id === 'navigation-boundary'
              ? `
          const navigate = href => { history.pushState(null, '', href); globalThis.reportNavigation(href) }
          const router = { push: navigate, replace: navigate, refresh() {}, prefetch() {} }
          export const useRouter = () => router
          export const usePathname = () => location.pathname
          export const useSearchParams = () => new URLSearchParams(location.search)
        `
              : id === 'image-boundary'
                ? `import { Image } from 'next/dist/client/image-component.js'; export default Image;`
                : id === path.resolve('listing-browser-entry.tsx')
                  ? entry
                  : undefined,
        },
      ],
      build: {
        write: false,
        minify: false,
        lib: { entry: 'listing-browser-entry.tsx', formats: ['iife'], name: 'ListingTest' },
      },
    })
    const output = Array.isArray(result) ? result[0] : result
    if (!output || !('output' in output)) throw new Error('Missing listing browser bundle')
    javascript = output.output
      .filter((item) => item.type === 'chunk')
      .map((item) => item.code)
      .join('\n')
    css = output.output
      .flatMap((item) => (item.type === 'asset' && item.fileName.endsWith('.css') ? [String(item.source)] : []))
      .join('\n')
  }, 60000)

  async function inBrowser(run: (page: Page, transported: string[]) => Promise<void>) {
    // CDP noDefaults omits Playwright's forced focus/visibility. The ephemeral
    // native browser keeps production SDK bot policy and consent behavior intact.
    const profile = await mkdtemp(path.join(tmpdir(), 'listing-browser-'))
    const chrome = spawn(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      [
        `--user-data-dir=${profile}`,
        '--remote-debugging-port=0',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-blink-features=AutomationControlled',
        '--window-size=1440,700',
        '--no-startup-window',
      ],
      { stdio: 'ignore' },
    )
    let port = ''
    await expect
      .poll(
        async () => {
          port = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8').catch(() => '')).split('\n')[0] ?? ''
          return Boolean(port)
        },
        { timeout: 10000 },
      )
      .toBe(true)
    const browser = await chromium.connectOverCDP(`http://localhost:${port}`, { noDefaults: true })
    try {
      const context = browser.contexts()[0]
      if (!context) throw new Error('Missing native browser context')
      pendingNavigation.length = 0
      const errors: string[] = []
      const transported: string[] = []
      await context.exposeBinding('reportNavigation', (_, href: string) => pendingNavigation.push(href))
      await context.route('**/*', (route) => {
        const request = route.request()
        const url = new URL(request.url())
        if (url.pathname === '/entry.js')
          return route.fulfill({ contentType: 'application/javascript', body: javascript })
        if (url.pathname === '/style.css') return route.fulfill({ contentType: 'text/css', body: css })
        if (url.pathname === '/clinic.svg')
          return route.fulfill({
            contentType: 'image/svg+xml',
            body: '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"/>',
          })
        if (url.origin === 'https://listing.example.test')
          return route.fulfill({
            contentType: 'text/html',
            body: '<!doctype html><html><head><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script>globalThis.process={env:{}}</script><script src="/entry.js"></script></body></html>',
          })
        const body = request.postDataBuffer()
        if (body && isCaptureRequest(request.url(), request.method())) {
          const evidence = decodeCaptureRequest({ url: request.url(), method: request.method(), body }, '101')
          expect(evidence.decoded).toBe(true)
          if (evidence.reportingContextOnly !== null) {
            expect(evidence.reportingContextOnly).toBe(true)
            expect(evidence.reportingBrowserIdentityPresent).toBe(true)
          }
          transported.push(...evidence.eventNames)
        }
        return route.fulfill({ contentType: 'application/json', body: '{}' })
      })
      const page = await context.newPage()
      await page.setViewportSize({ width: 1440, height: 700 })
      page.setDefaultTimeout(5000)
      page.on('pageerror', (error) => errors.push(error.message))
      await page.goto('https://listing.example.test/listing-comparison')
      await page.bringToFront()
      await page
        .getByRole('heading', { name: 'Synthetic clinic 101' })
        .waitFor()
        .catch((error) => {
          throw new Error(`${error.message}; browser errors: ${errors.join('; ')}`)
        })
      await run(page, transported)
      const acceptedCount = await page.evaluate('impressions().length')
      await expect
        .poll(() => transported.filter((event) => event === 'clinic_search_result_viewed').length, { timeout: 10000 })
        .toBe(acceptedCount)
      expect(errors).toEqual([])
    } finally {
      await browser.close()
      chrome.kill()
      if (chrome.exitCode === null) await once(chrome, 'exit')
      await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
    }
  }

  it('opens a requested result page through the existing pagination controls', async () => {
    await inBrowser(async (page) => {
      await page.getByRole('button', { name: 'Go to next page' }).click()
      await expect.poll(() => pendingNavigation.at(-1)).toBe('/listing-comparison?page=2')
    })
  })

  it('counts visible pixels once and only counts a lower card after scrolling it into view', async () => {
    await inBrowser(async (page, transported) => {
      await page.evaluate('allowAnalytics(true)')
      await expect.poll(() => page.evaluate('browserState().focused')).toBe(true)
      expect(await page.evaluate('browserState()')).toMatchObject({ bot: false, sdkReady: true })
      const first = page.locator('article').nth(0)
      const last = page.locator('article').nth(3)
      await first.scrollIntoViewIfNeeded()
      await expect.poll(() => page.evaluate("impressions().filter(row => row.clinic_id === '101').length")).toBe(1)
      expect(await last.evaluate((element) => element.getBoundingClientRect().top > innerHeight)).toBe(true)
      expect(await page.evaluate("impressions().filter(row => row.clinic_id === '104').length")).toBe(0)
      await last.scrollIntoViewIfNeeded()
      await expect.poll(() => page.evaluate("impressions().filter(row => row.clinic_id === '104').length")).toBe(1)
      await first.scrollIntoViewIfNeeded()
      await last.scrollIntoViewIfNeeded()
      expect(await page.evaluate("impressions().filter(row => row.clinic_id === '104').length")).toBe(1)
      await expect
        .poll(() => transported.filter((event) => event === 'clinic_search_result_viewed').length, { timeout: 10000 })
        .toBeGreaterThan(0)
    })
  })

  it('does not attach search values from SDK URL metadata to impressions', async () => {
    await inBrowser(async (page, transported) => {
      await page.evaluate("history.pushState(null, '', '?treatment=synthetic-private-selection')")
      await page.evaluate('allowAnalytics(true)')
      await expect.poll(() => page.evaluate('impressions().length')).toBeGreaterThan(0)
      expect(await page.evaluate('impressions().every(row => !row.containsSearchInput)')).toBe(true)
      expect(
        await page.evaluate('impressions().every(row => JSON.stringify(row.customKeys) === \'["clinic_id"]\')'),
      ).toBe(true)
      await expect
        .poll(() => transported.filter((event) => event === 'clinic_search_result_viewed').length, { timeout: 10000 })
        .toBeGreaterThan(0)
    })
  })

  it('filters SDK superproperties and person updates from inquiry starts while preserving browser recognition', async () => {
    await inBrowser(async (page, transported) => {
      await page.evaluate("history.pushState(null, '', '?treatment=synthetic-private-selection')")
      await page.evaluate('allowAnalytics(true)')
      expect(await page.evaluate('syntheticStarterPrivacyProbe()')).toEqual([
        { containsInput: false, hasPersonUpdates: false, hasBrowser: true, hasSession: true },
      ])
      await expect
        .poll(() => transported.filter((event) => event === 'clinic_inquiry_started').length, { timeout: 10000 })
        .toBe(1)
    })
  })

  it('waits for a real inactive or hidden browser window and preserves acceptance across activation changes', async () => {
    await inBrowser(async (page) => {
      await page.evaluate('allowAnalytics(true)')
      const background = await page.context().newPage()
      await background.goto('https://background.example.test/')
      await background.bringToFront()
      await expect.poll(() => page.evaluate('browserState().focused')).toBe(false)
      await expect.poll(() => page.evaluate('browserState().visible')).toBe('hidden')
      await page
        .locator('article')
        .nth(3)
        .evaluate((element) => element.scrollIntoView())
      expect(
        await page
          .locator('article')
          .nth(3)
          .evaluate((element) => element.getBoundingClientRect().top < innerHeight),
      ).toBe(true)
      expect(await page.evaluate("impressions().filter(row => row.clinic_id === '104').length")).toBe(0)
      const cdp = await page.context().newCDPSession(page)
      const { windowId } = await cdp.send('Browser.getWindowForTarget')
      await cdp.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'minimized' } })
      await expect.poll(() => page.evaluate('browserState().visible')).toBe('hidden')
      expect(await page.evaluate("impressions().filter(row => row.clinic_id === '104').length")).toBe(0)
      await cdp.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'normal' } })
      await page.bringToFront()
      await expect.poll(() => page.evaluate('browserState().visible')).toBe('visible')
      await expect.poll(() => page.evaluate('browserState().focused')).toBe(true)
      await expect.poll(() => page.evaluate("impressions().filter(row => row.clinic_id === '104').length")).toBe(1)
      await background.bringToFront()
      await expect.poll(() => page.evaluate('browserState().focused')).toBe(false)
      await page.bringToFront()
      await expect.poll(() => page.evaluate('browserState().focused')).toBe(true)
      expect(await page.evaluate("impressions().filter(row => row.clinic_id === '104').length")).toBe(1)
    })
  })

  it('keeps rerenders and a pending URL in the same view, then counts a committed search only when visible', async () => {
    await inBrowser(async (page) => {
      await page.evaluate('allowAnalytics(true)')
      const last = page.locator('article').nth(3)
      await last.scrollIntoViewIfNeeded()
      await expect.poll(() => page.evaluate("impressions().filter(row => row.clinic_id === '104').length")).toBe(1)
      await page.evaluate("history.pushState(null, '', '?sort=name-asc'); commitResults({})")
      expect(await page.evaluate("impressions().filter(row => row.clinic_id === '104').length")).toBe(1)
      await page.evaluate('scrollTo(0, 0)')
      await page.evaluate("commitResults({sort:'name-asc'})")
      await expect.poll(() => last.evaluate((element) => element.getBoundingClientRect().top > innerHeight)).toBe(true)
      expect(await page.evaluate("impressions().filter(row => row.clinic_id === '104').length")).toBe(1)
      await last.scrollIntoViewIfNeeded()
      await expect.poll(() => page.evaluate("impressions().filter(row => row.clinic_id === '104').length")).toBe(2)
      await page.evaluate('commitResults({})')
      expect(await page.evaluate("impressions().filter(row => row.clinic_id === '104').length")).toBe(2)
    })
  })

  it('counts the same clinic on a newly opened results page only after its visible pixels appear', async () => {
    await inBrowser(async (page) => {
      await page.evaluate('allowAnalytics(true)')
      await page.locator('article').nth(3).scrollIntoViewIfNeeded()
      await expect.poll(() => page.evaluate("impressions().filter(row => row.clinic_id === '104').length")).toBe(1)
      await page.getByRole('button', { name: 'Go to next page' }).click()
      await expect.poll(() => pendingNavigation.at(-1)).toBe('/listing-comparison?page=2')
      await page.evaluate('scrollTo(0, 0)')
      await page.evaluate("commitResults({page:2}, ['201','202','203','104'])")
      await expect.poll(() => page.getByRole('heading', { name: 'Synthetic clinic 201' }).count()).toBe(1)
      expect(await page.evaluate("impressions().filter(row => row.clinic_id === '104').length")).toBe(1)
      await page.locator('article').nth(3).scrollIntoViewIfNeeded()
      await expect.poll(() => page.evaluate("impressions().filter(row => row.clinic_id === '104').length")).toBe(2)
    })
  })

  it('never replays a card no longer visible after consent, and counts any positive area without a dwell threshold', async () => {
    await inBrowser(async (page) => {
      const first = page.locator('article').nth(0)
      const last = page.locator('article').nth(3)
      await last.scrollIntoViewIfNeeded()
      expect(await page.evaluate('impressions().length')).toBe(0)
      await page.evaluate('scrollTo(0, 0)')
      await page.evaluate('allowAnalytics(true)')
      await expect.poll(() => page.evaluate("impressions().filter(row => row.clinic_id === '101').length")).toBe(1)
      expect(await page.evaluate("impressions().filter(row => row.clinic_id === '104').length")).toBe(0)
      await last.evaluate((element) => scrollTo(0, scrollY + element.getBoundingClientRect().top - innerHeight))
      expect(await page.evaluate("impressions().filter(row => row.clinic_id === '104').length")).toBe(0)
      await page.evaluate('scrollBy(0, 1)')
      await expect.poll(() => page.evaluate("impressions().filter(row => row.clinic_id === '104').length")).toBe(1)
      await page.evaluate('allowAnalytics(false)')
      await page.evaluate("commitResults({sort:'price-asc'}, ['301','302','303','304'])")
      await first.scrollIntoViewIfNeeded()
      expect(await page.evaluate("impressions().filter(row => row.clinic_id === '301').length")).toBe(0)
    })
  })

  it('does not mark an SDK-rejected impression accepted and retries only current visibility', async () => {
    await inBrowser(async (page) => {
      await page.evaluate('allowAnalytics(true)')
      await expect.poll(() => page.evaluate("impressions().filter(row => row.clinic_id === '101').length")).toBe(1)
      await page.evaluate('rejectNextImpression()')
      await page
        .locator('article')
        .nth(3)
        .evaluate((element) => scrollTo(0, scrollY + element.getBoundingClientRect().top - innerHeight + 1))
      // One scroll or observer notice may retry a rejected capture immediately.
      // Whichever notice accepts it, subsequent visibility still stays at one.
      await page.evaluate('scrollTo(0, 0)')
      await page.locator('article').nth(3).scrollIntoViewIfNeeded()
      await expect.poll(() => page.evaluate("impressions().filter(row => row.clinic_id === '104').length")).toBe(1)
    })
  })

  it('leaves unopened result-page responses uncounted until a page is opened', async () => {
    await inBrowser(async (page) => {
      await page.evaluate('allowAnalytics(true)')
      const before = await page.evaluate('impressions().length')
      // The navigation boundary loads documents without mounting their browser UI.
      // The real Next/Payload server response is separate environment evidence.
      const statuses = await page.evaluate(async () =>
        Promise.all(
          [3, 4].map(async (targetPage) => {
            const response = await fetch(`/listing-comparison?page=${targetPage}`)
            await response.text()
            return response.status
          }),
        ),
      )
      expect(statuses).toEqual([200, 200])
      expect(await page.evaluate('impressions().length')).toBe(before)
      expect(pendingNavigation).toEqual([])
    })
  })

  it('uses the visible viewport after native browser zoom instead of the larger layout viewport', async () => {
    await inBrowser(async (page) => {
      const cdp = await page.context().newCDPSession(page)
      await cdp.send('Emulation.setPageScaleFactor', { pageScaleFactor: 2 })
      await expect
        .poll(() => page.evaluate(() => visualViewport!.height < document.documentElement.clientHeight))
        .toBe(true)
      const last = page.locator('article').nth(3)
      await last.evaluate((element) =>
        scrollTo(0, scrollY + element.getBoundingClientRect().top - visualViewport!.height - 10),
      )
      expect(
        await last.evaluate((element) => element.getBoundingClientRect().top < document.documentElement.clientHeight),
      ).toBe(true)
      await page.evaluate('allowAnalytics(true)')
      await expect.poll(() => page.evaluate('browserState().sdkReady')).toBe(true)
      expect(await page.evaluate("impressions().filter(row => row.clinic_id === '104').length")).toBe(0)
      await page.evaluate('scrollBy(0, 20)')
      await expect.poll(() => page.evaluate("impressions().filter(row => row.clinic_id === '104').length")).toBe(1)
    })
  })
})
