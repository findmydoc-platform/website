import { describe, expect, test, vi } from 'vitest'
import type { SanitizedCollectionConfig, PayloadRequest, RequestContext } from 'payload'
import type { Doctor, DoctorMedia } from '@/payload-types'

// Mock crypto to produce a stable, predictable short-hash for tests.
vi.mock('crypto', () => {
  const impl = {
    createHash: () => ({
      update: () => ({
        digest: () => 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      }),
    }),
  }
  return {
    default: impl,
    ...impl,
  }
})

import { beforeChangeDoctorMedia } from '@/collections/DoctorMedia/hooks/beforeChangeDoctorMedia'

const baseReq = (user?: unknown, payloadOverrides: Record<string, unknown> = {}) =>
  ({
    user,
    payload: {
      findByID: vi.fn(),
      logger: { error: () => {} },
      ...payloadOverrides,
    },
  }) as unknown as PayloadRequest

const mockCollection = { slug: 'doctorMedia' } as unknown as SanitizedCollectionConfig
const emptyContext = {} as unknown as RequestContext

describe('beforeChangeDoctorMedia', () => {
  test('sets clinic and storage path on create', async () => {
    const req = baseReq({ id: 5, collection: 'basicUsers' })
    vi.mocked(req.payload.findByID).mockResolvedValue({ clinic: 8 } as unknown as Doctor)

    const data: Partial<DoctorMedia> = { id: 201, doctor: 3, filename: 'portraits/doc.png' }

    const result = (await beforeChangeDoctorMedia({
      data,
      operation: 'create',
      req,
      originalDoc: undefined,
      collection: mockCollection,
      context: emptyContext,
    })) as Record<string, unknown>

    // Accept either numeric or string doctor id in spy arguments
    const callArgs = vi.mocked(req.payload.findByID).mock.calls[0]?.[0]
    expect(callArgs).toBeDefined()
    expect(callArgs?.collection).toBe('doctors')
    expect(callArgs?.depth).toBe(0)
    expect(String(callArgs?.id)).toBe('3')
    // shortHash is mocked to 'aaaaaaaaaaaaaaaa...' so shortHash().slice(0,10) === 'aaaaaaaaaa'
    expect(result.clinic).toBe(8)
    expect(result.filename).toBe('3-aaaaaaaaaa-doc.png')
    expect(result.storagePath).toBe('doctors/3-aaaaaaaaaa-doc.png')
  })

  test('prevents doctor change on update', async () => {
    const req = baseReq({ id: 2, collection: 'basicUsers' })

    await expect(
      beforeChangeDoctorMedia({
        data: { doctor: 10 } as Partial<DoctorMedia>,
        operation: 'update',
        req,
        originalDoc: { doctor: 9 } as DoctorMedia,
        collection: mockCollection,
        context: emptyContext,
      }),
    ).rejects.toThrow('Doctor ownership cannot be changed once set')
  })
})
