import { describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'
import { resetInquiryAttachmentFiles } from '@/endpoints/seed/utils/resetInquiryAttachments'

describe('seed attachment file cleanup', () => {
  it('reads every page and deletes only stored object keys, including ready keys hidden by field access', async () => {
    const find = vi
      .fn()
      .mockResolvedValueOnce({
        docs: [{ id: 1, draftObjectKey: 'draft/1', readyObjectKey: 'ready/1' }],
        hasNextPage: true,
      })
      .mockResolvedValueOnce({
        docs: [
          { id: 2, draftObjectKey: 'shared/2', readyObjectKey: 'shared/2' },
          { id: 3, draftObjectKey: 'deleted/3', readyObjectKey: '' },
        ],
        hasNextPage: false,
      })
    const storage = { deleteObjects: vi.fn().mockResolvedValue(undefined) }
    await resetInquiryAttachmentFiles({ find } as unknown as Payload, {}, () => storage)
    expect(storage.deleteObjects.mock.calls).toEqual([[['draft/1', 'ready/1']], [['shared/2']]])
    expect(find).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        collection: 'inquiryAttachments',
        page: 2,
        sort: 'id',
        overrideAccess: true,
        showHiddenFields: true,
        select: { draftObjectKey: true, readyObjectKey: true },
      }),
    )
  })

  it('does not initialize storage when no files need cleanup', async () => {
    const find = vi.fn().mockResolvedValue({ docs: [{ id: 1, draftObjectKey: 'deleted/1' }], hasNextPage: false })
    const createStorage = vi.fn()
    await resetInquiryAttachmentFiles({ find } as unknown as Payload, {}, createStorage)
    expect(createStorage).not.toHaveBeenCalled()
  })

  it('stops on a storage failure, redacts its details, and can replay partially completed deletes', async () => {
    const find = vi.fn().mockResolvedValue({
      docs: [
        { id: 1, draftObjectKey: 'private/1' },
        { id: 2, readyObjectKey: 'private/2' },
      ],
      hasNextPage: false,
    })
    const storage = {
      deleteObjects: vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('private/2 secret')),
    }
    const payload = { find } as unknown as Payload
    await expect(resetInquiryAttachmentFiles(payload, {}, () => storage)).rejects.toThrow(
      'Seed reset failed during file cleanup of inquiryAttachments:2',
    )
    storage.deleteObjects.mockResolvedValue(undefined)
    await resetInquiryAttachmentFiles(payload, {}, () => storage)
    expect(storage.deleteObjects.mock.calls).toEqual([
      [['private/1']],
      [['private/2']],
      [['private/1']],
      [['private/2']],
    ])
  })
})
