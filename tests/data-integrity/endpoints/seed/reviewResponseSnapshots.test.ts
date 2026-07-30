import reviewResponses from '@/endpoints/seed/data/demo/reviewResponses.json'
import reviewResponsesInitial from '@/endpoints/seed/data/demo/reviewResponsesInitial.json'
import { describe, expect, it } from 'vitest'

describe('review response seed snapshots', () => {
  it.each([
    ['reviewResponsesInitial', reviewResponsesInitial],
    ['reviewResponses', reviewResponses],
  ] as const)('defines pendingResponse explicitly in every %s record', (_fileName, records) => {
    expect(records.length).toBeGreaterThan(0)
    for (const record of records) {
      expect(record).toHaveProperty('pendingResponse')
    }
  })
})
