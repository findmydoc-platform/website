import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect } from '@storybook/jest'
import { within, userEvent } from '@storybook/testing-library'
import { useLayoutEffect } from 'react'

import { SeedingCard } from '@/components/organisms/DeveloperDashboard/Seeding/SeedingCard'

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
  startedAt: '2024-01-01T12:00:00.000Z',
  finishedAt: '2024-01-01T12:00:02.000Z',
  durationMs: 2000,
  totals: { created: 3, updated: 1 },
  units: [
    { name: 'Clinics', created: 1, updated: 1 },
    { name: 'Treatments', created: 2, updated: 0 },
  ],
})

const createMockFetch = (originalFetch: typeof fetch): typeof fetch => async (input, init) => {
  const url = typeof input === 'string' ? input : input.url

  if (!url.includes('/api/seed')) {
    return originalFetch(input, init)
  }

  const method = init?.method ?? 'GET'
  const params = new URL(url, 'http://localhost').searchParams
  const type = (params.get('type') ?? 'baseline') as 'baseline' | 'demo'
  const reset = params.get('reset') === '1'
  const summary = createSeedRunSummary(type, reset)

  if (method === 'GET') {
    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify(summary), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

const SeedingCardStory = () => {
  useLayoutEffect(() => {
    const originalFetch = globalThis.fetch.bind(globalThis)
    globalThis.fetch = createMockFetch(originalFetch)

    return () => {
      globalThis.fetch = originalFetch
    }
  }, [])

  return <SeedingCard />
}

const meta: Meta<typeof SeedingCard> = {
  title: 'Organisms/SeedingCard',
  component: SeedingCard,
  tags: ['autodocs'],
}

export default meta

type Story = StoryObj<typeof SeedingCard>

export const Default: Story = {
  render: () => <SeedingCardStory />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    const seedBaseline = canvas.getByRole('button', { name: 'Seed Baseline' })
    const seedDemo = canvas.getByRole('button', { name: 'Seed Demo (Reset)' })
    const refreshStatus = canvas.getByRole('button', { name: 'Refresh Status' })

    expect(seedBaseline).toBeEnabled()
    expect(seedDemo).toBeDisabled()
    expect(refreshStatus).toBeEnabled()

    await userEvent.click(seedBaseline)
    await userEvent.click(refreshStatus)
  },
}
