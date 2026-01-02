import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect } from '@storybook/jest'
import { within, userEvent, waitFor } from '@storybook/testing-library'

import { SeedingCard } from '@/components/organisms/DeveloperDashboard/Seeding/SeedingCard'
import { MockAuthProvider } from '../utils/MockAuthProvider'
import { createMockFetchDecorator } from '../utils/MockFetchDecorator'

type SeedRunSummary = {
  type: 'baseline' | 'demo'
  reset?: boolean
  status: 'ok' | 'partial' | 'failed'
  baselineFailed: boolean
  startedAt: string
  finishedAt: string
  durationMs: number
  totals: { created: number; updated: number }
  units: { name: string; created: number; updated: number }[]
  partialFailures?: { name: string; error: string }[]
  beforeCounts?: Record<string, number>
  afterCounts?: Record<string, number>
}

const createSeedRunSummary = (type: 'baseline' | 'demo', reset: boolean): SeedRunSummary => ({
  type,
  reset,
  status: 'ok',
  baselineFailed: false,
  startedAt: new Date().toISOString(),
  finishedAt: new Date().toISOString(),
  durationMs: 2000,
  totals: { created: 3, updated: 1 },
  units: [
    { name: 'Clinics', created: 1, updated: 1 },
    { name: 'Treatments', created: 2, updated: 0 },
  ],
})

const createMockFetch =
  (opts: { behavior?: 'success' | 'error'; delay?: number } = {}) =>
  (originalFetch: typeof fetch): typeof fetch =>
  async (input, init) => {
    const url = typeof input === 'string' ? input : input.url

    if (!url.includes('/api/seed')) {
      return originalFetch(input, init)
    }

    if (opts.delay) {
      await new Promise((resolve) => setTimeout(resolve, opts.delay))
    }

    if (opts.behavior === 'error') {
      return new Response(JSON.stringify({ message: 'Simulated API Error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const method = init?.method ?? 'GET'
    const params = new URL(url, 'http://localhost').searchParams
    const type = (params.get('type') ?? 'baseline') as 'baseline' | 'demo'
    const reset = params.get('reset') === '1'
    const summary = createSeedRunSummary(type, reset)

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

const meta: Meta<typeof SeedingCard> = {
  title: 'Organisms/SeedingCard',
  component: SeedingCard,
  tags: ['autodocs'],
  decorators: [
    createMockFetchDecorator(createMockFetch()),
    (Story) => (
      <MockAuthProvider user={{ userType: 'platform', email: 'admin@example.com' }}>
        <Story />
      </MockAuthProvider>
    ),
  ],
}

export default meta

type Story = StoryObj<typeof SeedingCard>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    const seedBaseline = canvas.getByRole('button', { name: 'Seed Baseline' })
    const seedDemo = canvas.getByRole('button', { name: 'Seed Demo (Reset)' })
    const refreshStatus = canvas.getByRole('button', { name: 'Refresh Status' })

    expect(seedBaseline).toBeEnabled()
    expect(seedDemo).toBeEnabled()
    expect(refreshStatus).toBeEnabled()

    await userEvent.click(seedBaseline)

    await waitFor(() => {
      expect(canvas.getByText(/Last Run:/)).toBeInTheDocument()
      expect(canvas.getByText(/baseline/)).toBeInTheDocument()
    })
  },
}

export const ClinicUser: Story = {
  decorators: [
    (Story) => (
      <MockAuthProvider user={{ userType: 'clinic', email: 'clinic@example.com' }}>
        <Story />
      </MockAuthProvider>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    expect(canvas.getByText(/Role: clinic/)).toBeInTheDocument()
    const seedDemo = canvas.getByRole('button', { name: 'Seed Demo (Reset)' })
    expect(seedDemo).toBeDisabled()
    expect(seedDemo).toHaveAttribute('title', 'Requires platform role')
  },
}

export const ProductionMode: Story = {
  decorators: [
    (Story) => {
      const originalEnv = process.env.NODE_ENV
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: 'production',
        configurable: true,
      })

      return (
        <>
          <Story />
          {(() => {
            Object.defineProperty(process.env, 'NODE_ENV', {
              value: originalEnv,
              configurable: true,
            })
            return null
          })()}
        </>
      )
    },
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const seedDemo = canvas.getByRole('button', { name: 'Seed Demo (Reset)' })
    expect(seedDemo).toBeDisabled()
  },
}

export const LoadingState: Story = {
  decorators: [createMockFetchDecorator(createMockFetch({ delay: 1000 }))],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const seedBaseline = canvas.getByRole('button', { name: 'Seed Baseline' })

    await userEvent.click(seedBaseline)

    expect(seedBaseline).toBeDisabled()
    expect(canvas.getByRole('button', { name: 'Seed Demo (Reset)' })).toBeDisabled()
    expect(canvas.getByRole('button', { name: 'Refresh Status' })).toBeDisabled()
  },
}

export const ErrorState: Story = {
  decorators: [createMockFetchDecorator(createMockFetch({ behavior: 'error' }))],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const seedBaseline = canvas.getByRole('button', { name: 'Seed Baseline' })

    await userEvent.click(seedBaseline)

    await waitFor(() => {
      expect(canvas.getByText(/Error: Simulated API Error/)).toBeInTheDocument()
    })
  },
}

export const SuccessWithResults: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const refreshStatus = canvas.getByRole('button', { name: 'Refresh Status' })

    await userEvent.click(refreshStatus)

    await waitFor(() => {
      expect(canvas.getByText(/Last Run:/)).toBeInTheDocument()
      expect(canvas.getByText(/Totals: created 3, updated 1/)).toBeInTheDocument()
      expect(canvas.getByText(/Clinics: \+1 \/ ~1/)).toBeInTheDocument()
    })
  },
}
