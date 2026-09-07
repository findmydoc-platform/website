import type { Payload, PayloadRequest } from 'payload'
import { createS3InquiryAttachmentStorage } from '@/features/inquiryCommunication/storage'
import type { InquiryRetentionObjectDeletionPort } from '@/features/inquiryRetention/storagePort'

/** Keep metadata until every object is removed so a failed reset can retry safely. */
export async function resetInquiryAttachmentFiles(
  payload: Payload,
  req: Partial<PayloadRequest>,
  createStorage: () => InquiryRetentionObjectDeletionPort = createS3InquiryAttachmentStorage,
): Promise<void> {
  let storage: InquiryRetentionObjectDeletionPort | undefined
  let page = 1

  while (true) {
    const attachments = await payload
      .find({
        collection: 'inquiryAttachments',
        depth: 0,
        limit: 100,
        page,
        sort: 'id',
        overrideAccess: true,
        showHiddenFields: true,
        select: { draftObjectKey: true, readyObjectKey: true },
        req,
      })
      .catch(() => {
        throw new Error(`Seed reset failed during file cleanup while reading inquiryAttachments page ${page}`)
      })

    for (const attachment of attachments.docs) {
      const keys = [
        ...new Set(
          [attachment.draftObjectKey, attachment.readyObjectKey].filter(
            (key): key is string => typeof key === 'string' && key.length > 0 && !key.startsWith('deleted/'),
          ),
        ),
      ]
      if (keys.length === 0) continue

      try {
        storage ??= createStorage()
        await storage.deleteObjects(keys)
      } catch {
        // Storage errors can include private object keys or signed request URLs.
        throw new Error(`Seed reset failed during file cleanup of inquiryAttachments:${String(attachment.id)}`)
      }
    }

    if (!attachments.hasNextPage) return
    page += 1
  }
}
