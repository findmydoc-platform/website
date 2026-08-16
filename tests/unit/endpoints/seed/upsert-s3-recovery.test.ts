import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'
import { upsertByStableId } from '@/endpoints/seed/utils/upsert'

describe('upsertByStableId S3 NoSuchKey recovery', () => {
  const find = vi.fn()
  const create = vi.fn()
  const remove = vi.fn()
  const update = vi.fn()
  const warn = vi.fn()

  const payload = {
    find,
    create,
    delete: remove,
    update,
    logger: { warn },
  } as unknown as Payload

  beforeEach(() => {
    find.mockReset()
    create.mockReset()
    remove.mockReset().mockResolvedValue(undefined)
    update.mockReset()
    warn.mockReset()
    vi.stubEnv('DEPLOYMENT_ENV', 'test')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  it('replaces the document and re-creates the upload when the previous object key is missing', async () => {
    find.mockResolvedValue({ totalDocs: 1, docs: [{ id: 'media-1' }] })
    update
      .mockRejectedValueOnce({
        name: 'NoSuchKey',
        Code: 'NoSuchKey',
        Resource: 'findmydoc-test/platform/rehab-physio.jpg',
        message: 'Object not found',
      })
      .mockResolvedValueOnce({ id: 'media-1' })

    const result = await upsertByStableId(
      payload,
      'platformContentMedia',
      {
        stableId: '3552a36c-29ab-4d0c-b859-01de09d9c360',
        alt: 'Rehab image',
      },
      { filePath: '/tmp/rehab-physio.jpg' },
    )

    expect(result).toEqual({ created: false, updated: true })
    expect(update).toHaveBeenCalledTimes(1)
    expect(create).toHaveBeenCalledTimes(1)
    expect(remove).toHaveBeenCalledTimes(1)
    expect(remove).toHaveBeenCalledWith({
      collection: 'platformContentMedia',
      id: 'media-1',
      overrideAccess: true,
      trash: true,
      context: {
        disableRevalidate: true,
        seedMediaExpectedNoSuchKeyRecovery: true,
      },
      req: {
        context: {
          disableRevalidate: true,
          seedMediaExpectedNoSuchKeyRecovery: true,
        },
      },
    })
    expect(warn).toHaveBeenCalledWith(
      'Seed media replacement fallback for missing object key: platform/rehab-physio.jpg',
    )

    const createCall = create.mock.calls[0]?.[0] as Record<string, unknown>

    expect(createCall.filePath).toBe('/tmp/rehab-physio.jpg')
    expect(createCall.data).toEqual({
      stableId: expect.any(String),
      alt: 'Rehab image',
    })
  })

  it('replaces seed user profile media when its immutable owner relation has drifted', async () => {
    find.mockResolvedValue({
      totalDocs: 1,
      docs: [
        {
          id: 'profile-media-1',
          user: { relationTo: 'platformStaff', value: { id: 41 } },
          createdBy: { relationTo: 'platformStaff', value: 41 },
        },
      ],
    })
    create.mockResolvedValue({ id: 'profile-media-2' })

    const data = {
      stableId: 'seed-user-profile-admin',
      alt: 'Seed admin profile',
      user: { relationTo: 'platformStaff', value: 84 },
      createdBy: { relationTo: 'platformStaff', value: 84 },
    }

    const result = await upsertByStableId(payload, 'userProfileMedia', data, {
      filePath: '/tmp/seed-admin-profile.webp',
      policy: {
        recreateUploadOnRelationDrift: ['user', 'createdBy'],
      },
    })

    expect(result).toEqual({ created: false, updated: true })
    expect(update).not.toHaveBeenCalled()
    expect(remove).toHaveBeenCalledWith({
      collection: 'userProfileMedia',
      id: 'profile-media-1',
      overrideAccess: true,
      trash: true,
      context: {
        disableRevalidate: true,
        seedMediaExpectedNoSuchKeyRecovery: true,
      },
      req: {
        context: {
          disableRevalidate: true,
          seedMediaExpectedNoSuchKeyRecovery: true,
        },
      },
    })
    expect(create).toHaveBeenCalledWith({
      collection: 'userProfileMedia',
      data,
      overrideAccess: true,
      context: {
        disableRevalidate: true,
        seedMediaExpectedNoSuchKeyRecovery: true,
      },
      req: {
        context: {
          disableRevalidate: true,
          seedMediaExpectedNoSuchKeyRecovery: true,
        },
      },
      filePath: '/tmp/seed-admin-profile.webp',
    })
    expect(warn).toHaveBeenCalledWith(
      'Seed upload replacement for immutable relation drift: userProfileMedia:seed-user-profile-admin',
    )
  })

  it('rejects configured upload replacement when relation drift has no source file', async () => {
    find.mockResolvedValue({
      totalDocs: 1,
      docs: [
        {
          id: 'profile-media-1',
          user: { relationTo: 'platformStaff', value: 41 },
        },
      ],
    })

    await expect(
      upsertByStableId(
        payload,
        'userProfileMedia',
        {
          stableId: 'seed-user-profile-admin',
          user: { relationTo: 'platformStaff', value: 84 },
        },
        {
          policy: {
            recreateUploadOnRelationDrift: ['user'],
          },
        },
      ),
    ).rejects.toThrow(
      'Seed upload replacement for relation drift requires a file: userProfileMedia:seed-user-profile-admin',
    )

    expect(update).not.toHaveBeenCalled()
    expect(remove).not.toHaveBeenCalled()
    expect(create).not.toHaveBeenCalled()
  })

  it('retries a transient upload transport failure before succeeding', async () => {
    let updateCalls = 0
    const payload = {
      find: vi.fn().mockResolvedValue({ totalDocs: 1, docs: [{ id: 'media-2' }] }),
      create: vi.fn(),
      update: async () => {
        updateCalls += 1
        if (updateCalls === 1) {
          throw new Error('ssl/tls alert bad record mac')
        }

        return { id: 'media-2' }
      },
      delete: vi.fn().mockResolvedValue(undefined),
      logger: { warn },
    } as unknown as Payload

    const result = await upsertByStableId(
      payload,
      'platformContentMedia',
      {
        stableId: '8f2ecf77-5fbe-4f0d-9d3f-4f056e8f3d13',
        alt: 'Retry image',
      },
      { filePath: '/tmp/retry-image.jpg' },
    )

    expect(result).toEqual({ created: false, updated: true })
    expect(updateCalls).toBe(2)
  })

  it('retries create after clearing trashed upload filenames when filename is blocked by unique index', async () => {
    find
      .mockResolvedValueOnce({ totalDocs: 0, docs: [] })
      .mockResolvedValueOnce({ totalDocs: 1, docs: [{ id: 'trash-1' }] })
      .mockResolvedValueOnce({ totalDocs: 0, docs: [] })

    create
      .mockRejectedValueOnce({
        data: {
          errors: [{ path: 'filename', message: 'Value must be unique' }],
        },
      })
      .mockResolvedValueOnce({ id: 'media-new' })

    const result = await upsertByStableId(
      payload,
      'platformContentMedia',
      {
        stableId: 'd91b7a10-7e2f-4f61-af76-fca85f0e4195',
        alt: 'Recovery image',
      },
      { filePath: '/tmp/recovery-image.jpg' },
    )

    expect(result).toEqual({ created: true, updated: false })
    expect(create).toHaveBeenCalledTimes(2)
    expect(update).toHaveBeenCalledWith({
      collection: 'platformContentMedia',
      id: 'trash-1',
      overrideAccess: true,
      trash: true,
      context: {
        disableRevalidate: true,
        seedMediaExpectedNoSuchKeyRecovery: true,
        skipCloudStorage: true,
      },
      req: {
        context: {
          disableRevalidate: true,
          seedMediaExpectedNoSuchKeyRecovery: true,
          skipCloudStorage: true,
        },
      },
      data: {
        filename: null,
      },
    })
    expect(warn).toHaveBeenCalledWith(
      'Seed upload filename conflict recovery: cleared filename on 1 trashed platformContentMedia doc(s) before retry',
    )
  })
})
