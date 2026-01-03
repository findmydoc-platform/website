// @vitest-environment jsdom
import React from 'react'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  SeedingCardView,
  getDemoSeedPolicy,
  modeFromNodeEnv,
  type SeedRunSummary,
} from '@/components/organisms/DeveloperDashboard/Seeding/SeedingCardView'

describe('SeedingCardView', () => {
  it('enables demo seed for platform in development', () => {
    render(
      <SeedingCardView
        mode="development"
        userType="platform"
        loading={false}
        error={null}
        lastRun={null}
        onRunSeed={() => undefined}
        onRefreshStatus={() => undefined}
      />,
    )

    expect(screen.getByText('Seed Demo (Reset)')).toBeInTheDocument()
    expect(screen.queryByTitle('Disabled in production')).not.toBeInTheDocument()
    expect(screen.queryByTitle('Requires platform role')).not.toBeInTheDocument()
  })

  it('disables demo seed in production (safety critical)', () => {
    render(
      <SeedingCardView
        mode="production"
        userType="platform"
        loading={false}
        error={null}
        lastRun={null}
        onRunSeed={() => undefined}
        onRefreshStatus={() => undefined}
      />,
    )

    expect(screen.getByText('Seed Demo (Reset)')).toBeInTheDocument()
    expect(screen.getByTitle('Disabled in production')).toBeInTheDocument()
    expect(screen.getByText(/production mode: demo disabled/)).toBeInTheDocument()
  })

  it('disables demo seed for non-platform users in development', () => {
    render(
      <SeedingCardView
        mode="development"
        userType="clinic"
        loading={false}
        error={null}
        lastRun={null}
        onRunSeed={() => undefined}
        onRefreshStatus={() => undefined}
      />,
    )

    expect(screen.getByText('Seed Demo (Reset)')).toBeInTheDocument()
    expect(screen.getByTitle('Requires platform role')).toBeInTheDocument()
  })

  it('renders error text when provided', () => {
    render(
      <SeedingCardView
        mode="development"
        userType="platform"
        loading={false}
        error="Simulated error"
        lastRun={null}
        onRunSeed={() => undefined}
        onRefreshStatus={() => undefined}
      />,
    )

    expect(screen.getByText('Error: Simulated error')).toBeInTheDocument()
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

    render(
      <SeedingCardView
        mode="development"
        userType="platform"
        loading={false}
        error={null}
        lastRun={lastRun}
        onRunSeed={() => undefined}
        onRefreshStatus={() => undefined}
      />,
    )

    expect(screen.getByText(/Last Run:/)).toBeInTheDocument()
    expect(screen.getByText(/baseline/)).toBeInTheDocument()
    expect(screen.getByText(/Totals: created 3, updated 1/)).toBeInTheDocument()
    expect(screen.getByText(/Clinics: \+1 \/ ~1/)).toBeInTheDocument()
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
