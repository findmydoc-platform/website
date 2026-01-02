import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import {
  SeedingCardView,
  getDemoSeedPolicy,
  modeFromNodeEnv,
  type SeedRunSummary,
} from '@/components/organisms/DeveloperDashboard/Seeding/SeedingCardView'

describe('SeedingCardView', () => {
  it('enables demo seed for platform in development', () => {
    const markup = renderToStaticMarkup(
      React.createElement(SeedingCardView, {
        mode: 'development',
        userType: 'platform',
        loading: false,
        error: null,
        lastRun: null,
        onRunSeed: () => undefined,
        onRefreshStatus: () => undefined,
      }),
    )

    expect(markup).toContain('Seed Demo (Reset)')
    expect(markup).not.toContain('Disabled in production')
    expect(markup).not.toContain('Requires platform role')
  })

  it('disables demo seed in production (safety critical)', () => {
    const markup = renderToStaticMarkup(
      React.createElement(SeedingCardView, {
        mode: 'production',
        userType: 'platform',
        loading: false,
        error: null,
        lastRun: null,
        onRunSeed: () => undefined,
        onRefreshStatus: () => undefined,
      }),
    )

    expect(markup).toContain('Seed Demo (Reset)')
    expect(markup).toContain('Disabled in production')
    expect(markup).toContain('production mode: demo disabled')
  })

  it('disables demo seed for non-platform users in development', () => {
    const markup = renderToStaticMarkup(
      React.createElement(SeedingCardView, {
        mode: 'development',
        userType: 'clinic',
        loading: false,
        error: null,
        lastRun: null,
        onRunSeed: () => undefined,
        onRefreshStatus: () => undefined,
      }),
    )

    expect(markup).toContain('Seed Demo (Reset)')
    expect(markup).toContain('Requires platform role')
  })

  it('renders error text when provided', () => {
    const markup = renderToStaticMarkup(
      React.createElement(SeedingCardView, {
        mode: 'development',
        userType: 'platform',
        loading: false,
        error: 'Simulated error',
        lastRun: null,
        onRunSeed: () => undefined,
        onRefreshStatus: () => undefined,
      }),
    )

    expect(markup).toContain('Error: Simulated error')
  })

  it('renders lastRun summary when present', () => {
    const lastRun: SeedRunSummary = {
      type: 'baseline',
      reset: false,
      status: 'ok',
      baselineFailed: false,
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      durationMs: 2000,
      totals: { created: 3, updated: 1 },
      units: [{ name: 'Clinics', created: 1, updated: 1 }],
    }

    const markup = renderToStaticMarkup(
      React.createElement(SeedingCardView, {
        mode: 'development',
        userType: 'platform',
        loading: false,
        error: null,
        lastRun,
        onRunSeed: () => undefined,
        onRefreshStatus: () => undefined,
      }),
    )

    expect(markup).toContain('Last Run:')
    expect(markup).toContain('baseline')
    expect(markup).toContain('Totals: created 3, updated 1')
    expect(markup).toContain('Clinics: +1 / ~1')
  })
})

describe('SeedingCard helpers', () => {
  it('modeFromNodeEnv maps production/test/development', () => {
    expect(modeFromNodeEnv('production')).toBe('production')
    expect(modeFromNodeEnv('test')).toBe('test')
    expect(modeFromNodeEnv('development')).toBe('development')
    expect(modeFromNodeEnv(undefined)).toBe('development')
  })

  it('getDemoSeedPolicy prefers production lockout', () => {
    expect(getDemoSeedPolicy({ mode: 'production', userType: 'platform' })).toEqual({
      canRunDemo: false,
      disabledTitle: 'Disabled in production',
    })

    expect(getDemoSeedPolicy({ mode: 'production', userType: 'clinic' })).toEqual({
      canRunDemo: false,
      disabledTitle: 'Disabled in production',
    })
  })
})
