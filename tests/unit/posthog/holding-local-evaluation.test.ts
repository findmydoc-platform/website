import { afterAll, describe, expect, it, vi } from 'vitest'
import { PostHog } from 'posthog-node'
import { NextRequest } from 'next/server'

const state = vi.hoisted(() => ({ client: null as import('posthog-node').PostHog | null }))
vi.mock('@/posthog/server', () => ({
  getPostHogFeatureFlagServer: () => state.client,
  isPostHogLocalEvaluationConfigured: () => true,
  schedulePostHogFeatureFlagServerIdleShutdown: () => undefined,
}))

vi.mock('@/utilities/getGlobals', () => ({
  getGlobal: async () => ({
    enabled: true,
    consentVersion: 3,
    optionalCategorySettings: {
      analytics: { enabled: true, label: 'Analytics', tools: ['posthog'] },
      functional: { enabled: true, label: 'Functional', tools: [] },
      marketing: { enabled: true, label: 'Marketing', tools: [] },
    },
  }),
}))

import { proxy } from '@/proxy'
import {
  createPostHogHoldingEvaluationContext,
  evaluatePostHogFlags,
  resolvePostHogHoldingFlagActor,
} from '@/posthog/api'

describe('Holding local PostHog rules', () => {
  afterAll(async () => {
    await state.client?.shutdown()
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
    const discovery = await proxy(
      new NextRequest('https://findmydoc.eu/llms.txt', { headers: browser('selected-browser').headers }),
    )
    expect(discovery.status).toBe(404)
    expect([selected, other, withdrawn, missing].map((response) => response.headers.get('cache-control'))).toEqual([
      'private, no-store',
      'private, no-store',
      'private, no-store',
      'private, no-store',
    ])
  })
})
