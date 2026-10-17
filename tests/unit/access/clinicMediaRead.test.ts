import { beforeEach, describe, expect, it, vi } from 'vitest'

import { readClinicPrincipalAccess } from '@/auth/utilities/clinicPrincipalAccess'
import { clinicMediaReadAccess } from '@/access/clinicMediaRead'
import { platformOrOwnClinicResource } from '@/access/scopeFilters'
import { createAccessArgs, type MockRequest } from '../helpers/testHelpers'
import { mockUsers } from '../helpers/mockUsers'

vi.mock('@/access/scopeFilters', () => ({
  platformOrOwnClinicResource: vi.fn(),
}))

vi.mock('@/auth/utilities/clinicPrincipalAccess', () => ({ readClinicPrincipalAccess: vi.fn() }))

const mockPlatformOrOwnClinicResource = vi.mocked(platformOrOwnClinicResource)

type ClinicMediaReadArgs = {
  req: MockRequest
  isReadingStaticFile?: boolean
}

describe('clinicMediaReadAccess', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('returns scoped access unchanged for document reads', async () => {
    const scopedFilter = { clinic: { in: [123, 456] } }
    vi.mocked(readClinicPrincipalAccess).mockResolvedValueOnce({ clinics: [{ id: 123 }, { id: 456 }] } as never)

    const result = await clinicMediaReadAccess(createAccessArgs<ClinicMediaReadArgs>(mockUsers.clinic()))

    expect(result).toEqual(scopedFilter)
  })

  it('returns scoped access unchanged for static file reads', async () => {
    const scopedFilter = { clinic: { equals: 777 } }
    vi.mocked(readClinicPrincipalAccess).mockResolvedValueOnce({ clinics: [{ id: 777 }] } as never)

    const result = await clinicMediaReadAccess(
      createAccessArgs<ClinicMediaReadArgs>(mockUsers.clinic(), {
        extra: { isReadingStaticFile: true },
      }),
    )

    expect(result).toEqual(scopedFilter)
  })

  it('allows patients to read static files only from approved clinics', async () => {
    mockPlatformOrOwnClinicResource.mockResolvedValueOnce(false)

    const result = await clinicMediaReadAccess(
      createAccessArgs<ClinicMediaReadArgs>(mockUsers.patient(), {
        extra: { isReadingStaticFile: true },
      }),
    )

    expect(result).toEqual({
      and: [{ status: { equals: 'published' } }, { 'clinic.status': { equals: 'approved' } }],
    })
  })

  it('allows anonymous users to read static files only from approved clinics', async () => {
    mockPlatformOrOwnClinicResource.mockResolvedValueOnce(false)

    const result = await clinicMediaReadAccess(
      createAccessArgs<ClinicMediaReadArgs>(mockUsers.anonymous(), {
        extra: { isReadingStaticFile: true },
      }),
    )

    expect(result).toEqual({
      and: [{ status: { equals: 'published' } }, { 'clinic.status': { equals: 'approved' } }],
    })
  })

  it('denies static file reads for non-patient users when scoped access is denied', async () => {
    mockPlatformOrOwnClinicResource.mockResolvedValueOnce(false)

    const user = {
      id: 44,
      collection: 'unknown',
      email: 'support@example.com',
    }

    const result = await clinicMediaReadAccess(
      createAccessArgs<ClinicMediaReadArgs>(user, {
        extra: { isReadingStaticFile: true },
      }),
    )

    expect(result).toBe(false)
  })
})
