// @vitest-environment jsdom
import React from 'react'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

type MockPayloadButtonProps = React.ComponentPropsWithoutRef<'button'> & {
  icon?: React.ReactNode
  tooltip?: string
}

vi.mock('@payloadcms/ui/elements/Button', () => ({
  Button: ({
    children,
    icon,
    tooltip,
    buttonStyle: _buttonStyle,
    iconStyle: _iconStyle,
    margin: _margin,
    size: _size,
    ...buttonProps
  }: MockPayloadButtonProps & {
    buttonStyle?: string
    iconStyle?: string
    margin?: boolean
    size?: string
  }) => (
    <button title={tooltip} {...buttonProps}>
      {icon}
      {children}
    </button>
  ),
}))
import {
  SeedingCardView,
  getDemoSeedPolicy,
  modeFromNodeEnv,
  modeFromRuntimeEnv,
  normalizeSeedingWidgetControls,
  type SeedRunSummary,
} from '@/components/organisms/DeveloperDashboard/Seeding/SeedingCardView'

const baseControls = { maxLines: 500, showUnits: true, wrapLines: false }

const baseProps = {
  mode: 'development' as const,
  userType: 'platform' as const,
  isPlatformUser: true,
  loading: false,
  error: null,
  lastRun: null,
  controls: baseControls,
  logLines: [{ id: '1', severity: 'INFO' as const, text: 'No seed run recorded yet.' }],
  baselineButtonLabel: 'Seed Baseline',
  demoButtonLabel: 'Seed Demo',
  onSeedBaseline: () => undefined,
  onSeedDemo: () => undefined,
  onRefreshStatus: () => undefined,
  onCopyLogs: () => undefined,
  onExportLogFile: () => undefined,
  onExportJSONFile: () => undefined,
}

describe('SeedingCardView', () => {
  it('enables demo seed for platform in development', () => {
    render(<SeedingCardView {...baseProps} />)

    expect(screen.getByText('Seed Demo')).toBeInTheDocument()
    expect(screen.getByText(/Logs \(1\)/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy logs' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Export .log' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Export .json' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Copy Logs' })).not.toBeInTheDocument()
    expect(screen.queryByText(/available to platform basic users only/)).not.toBeInTheDocument()
  })

  it('shows hint-only card for non-platform users', () => {
    render(<SeedingCardView {...baseProps} userType="clinic" isPlatformUser={false} />)

    expect(screen.getByText(/available to platform basic users only/i)).toBeInTheDocument()
    expect(screen.queryByText('Seed Baseline')).not.toBeInTheDocument()
    expect(screen.queryByText('Seed Demo')).not.toBeInTheDocument()
  })

  it('disables demo seed in production', () => {
    render(<SeedingCardView {...baseProps} mode="production" />)

    expect(screen.getByRole('button', { name: 'Seed Demo' })).toBeDisabled()
    expect(screen.getByText(/production mode: demo disabled/)).toBeInTheDocument()
  })

  it('renders error text when provided', () => {
    render(<SeedingCardView {...baseProps} error="Simulated error" />)

    expect(screen.getByText('Error: Simulated error')).toBeInTheDocument()
  })

  it('renders provided log lines with severity labels', () => {
    render(
      <SeedingCardView
        {...baseProps}
        logLines={[
          { id: 'a', severity: 'INFO', text: 'Started' },
          { id: 'b', severity: 'WARN', text: 'Warning example' },
          { id: 'c', severity: 'ERROR', text: 'Error example' },
        ]}
      />,
    )

    expect(screen.getByText('[INFO]')).toBeInTheDocument()
    expect(screen.getByText('[WARN]')).toBeInTheDocument()
    expect(screen.getByText('[ERROR]')).toBeInTheDocument()
    expect(screen.getByText('Warning example')).toBeInTheDocument()
    expect(screen.getByText('Error example')).toBeInTheDocument()
  })

  it('shows control metadata in log header', () => {
    render(
      <SeedingCardView
        {...baseProps}
        controls={{ maxLines: 120, showUnits: false, wrapLines: true }}
        logLines={[{ id: 'x', severity: 'INFO', text: 'line' }]}
      />,
    )

    expect(screen.getByText(/max lines 120/)).toBeInTheDocument()
    expect(screen.getByText(/units hidden/)).toBeInTheDocument()
    expect(screen.getByText(/wrap on/)).toBeInTheDocument()
    expect(screen.getByTestId('seeding-log-viewport')).toHaveStyle({ height: '320px' })
  })

  it('accepts lastRun payload without rendering collapsible details', () => {
    const lastRun: SeedRunSummary = {
      type: 'baseline',
      reset: false,
      status: 'ok',
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      durationMs: 2000,
      totals: { created: 3, updated: 1 },
      units: [{ name: 'Clinics', created: 1, updated: 1 }],
    }

    render(<SeedingCardView {...baseProps} lastRun={lastRun} />)

    expect(screen.getByText('Seed Baseline')).toBeInTheDocument()
    expect(screen.queryByText('Units')).not.toBeInTheDocument()
  })
})

describe('SeedingCard helpers', () => {
  it('modeFromNodeEnv maps production/test/development', () => {
    expect(modeFromNodeEnv('production')).toBe('production')
    expect(modeFromNodeEnv('test')).toBe('test')
    expect(modeFromNodeEnv('development')).toBe('development')
    expect(modeFromNodeEnv(undefined)).toBe('development')
  })

  it('modeFromRuntimeEnv resolves preview class from public runtime env', () => {
    const mode = modeFromRuntimeEnv({
      publicDeploymentEnv: undefined,
      nodeEnv: 'development',
      vercelEnv: 'preview',
    })

    expect(mode).toBe('preview')
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

  it('normalizes widget controls with defaults and boundaries', () => {
    expect(normalizeSeedingWidgetControls(null)).toEqual({ maxLines: 500, showUnits: true, wrapLines: false })

    expect(normalizeSeedingWidgetControls({ maxLines: 3, showUnits: false, wrapLines: true })).toEqual({
      maxLines: 50,
      showUnits: false,
      wrapLines: true,
    })

    expect(normalizeSeedingWidgetControls({ maxLines: 999999 })).toEqual({
      maxLines: 5000,
      showUnits: true,
      wrapLines: false,
    })
  })
})
