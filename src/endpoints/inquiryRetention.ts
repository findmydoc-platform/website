import type { PayloadHandler, PayloadRequest } from 'payload'
import type { ZodType } from 'zod'

import {
  inquiryContentHardDeleteInputSchema,
  inquiryDeletionInputSchema,
  inquiryLegalHoldPlaceInputSchema,
  inquiryLegalHoldReleaseInputSchema,
  inquiryPendingDeleteRecoveryInputSchema,
  inquiryRetentionCutoverInputSchema,
  inquiryRetentionReviewQueueInputSchema,
} from '@/features/inquiryRetention/contracts'
import {
  anonymizeInquiryPackage,
  cutoverLegacyInquiryCommunication,
  hardDeleteInquiryContent,
  hardDeleteInquiryPackage,
  InquiryRetentionServiceError,
  placeInquiryLegalHold,
  readInquiryRetentionReviewQueue,
  releaseInquiryLegalHold,
  resumePendingInquiryAttachmentHardDeletes,
} from '@/features/inquiryRetention/service'
import type { InquiryRetentionObjectDeletionPort } from '@/features/inquiryRetention/storagePort'
import { createS3InquiryAttachmentStorage } from '@/features/inquiryCommunication/storage'
import { toLoggedError } from '@/utilities/logging/shared'

const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store',
  Expires: '0',
  Pragma: 'no-cache',
  Vary: 'Authorization, Cookie',
} as const

const retentionObjectDeletionPort: InquiryRetentionObjectDeletionPort = {
  deleteObjects: (objectKeys) => createS3InquiryAttachmentStorage().deleteObjects(objectKeys),
}

const response = (body: unknown, status: number): Response => Response.json(body, { headers: PRIVATE_HEADERS, status })
const errorResponse = (code: string, status: number): Response => response({ error: { code } }, status)

const authorize = (req: PayloadRequest): Response | null => {
  if (!req.user) return errorResponse('RETENTION_UNAUTHORIZED', 401)
  if (req.user.collection !== 'platformStaff') return errorResponse('RETENTION_ACCESS_DENIED', 403)
  return null
}

const readBody = async <Value>(req: PayloadRequest, schema: ZodType<Value>): Promise<Response | Value> => {
  const body = typeof req.json === 'function' ? await req.json().catch(() => undefined) : undefined
  const parsed = schema.safeParse(body)
  return parsed.success ? parsed.data : errorResponse('RETENTION_INVALID_INPUT', 400)
}

const run = async <Value>(req: PayloadRequest, operation: () => Promise<Value>, event: string): Promise<Response> => {
  try {
    return response(await operation(), 200)
  } catch (error: unknown) {
    if (error instanceof InquiryRetentionServiceError) {
      const descriptions = {
        'access-denied': ['RETENTION_ACCESS_DENIED', 403],
        conflict: ['RETENTION_CONFLICT', 409],
        'invalid-input': ['RETENTION_INVALID_INPUT', 400],
        'invalid-state': ['RETENTION_INVALID_STATE', 409],
        'not-found': ['RETENTION_NOT_FOUND', 404],
        unauthorized: ['RETENTION_UNAUTHORIZED', 401],
        unavailable: ['RETENTION_SERVICE_UNAVAILABLE', 503],
      } as const
      const [code, status] = descriptions[error.kind]
      return errorResponse(code, status)
    }
    req.payload.logger.error({ err: toLoggedError(error), event }, 'Inquiry retention request failed')
    return errorResponse('RETENTION_SERVICE_UNAVAILABLE', 503)
  }
}

const createHandler =
  <Value>(
    schema: ZodType<Value>,
    operation: (req: PayloadRequest, input: Value) => Promise<unknown>,
    event: string,
  ): PayloadHandler =>
  async (req) => {
    const denied = authorize(req)
    if (denied) return denied
    const input = await readBody(req, schema)
    if (input instanceof Response) return input
    return run(req, () => operation(req, input), event)
  }

export const platformInquiryRetentionReviewQueuePostHandler = createHandler(
  inquiryRetentionReviewQueueInputSchema,
  readInquiryRetentionReviewQueue,
  'platform.inquiry_retention.review_queue_failed',
)

export const platformInquiryRetentionCutoverPostHandler = createHandler(
  inquiryRetentionCutoverInputSchema,
  cutoverLegacyInquiryCommunication,
  'platform.inquiry_retention.cutover_failed',
)

export const platformInquiryRetentionContentHardDeletePostHandler = createHandler(
  inquiryContentHardDeleteInputSchema,
  (req, input) => hardDeleteInquiryContent(req, input, retentionObjectDeletionPort),
  'platform.inquiry_retention.content_hard_delete_failed',
)

export const platformInquiryRetentionAnonymizePostHandler = createHandler(
  inquiryDeletionInputSchema,
  anonymizeInquiryPackage,
  'platform.inquiry_retention.anonymize_failed',
)

export const platformInquiryRetentionPackageHardDeletePostHandler = createHandler(
  inquiryDeletionInputSchema,
  (req, input) => hardDeleteInquiryPackage(req, input, retentionObjectDeletionPort),
  'platform.inquiry_retention.package_hard_delete_failed',
)

export const platformInquiryRetentionPendingDeletesRecoverPostHandler = createHandler(
  inquiryPendingDeleteRecoveryInputSchema,
  (req, input) => resumePendingInquiryAttachmentHardDeletes(req, input, retentionObjectDeletionPort),
  'platform.inquiry_retention.pending_delete_recovery_failed',
)

export const platformInquiryLegalHoldPlacePostHandler = createHandler(
  inquiryLegalHoldPlaceInputSchema,
  placeInquiryLegalHold,
  'platform.inquiry_retention.hold_place_failed',
)

export const platformInquiryLegalHoldReleasePostHandler = createHandler(
  inquiryLegalHoldReleaseInputSchema,
  releaseInquiryLegalHold,
  'platform.inquiry_retention.hold_release_failed',
)
