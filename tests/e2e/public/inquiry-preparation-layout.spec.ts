import { writeFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { setCookieConsent } from '../helpers/cookieConsent'
import { createBrowserIssueCollector, expectNoBrowserIssues } from '../helpers/browserIssues'
import { registerInquiryPreparationRuntime } from '../helpers/inquiryPreparationRuntime'
import { resolvePlaywrightBaseURL } from '../../../scripts/test-env.mjs'

const origin = resolvePlaywrightBaseURL()
const artifacts = 'output/playwright/inquiry-preparation-layout'
const runtime = registerInquiryPreparationRuntime({ origin, artifacts, clinicCount: 3 })

test('keeps the inquiry return stable for single and multiple outcomes on mobile and desktop', async ({ browser }) => {
  test.setTimeout(240_000)
  for (const width of [375, 1024]) {
    for (const count of [1, 3]) {
      for (const fails of [false, true]) {
        runtime.resetIdentities()
        const context = await browser.newContext({
          baseURL: origin,
          viewport: { width, height: width === 375 ? 640 : 768 },
        })
        await setCookieConsent(context)
        const page = await context.newPage()
        const issues = createBrowserIssueCollector(page, { ignoredConsoleErrors: [/Failed to load resource.*40[034]/] })
        const email = `layout-${width}-${count}-${fails}@example.test`
        const destinations = runtime.clinics.slice(0, count)
        for (const [index, clinic] of destinations.entries()) {
          const prepared = await context.request.post('/api/patient/inquiry-preparations', {
            headers: { Origin: origin },
            data: {
              clinicId: String(clinic.id),
              doctorId: String(clinic.doctorId),
              idempotencyKey: `layout-${email}-${index}`,
              firstName: 'Layout',
              lastName: 'Patient',
              email,
              phoneNumber: '+493000000080',
              message: 'Synthetic layout measurement inquiry.',
              consent: true,
              accountAuthorization: true,
            },
          })
          expect(prepared.status()).toBe(201)
        }
        const registered = await context.request.post('/api/auth/register/patient', {
          headers: { Origin: origin },
          data: { email, password: 'SyntheticPatient123', firstName: 'Layout', lastName: 'Patient' }, // pragma: allowlist secret
        })
        expect(registered.status()).toBe(200)
        await runtime.fixtureCommand('worker')
        const link = runtime.confirmationLinks.get(email)
        expect(link).toBeTruthy()
        const failingClinic = fails ? destinations.at(-1)! : undefined
        if (failingClinic) await runtime.fixtureCommand('pending', failingClinic.id)
        // Record layout entries in the real browser, with the request owners left intact.
        await page.addInitScript(() => {
          const shifts: Array<{ value: number; time: number; recentInput: boolean; sources: string[] }> = []
          Object.assign(window, { inquiryLayoutShifts: shifts })
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              const shift = entry as PerformanceEntry & {
                value: number
                hadRecentInput: boolean
                sources: Array<{ node?: Node }>
              }
              shifts.push({
                value: shift.value,
                time: shift.startTime,
                recentInput: shift.hadRecentInput,
                sources: shift.sources.map(({ node }) =>
                  node instanceof Element
                    ? `${node.closest('[aria-label="Patient inquiry list"]') ? 'inquiry:' : ''}${node.tagName}:${node.getAttribute('aria-label') ?? node.textContent?.trim().slice(0, 90) ?? ''}`
                    : '',
                ),
              })
            }
          }).observe({ type: 'layout-shift', buffered: true })
        })
        let posts = 0
        await page.route('**/api/patient/inquiry-preparations**', async (route) => {
          await new Promise((resolve) => setTimeout(resolve, route.request().method() === 'GET' ? 800 : 1100))
          await route.continue()
          if (route.request().method() === 'POST') posts++
        })
        await page.goto(link!)
        await page.getByRole('button', { name: 'Confirm email', exact: true }).click()
        await expect(page).toHaveURL(/\/patient\/inquiries$/)
        const heading = page.getByRole('heading', { name: 'My inquiries', exact: true })
        await expect(heading).toBeVisible()
        const before = (await heading.boundingBox())!.y + (await page.evaluate(() => window.scrollY))
        await expect.poll(() => posts).toBe(count)
        if (failingClinic) await expect(page.getByRole('button', { name: 'Try again', exact: true })).toBeVisible()
        else await expect(page.getByText(destinations[0]!.name, { exact: true }).last()).toBeVisible()
        await page.waitForTimeout(1800)
        const after = (await heading.boundingBox())!.y + (await page.evaluate(() => window.scrollY))
        const shifts = await page.evaluate(
          () =>
            Reflect.get(window, 'inquiryLayoutShifts') as Array<{
              value: number
              time: number
              recentInput: boolean
              sources: string[]
            }>,
        )
        function cls(entries: typeof shifts) {
          let maximum = 0,
            score = 0,
            first = 0,
            previous = 0
          for (const entry of entries.filter((entry) => !entry.recentInput)) {
            if (score === 0 || entry.time - previous > 1000 || entry.time - first > 5000) {
              score = 0
              first = entry.time
            }
            score += entry.value
            maximum = Math.max(maximum, score)
            previous = entry.time
          }
          return maximum
        }
        const inquiryShifts = shifts.filter((entry) =>
          entry.sources.some(
            (source) => source.startsWith('inquiry:') || source.includes('Patient accountMy inquiries'),
          ),
        )
        const measured = {
          width,
          height: width === 375 ? 640 : 768,
          count,
          fails,
          headingBefore: before,
          headingAfter: after,
          inquiryCls: cls(inquiryShifts),
          cls: cls(shifts),
          totalShiftValue: shifts.filter((entry) => !entry.recentInput).reduce((sum, entry) => sum + entry.value, 0),
          shifts,
        }
        const name = `${count}-${width}-${fails ? 'mixed' : 'success'}`
        writeFileSync(`${artifacts}/${name}.json`, JSON.stringify(measured, null, 2))
        await page.screenshot({ path: `${artifacts}/${name}.png`, fullPage: true })
        expect.soft(measured.inquiryCls, JSON.stringify(measured)).toBeLessThan(0.01)
        expect.soft(after, JSON.stringify(measured)).toBe(before)
        await expectNoBrowserIssues(issues)
        if (failingClinic) await runtime.fixtureCommand('approved', failingClinic.id)
        await context.close()
      }
    }
  }
})
