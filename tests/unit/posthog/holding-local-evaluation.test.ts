import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PostHog } from 'posthog-node'
import { NextRequest } from 'next/server'
import type { CookieConsent } from '@/payload-types'

const state = vi.hoisted(() => ({ client: null as import('posthog-node').PostHog | null }))
vi.mock('@supabase/ssr', () => ({
  createServerClient: (
    _url: string,
    _key: string,
    options: { cookies: { getAll: () => { name: string; value: string }[] } },
  ) => {
    if (options.cookies.getAll().some((cookie) => cookie.name === 'test-session' && cookie.value === 'client-outage')) {
      throw new Error('authentication client unavailable')
    }
    return {
      auth: {
        getUser: async () => {
          const session = options.cookies.getAll().find((cookie) => cookie.name === 'test-session')?.value
          if (session === 'outage') throw new Error('authentication unavailable')
          const user =
            session === 'selected-user'
              ? { id: 'selected-user', app_metadata: { user_type: 'patient' } }
              : session === 'clinic-user'
                ? { id: 'clinic-user', app_metadata: { user_type: 'clinic' } }
                : session === 'other-user'
                  ? { id: 'other-user', app_metadata: { user_type: 'patient' }, user_metadata: { user_type: 'clinic' } }
                  : null
          return { data: { user }, error: null }
        },
      },
    }
  },
}))
vi.mock('@/posthog/server', () => ({
  getPostHogFeatureFlagServer: () => state.client,
  isPostHogLocalEvaluationConfigured: () => true,
  schedulePostHogFeatureFlagServerIdleShutdown: () => undefined,
}))

// Keep concurrent dynamic CMS imports on the same mocked module exports.
vi.mock('@/utilities/getGlobals', { spy: true })

import { proxy } from '@/proxy'
import { PUBLIC_DISCOVERY_SURFACE_PATHS } from '@/features/publicDiscovery/site'
import { PUBLIC_SITE_MODE_REQUEST_HEADER } from '@/features/temporaryLandingMode'
import { SEARCH_ROBOTS_HEADER, SEARCH_ROBOTS_HEADER_VALUE } from '@/features/searchIndexing'
import { resolvePublicDiscoveryAccessForRequest } from '@/features/publicDiscovery/access'
import { getGlobal } from '@/utilities/getGlobals'
import {
  createPostHogHoldingEvaluationContext,
  evaluatePostHogFlags,
  resolvePostHogHoldingFlagActor,
} from '@/posthog/api'

describe('Holding local PostHog rules', () => {
  beforeEach(() => {
    vi.mocked(getGlobal).mockResolvedValue({
      id: 1,
      enabled: true,
      consentVersion: 3,
      bannerTitle: 'Cookies',
      bannerDescription: 'Choose optional cookies.',
      acceptLabel: 'Accept',
      rejectLabel: 'Reject',
      customizeLabel: 'Customize',
      cancelLabel: 'Cancel',
      saveLabel: 'Save',
      reopenLabel: 'Cookie settings',
      privacyPolicyPage: 1,
      privacyPolicyLabel: 'Privacy policy',
      settingsTitle: 'Cookie settings',
      settingsDescription: 'Choose optional categories.',
      essentialLabel: 'Essential',
      essentialDescription: 'Required cookies.',
      optionalCategorySettings: {
        analytics: { enabled: true, label: 'Analytics', tools: ['posthog'] },
        functional: { enabled: true, label: 'Functional', tools: [] },
        marketing: { enabled: true, label: 'Marketing', tools: [] },
      },
    } satisfies CookieConsent)
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-key')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  afterAll(async () => {
    await state.client?.shutdown()
  })

  it('targets the trusted runtime independently of host without changing the host default', async () => {
    state.client = new PostHog('phc_test', {
      enableLocalEvaluation: true,
      flagDefinitionCacheProvider: {
        getFlagDefinitions: () => ({
          flags: [
            {
              id: 2,
              name: 'Holding production host',
              key: 'temporary-landing-mode',
              active: true,
              deleted: false,
              rollout_percentage: null,
              ensure_experience_continuity: false,
              experiment_set: [],
              filters: {
                groups: [
                  {
                    properties: [
                      { key: 'feature_flag_site_host', value: 'findmydoc.eu', operator: 'exact', type: 'person' },
                      { key: 'feature_flag_environment', value: 'production', operator: 'exact', type: 'person' },
                    ],
                    rollout_percentage: 100,
                  },
                ],
              },
            },
          ],
          groupTypeMapping: {},
          cohorts: {},
        }),
        shouldFetchFlagDefinitions: () => false,
        onFlagDefinitionsReceived: () => undefined,
        shutdown: () => undefined,
      },
    })
    try {
      vi.stubEnv('VERCEL_ENV', '')
      for (const [environment, status] of [
        ['preview', 200],
        ['production', 404],
        ['development', 200],
        ['test', 200],
      ] as const) {
        vi.stubEnv('DEPLOYMENT_ENVIRONMENT', environment)
        const context = createPostHogHoldingEvaluationContext({
          url: new URL('https://findmydoc.eu'),
          env: { DEPLOYMENT_ENVIRONMENT: environment },
        })
        const flags = await evaluatePostHogFlags(resolvePostHogHoldingFlagActor(context), ['temporary-landing-mode'], {
          context,
        })
        expect(flags.getEvaluation('temporary-landing-mode'), environment).toEqual({
          status: 'evaluated',
          value: environment === 'production',
        })
        const response = await proxy(new NextRequest('https://findmydoc.eu/clinics'))
        expect(response.status, environment).toBe(status)
      }
      await expect(
        resolvePublicDiscoveryAccessForRequest(new Request('https://findmydoc.eu/llms.txt'), {
          VERCEL_ENV: 'production',
        }),
      ).resolves.toEqual({ allowed: true, temporaryLandingMode: true })
      await expect(
        resolvePublicDiscoveryAccessForRequest(new Request('https://findmydoc.eu/llms.txt'), {
          NODE_ENV: 'development',
        }),
      ).resolves.toEqual({ allowed: true })
      vi.stubEnv('DEPLOYMENT_ENVIRONMENT', 'production')
      expect((await proxy(new NextRequest('https://another.example/clinics'))).status).toBe(200)
      vi.stubEnv('VERCEL_ENV', 'preview')
      expect((await proxy(new NextRequest('https://findmydoc.eu/clinics'))).status).toBe(200)
    } finally {
      await state.client.shutdown()
      state.client = null
    }
  })

  it('excludes a selected browser from a host Holding rule while retaining host bucketing', async () => {
    state.client = new PostHog('phc_test', {
      enableLocalEvaluation: true,
      flagDefinitionCacheProvider: {
        getFlagDefinitions: () => ({
          flags: [
            {
              id: 1,
              name: 'Holding',
              key: 'temporary-landing-mode',
              active: true,
              deleted: false,
              rollout_percentage: null,
              ensure_experience_continuity: false,
              experiment_set: [],
              filters: {
                groups: [
                  {
                    properties: [
                      { key: 'feature_flag_site_host', value: 'findmydoc.eu', operator: 'exact', type: 'person' },
                      {
                        key: 'feature_flag_browser_id',
                        value: ['selected-browser'],
                        operator: 'is_not',
                        type: 'person',
                      },
                      { key: 'feature_flag_user_id', value: ['selected-user'], operator: 'is_not', type: 'person' },
                      { key: 'feature_flag_user_type', value: ['clinic'], operator: 'is_not', type: 'person' },
                    ],
                    rollout_percentage: 100,
                  },
                ],
              },
            },
          ],
          groupTypeMapping: {},
          cohorts: {},
        }),
        shouldFetchFlagDefinitions: () => false,
        onFlagDefinitionsReceived: () => undefined,
        shutdown: () => undefined,
      },
    })
    const context = createPostHogHoldingEvaluationContext({ url: new URL('https://findmydoc.eu') })
    const actor = resolvePostHogHoldingFlagActor(context)
    const evaluate = async (browserId: string) =>
      (
        await evaluatePostHogFlags(actor, ['temporary-landing-mode'], {
          context: { ...context, feature_flag_browser_id: browserId },
        })
      ).getEvaluation('temporary-landing-mode')
    expect(await evaluate('selected-browser')).toEqual({ status: 'evaluated', value: false })
    expect(await evaluate('another-browser')).toEqual({ status: 'evaluated', value: true })
    expect(await evaluate('')).toEqual({ status: 'evaluated', value: true })

    const browser = (id?: string, consent = true) =>
      new NextRequest('https://findmydoc.eu/clinics', {
        headers: {
          cookie: `${consent ? `findmydoc_cookie_consent=${encodeURIComponent(JSON.stringify({ choice: 'accepted', categories: { analytics: true, functional: false, marketing: false }, version: 3, decidedAt: '2026-01-01' }))}; ` : ''}${id ? `ph_phc_test_posthog=${encodeURIComponent(JSON.stringify({ distinct_id: id }))}` : ''}`,
        },
      })
    const [selected, other, withdrawn, missing] = await Promise.all([
      proxy(browser('selected-browser')),
      proxy(browser('another-browser')),
      proxy(browser('selected-browser', false)),
      proxy(browser()),
    ])
    expect([selected.status, other.status, withdrawn.status, missing.status]).toEqual([200, 404, 404, 404])
    const discoveryStatuses: Record<string, number> = {
      '/robots.txt': 200,
      '/sitemap.xml': 404,
      '/pages-sitemap.xml': 200,
      '/posts-sitemap.xml': 200,
      '/llms.txt': 200,
      '/.well-known/llms.txt': 200,
    }
    for (const path of PUBLIC_DISCOVERY_SURFACE_PATHS) {
      const responses = await Promise.all(
        ['selected-browser', 'another-browser'].map((id) =>
          proxy(new NextRequest(`https://findmydoc.eu${path}`, { headers: browser(id).headers })),
        ),
      )
      for (const response of responses) {
        expect(response.status, path).toBe(discoveryStatuses[path])
        expect(response.headers.get(`x-middleware-request-${PUBLIC_SITE_MODE_REQUEST_HEADER}`), path).toBe(
          discoveryStatuses[path] === 200 ? 'holding' : null,
        )
        expect(response.headers.get(SEARCH_ROBOTS_HEADER), path).toBe(
          discoveryStatuses[path] === 200 ? null : SEARCH_ROBOTS_HEADER_VALUE,
        )
        expect(response.headers.get('cache-control'), path).toBeNull()
      }
    }
    expect([selected, other, withdrawn, missing].map((response) => response.headers.get('cache-control'))).toEqual([
      'private, no-store',
      'private, no-store',
      'private, no-store',
      'private, no-store',
    ])

    const signedIn = (session: string, id?: string, consent = true) => {
      const request = browser(id, consent)
      request.cookies.set('test-session', session)
      return request
    }
    const responses = await Promise.all([
      proxy(signedIn('selected-user')),
      proxy(signedIn('clinic-user')),
      proxy(signedIn('outage', 'selected-browser')),
      proxy(signedIn('outage')),
      proxy(signedIn('client-outage')),
      proxy(signedIn('selected-user', undefined, false)),
      proxy(signedIn('other-user', 'selected-browser')),
      proxy(signedIn('other-user')),
      proxy(browser()),
      proxy(browser('new-browser')),
    ])
    expect(responses.map((response) => response.status)).toEqual([200, 200, 200, 404, 404, 404, 200, 404, 404, 404])
    vi.unstubAllEnvs()
  })
})
