import { describe, expect, test, vi } from 'vitest'
import { beforeChangeDoctorMedia } from '@/collections/DoctorMedia/hooks/beforeChangeDoctorMedia'

const baseReq = (user?: any, payloadOverrides: any = {}) =>
  ({
    user,
    payload: {
      findByID: vi.fn(),
      logger: { error: () => {} },
      ...payloadOverrides,
    },
  }) as any

describe('beforeChangeDoctorMedia', () => {
  test('sets clinic and storage path on create', async () => {
    const req = baseReq({ id: 5, collection: 'basicUsers' })
    ;(req.payload.findByID as any).mockResolvedValue({ clinic: 8 })

    const data: any = { id: '201', doctor: 3, filename: 'portraits/doc.png' }

    const result: any = await beforeChangeDoctorMedia({
      data,
      operation: 'create',
      req,
      originalDoc: undefined,
    } as any)

    // Accept either numeric or string doctor id in spy arguments
    const callArgs = (req.payload.findByID as any).mock.calls[0][0]
    expect(callArgs.collection).toBe('doctors')
    expect(callArgs.depth).toBe(0)
    expect(String(callArgs.id)).toBe('3')
    expect(result.clinic).toBe('8')
    expect(result.filename).toBe('3/201/doc.png')
    expect(result.storagePath).toBe('doctors/3/201/doc.png')
  })

  test('prevents doctor change on update', async () => {
    const req = baseReq({ id: 2, collection: 'basicUsers' })

    await expect(
      beforeChangeDoctorMedia({
        data: { doctor: 10 },
        operation: 'update',
        req,
        originalDoc: { doctor: 9 },
      } as any),
    ).rejects.toThrow('Doctor ownership cannot be changed once set')
  })
})
