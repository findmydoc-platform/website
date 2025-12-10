import { describe, it, expect, vi } from 'vitest'
import type { Payload } from 'payload'

// State to simulate cleared collections
const state = { cleared: false }

vi.mock('@/endpoints/seed/seed-helpers', () => ({
  clearCollections: vi.fn(async () => {
    state.cleared = true
  }),
}))

// Mock demoSeeds to a tiny set with deterministic behavior
vi.mock('@/endpoints/seed/demo', async (orig) => {
  const original = (await orig()) as typeof import('@/endpoints/seed/demo')
  const minimalSeed = {
    name: 'mini',
    run: async () => ({ created: 1, updated: 0 }),
  }
  return {
    ...original,
    demoSeeds: [minimalSeed],
  }
})

import { runDemoSeeds } from '@/endpoints/seed/demo'

function makePayload(): unknown {
  return {
    count: async () => ({ totalDocs: state.cleared ? 0 : 5 }),
    logger: { info: () => {}, warn: () => {}, error: () => {} },
    find: async () => ({ docs: [] }),
  }
}

describe('demo reset counts', () => {
  it('provides beforeCounts and afterCounts on reset', async () => {
    const payload = makePayload() as Payload
    const outcome = await runDemoSeeds(payload, { reset: true })
    expect(outcome.beforeCounts).toBeDefined()
    expect(outcome.afterCounts).toBeDefined()
    expect(Object.keys(outcome.beforeCounts!)).toContain('reviews')
    expect(Object.keys(outcome.afterCounts!)).toContain('reviews')
  })
})
