import { describe, expect, it } from 'vitest'
import type { PayloadRequest, RequestContext, SanitizedCollectionConfig } from 'payload'

import { enforcePlatformStaffEmailDomainHook } from '@/collections/BasicUsers/hooks/enforcePlatformStaffEmailDomain'
import { PLATFORM_STAFF_EMAIL_REQUIREMENT_MESSAGE } from '@/auth/utilities/platformStaffEmailPolicy'
import type { BasicUser } from '@/payload-types'

const mockCollection = { slug: 'basicUsers' } as unknown as SanitizedCollectionConfig
const emptyContext = {} as unknown as RequestContext
const req = {} as PayloadRequest

type HookArgs = Parameters<typeof enforcePlatformStaffEmailDomainHook>[0]

const runHook = (args: Pick<HookArgs, 'data' | 'operation'> & Partial<HookArgs>) => {
  return enforcePlatformStaffEmailDomainHook({
    collection: mockCollection,
    context: emptyContext,
    originalDoc: undefined,
    req,
    ...args,
  } as HookArgs)
}

describe('enforcePlatformStaffEmailDomainHook', () => {
  it('allows platform staff with findmydoc.eu emails', () => {
    const data: Partial<BasicUser> = {
      email: 'Admin@Findmydoc.EU',
      userType: 'platform',
    }

    expect(runHook({ data, operation: 'create' })).toBe(data)
  })

  it('blocks platform staff with external emails', () => {
    expect(() =>
      runHook({
        data: {
          email: 'admin@example.com',
          userType: 'platform',
        },
        operation: 'create',
      }),
    ).toThrow(PLATFORM_STAFF_EMAIL_REQUIREMENT_MESSAGE)
  })

  it('blocks updates that turn external clinic users into platform users', () => {
    expect(() =>
      runHook({
        data: {
          userType: 'platform',
        },
        operation: 'update',
        originalDoc: {
          email: 'clinic@example.com',
          userType: 'clinic',
        } as BasicUser,
      }),
    ).toThrow(PLATFORM_STAFF_EMAIL_REQUIREMENT_MESSAGE)
  })

  it('allows updating existing platform users to findmydoc.eu emails', () => {
    const data: Partial<BasicUser> = {
      email: 'operator@findmydoc.eu',
    }

    expect(
      runHook({
        data,
        operation: 'update',
        originalDoc: {
          email: 'legacy@example.com',
          userType: 'platform',
        } as BasicUser,
      }),
    ).toBe(data)
  })

  it('allows clinic staff with external emails', () => {
    const data: Partial<BasicUser> = {
      email: 'clinic@example.com',
      userType: 'clinic',
    }

    expect(runHook({ data, operation: 'create' })).toBe(data)
  })
})
