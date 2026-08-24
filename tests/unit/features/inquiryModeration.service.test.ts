import type { PayloadRequest } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import { readInquiryModerationState } from '@/features/inquiryModeration/service'

describe('inquiry moderation service pagination', () => {
  it('includes an active measure beyond the first 100 cases', async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({
      appealOutcome: 'overturned',
      decisionOutcome: 'conversation-restricted',
      id: `inactive-${index}`,
      measureEndedAt: '2026-08-24T10:00:00.000Z',
    }))
    const activeCase = {
      affectedActorKind: 'patient',
      affectedPatient: 'patient-1',
      appealOutcome: null,
      decisionCategory: 'privacy-concern',
      decisionOutcome: 'conversation-restricted',
      id: 'active-101',
      measureEndedAt: null,
    }
    const pages: number[] = []
    const find = vi.fn(async (options: { page?: number; where?: unknown }) => {
      const identityQuery = JSON.stringify(options.where).includes('identity-messaging-suspended')
      if (identityQuery) return { docs: [], hasNextPage: false, nextPage: null }
      const page = options.page ?? 1
      pages.push(page)
      return page === 1
        ? { docs: firstPage, hasNextPage: true, nextPage: 2 }
        : { docs: [activeCase], hasNextPage: false, nextPage: null }
    })
    const req = { payload: { find } } as unknown as PayloadRequest

    const state = await readInquiryModerationState(req, 'inquiry-1', { id: 'patient-1', kind: 'patient' })

    expect(pages).toEqual([1, 2])
    expect(state.moderation.conversation).toMatchObject({
      isCurrentActorAffected: true,
      state: 'restricted',
    })
  })
})
