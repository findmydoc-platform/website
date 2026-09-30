/**
 * Test for Platform Staff Access Function
 *
 * This test verifies our helper utilities work correctly
 * by testing the isPlatformStaff function.
 * Follows existing project patterns from userProfileManagement.test.ts
 */

import { describe, it, beforeEach, afterEach, vi } from 'vitest'
import { createAccessArgs, expectAccess, clearAllMocks } from '../helpers/testHelpers'
import { mockUsers } from '../helpers/mockUsers'
import { isPlatformStaff, isPlatformStaffOrSelf } from '@/access/isPlatformStaff'
import { canRunPayloadJobs } from '@/access/payloadJobs'

describe('isPlatformStaff', () => {
  // Follow existing pattern from userProfileManagement.test.ts
  beforeEach(() => {
    clearAllMocks()
  })

  it('returns true for platform staff', () => {
    const result = isPlatformStaff(createAccessArgs(mockUsers.platform()))
    expectAccess.full(result)
  })

  it('returns false for clinic staff', () => {
    const result = isPlatformStaff(createAccessArgs(mockUsers.clinic()))
    expectAccess.none(result)
  })

  it('returns false for patient', () => {
    const result = isPlatformStaff(createAccessArgs(mockUsers.patient()))
    expectAccess.none(result)
  })

  it('returns false for anonymous user', () => {
    const result = isPlatformStaff(createAccessArgs(mockUsers.anonymous()))
    expectAccess.none(result)
  })

  it('returns false for null user', () => {
    const result = isPlatformStaff(createAccessArgs(null))
    expectAccess.none(result)
  })

  it('allows platform staff to access any user in self-or-admin mode', () => {
    const result = isPlatformStaffOrSelf(createAccessArgs(mockUsers.platform(), { extra: { id: 99 } }))
    expectAccess.full(result)
  })

  it('denies clinic staff access to platform principals', () => {
    const result = isPlatformStaffOrSelf(createAccessArgs(mockUsers.clinic(42), { extra: { id: 99 } }))
    expectAccess.none(result)
  })

  it('denies anonymous access', () => {
    const result = isPlatformStaffOrSelf(createAccessArgs(mockUsers.anonymous(), { extra: { id: 99 } }))
    expectAccess.none(result)
  })
})

describe('canRunPayloadJobs', () => {
  beforeEach(() => {
    clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('allows platform staff to run Payload jobs', () => {
    const result = canRunPayloadJobs(createAccessArgs(mockUsers.platform()))
    expectAccess.full(result)
  })

  it('blocks clinic staff from running Payload jobs', () => {
    const result = canRunPayloadJobs(createAccessArgs(mockUsers.clinic()))
    expectAccess.none(result)
  })

  it('blocks patient users from running Payload jobs', () => {
    const result = canRunPayloadJobs(createAccessArgs(mockUsers.patient()))
    expectAccess.none(result)
  })

  it('blocks anonymous users from running Payload jobs', () => {
    const result = canRunPayloadJobs(createAccessArgs(mockUsers.anonymous()))
    expectAccess.none(result)
  })

  it('allows the Vercel Cron bearer secret to run Payload jobs', () => {
    vi.stubEnv('CRON_SECRET', 'scheduled-posts-test-secret')
    const args = createAccessArgs(mockUsers.anonymous(), {
      reqOverrides: { headers: new Headers({ authorization: 'Bearer scheduled-posts-test-secret' }) },
    })

    expectAccess.full(canRunPayloadJobs(args))
  })

  it.each([{ allQueues: 'true' }, { queue: 'seed:run-1' }, { limit: '100' }])(
    'rejects Cron bearer access with job runner options %j',
    (query) => {
      vi.stubEnv('CRON_SECRET', 'scheduled-posts-test-secret')
      const args = createAccessArgs(mockUsers.anonymous(), {
        reqOverrides: {
          headers: new Headers({ authorization: 'Bearer scheduled-posts-test-secret' }),
          query,
        },
      })

      expectAccess.none(canRunPayloadJobs(args))
    },
  )

  it('keeps job runner options available to platform staff', () => {
    const args = createAccessArgs(mockUsers.platform(), {
      reqOverrides: { query: { allQueues: 'true' } },
    })

    expectAccess.full(canRunPayloadJobs(args))
  })

  it('rejects a missing or incorrect Cron secret', () => {
    const args = createAccessArgs(mockUsers.anonymous(), {
      reqOverrides: { headers: new Headers({ authorization: 'Bearer scheduled-posts-test-secret' }) },
    })

    vi.stubEnv('CRON_SECRET', '')
    expectAccess.none(canRunPayloadJobs(args))

    vi.stubEnv('CRON_SECRET', '   ')
    expectAccess.none(canRunPayloadJobs(args))

    vi.stubEnv('CRON_SECRET', 'another-secret')
    expectAccess.none(canRunPayloadJobs(args))

    vi.stubEnv('CRON_SECRET', 'scheduled-posts-test-secret')
    expectAccess.none(canRunPayloadJobs(createAccessArgs(mockUsers.anonymous())))
  })
})
