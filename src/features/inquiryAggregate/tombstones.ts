import { createHash } from 'node:crypto'
import type { PayloadRequest } from 'payload'

export const inquiryContentTombstoneKey = (
  inquiryId: number | string,
  targetType: 'attachment' | 'message',
  targetId: number | string,
): string =>
  createHash('sha256')
    .update(`${String(inquiryId)}:${targetType}:${String(targetId)}`)
    .digest('hex')

export const inquiryPackageTombstoneKey = (
  inquiryId: number | string,
  operation: 'anonymized' | 'hard-deleted',
): string =>
  createHash('sha256')
    .update(`${String(inquiryId)}:package:${operation}`)
    .digest('hex')

export const hasInquiryPackageHardDeleteBarrier = async (
  req: PayloadRequest,
  inquiryId: number | string,
): Promise<boolean> => {
  const result = await req.payload.find({
    collection: 'inquiryDeletionProofs' as never,
    depth: 0,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    req,
    where: {
      and: [
        { tombstoneKey: { equals: inquiryPackageTombstoneKey(inquiryId, 'hard-deleted') } },
        { operation: { in: ['hard-delete-pending', 'hard-deleted'] } },
      ],
    },
  } as never)
  return result.docs.length > 0
}

export const readInquiryHardDeleteTombstones = async (
  req: PayloadRequest,
  inquiryId: number | string,
): Promise<Set<string>> => {
  const tombstones = new Set<string>()
  let page = 1
  while (true) {
    const result = await req.payload.find({
      collection: 'inquiryDeletionProofs' as never,
      depth: 0,
      limit: 100,
      overrideAccess: true,
      page,
      pagination: true,
      req,
      sort: ['createdAt', 'id'],
      where: {
        and: [
          { inquiryId: { equals: String(inquiryId) } },
          { operation: { in: ['hard-delete-pending', 'hard-deleted'] } },
        ],
      },
    } as never)
    for (const proof of result.docs) {
      const tombstoneKey = (proof as { tombstoneKey?: unknown }).tombstoneKey
      if (typeof tombstoneKey === 'string') tombstones.add(tombstoneKey)
    }
    if (!result.hasNextPage) return tombstones
    page = result.nextPage ?? page + 1
  }
}

export const isInquiryContentHardDeleted = (
  tombstones: ReadonlySet<string>,
  input: {
    contentState?: unknown
    inquiryId: number | string
    targetId: number | string
    targetType: 'attachment' | 'message'
  },
): boolean =>
  input.contentState === 'hard-deleted' ||
  tombstones.has(inquiryContentTombstoneKey(input.inquiryId, input.targetType, input.targetId))
