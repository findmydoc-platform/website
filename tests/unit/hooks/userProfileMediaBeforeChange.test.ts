import { describe, expect, test, vi } from 'vitest'
import { beforeChangeUserProfileMedia } from '@/collections/UserProfileMedia/hooks/beforeChangeUserProfileMedia'

const baseReq = (user?: any) =>
  ({
    user,
    payload: {
      findByID: vi.fn(),
      logger: { error: () => {} },
    },
  }) as any

describe('beforeChangeUserProfileMedia', () => {
  test('derives storage path using supabase user id on create', async () => {
    const req = baseReq({ id: '24', collection: 'basicUsers' })
    ;(req.payload.findByID as any).mockResolvedValue({ supabaseUserId: 'supabase-xyz', id: '24' })

    const data: any = {
      id: '301',
      user: { relationTo: 'basicUsers', value: '24' },
      filename: 'avatars/photo.jpeg',
    }

    const result: any = await beforeChangeUserProfileMedia({
      data,
      operation: 'create',
      req,
      originalDoc: undefined,
    } as any)

    expect(req.payload.findByID).toHaveBeenCalledWith({ collection: 'basicUsers', id: '24', depth: 0 })
    expect(result.createdBy).toEqual({ relationTo: 'basicUsers', value: '24' })
    expect(result.filename).toBe('supabase-xyz/301/photo.jpeg')
    expect(result.storagePath).toBe('users/supabase-xyz/301/photo.jpeg')
  })

  test('throws when trying to change owner on update', async () => {
    const req = baseReq({ id: '11', collection: 'basicUsers' })

    await expect(
      beforeChangeUserProfileMedia({
        data: { user: { relationTo: 'basicUsers', value: '99' } },
        operation: 'update',
        req,
        originalDoc: { user: { relationTo: 'patients', value: '44' } },
      } as any),
    ).rejects.toThrow('User ownership cannot be changed once set')
  })
})
