import { describe, expect, it, vi } from 'vitest'
import type { PayloadRequest } from 'payload'
import { ValidationError } from 'payload'

import { beforeChangeValidateDoctorProfileImage } from '@/hooks/doctorProfileImageOwnership'
import type { Doctor } from '@/payload-types'

const createReq = () =>
  ({
    payload: {
      findByID: vi.fn(),
    },
  }) as unknown as PayloadRequest

const runHook = ({
  data,
  originalDoc,
  req,
}: {
  data: Partial<Doctor>
  originalDoc?: Partial<Doctor>
  req: PayloadRequest
}) =>
  beforeChangeValidateDoctorProfileImage({
    collection: { slug: 'doctors' } as never,
    context: {} as never,
    data,
    operation: originalDoc ? 'update' : 'create',
    originalDoc: originalDoc as Doctor | undefined,
    req,
  })

const expectProfileImageError = async (result: ReturnType<typeof runHook>, message: string) => {
  await expect(result).rejects.toBeInstanceOf(ValidationError)
  await expect(result).rejects.toMatchObject({
    data: {
      errors: [expect.objectContaining({ message, path: 'profileImage' })],
    },
    status: 400,
  })
}

describe('beforeChangeValidateDoctorProfileImage', () => {
  it('does not query media when profileImage is unchanged', async () => {
    const req = createReq()

    await expect(
      runHook({
        data: { biography: null },
        originalDoc: { id: 10, clinic: 4, profileImage: 20 },
        req,
      }),
    ).resolves.toEqual({ biography: null })
    expect(req.payload.findByID).not.toHaveBeenCalled()
  })

  it('revalidates existing media when the doctor clinic changes', async () => {
    const req = createReq()
    vi.mocked(req.payload.findByID).mockResolvedValue({ id: 20, doctor: 10, clinic: 4 } as never)

    await expectProfileImageError(
      runHook({
        data: { clinic: 5 },
        originalDoc: { id: 10, clinic: 4, profileImage: 20 },
        req,
      }),
      "Selected profile image does not belong to this doctor's clinic.",
    )
  })

  it('allows media owned by the same doctor and clinic', async () => {
    const req = createReq()
    vi.mocked(req.payload.findByID).mockResolvedValue({ id: 20, doctor: 10, clinic: 4 } as never)

    await expect(
      runHook({
        data: { profileImage: 20 },
        originalDoc: { id: 10, clinic: 4 },
        req,
      }),
    ).resolves.toEqual({ profileImage: 20 })
  })

  it('rejects media owned by another doctor', async () => {
    const req = createReq()
    vi.mocked(req.payload.findByID).mockResolvedValue({ id: 20, doctor: 11, clinic: 4 } as never)

    await expectProfileImageError(
      runHook({
        data: { profileImage: 20 },
        originalDoc: { id: 10, clinic: 4 },
        req,
      }),
      'Selected profile image does not belong to this doctor.',
    )
  })

  it('does not trust an incoming document ID when validating ownership on update', async () => {
    const req = createReq()
    vi.mocked(req.payload.findByID).mockResolvedValue({ id: 20, doctor: 11, clinic: 4 } as never)

    await expectProfileImageError(
      runHook({
        data: { id: 11, profileImage: 20 },
        originalDoc: { id: 10, clinic: 4 },
        req,
      }),
      'Selected profile image does not belong to this doctor.',
    )
  })

  it('rejects media owned by another clinic', async () => {
    const req = createReq()
    vi.mocked(req.payload.findByID).mockResolvedValue({ id: 20, doctor: 10, clinic: 5 } as never)

    await expectProfileImageError(
      runHook({
        data: { profileImage: 20 },
        originalDoc: { id: 10, clinic: 4 },
        req,
      }),
      "Selected profile image does not belong to this doctor's clinic.",
    )
  })

  it('requires the doctor to exist before assigning a profile image', async () => {
    const req = createReq()

    await expectProfileImageError(
      runHook({
        data: { clinic: 4, profileImage: 20 },
        req,
      }),
      'Save the doctor before assigning a profile image.',
    )
  })

  it('allows clearing the profile image', async () => {
    const req = createReq()

    await expect(
      runHook({
        data: { profileImage: null },
        originalDoc: { id: 10, clinic: 4, profileImage: 20 },
        req,
      }),
    ).resolves.toEqual({ profileImage: null })
    expect(req.payload.findByID).not.toHaveBeenCalled()
  })
})
