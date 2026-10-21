import { APIError, type PayloadHandler, type PayloadRequest } from 'payload'
import { getClinicDashboardOrigin } from '@/auth/utilities/clinicDashboardOrigin'
import { revalidateClinicDashboardTargetRequest } from '@/features/clinicDashboard/authorization'
import { hasClinicScopeContract, CLINIC_SCOPE_CONTRACT_HEADER } from '@/features/clinicDashboard/contractNegotiation'
import { clinicReviewDetailIdSchema } from '@/features/clinicDashboard/reviews/contracts'
import { readClinicReviewDetail } from '@/features/clinicDashboard/reviews/service'
import { reviewPublicationHistoryGetHandler } from '@/collections/reviews/endpoints'
import {
  createClinicReviewWorkflow,
  readClinicReviewPage,
  readClinicReviewWorkflows,
  readClinicReviewWorkflowVersions,
  updateClinicReviewResponse,
} from '@/features/clinicDashboard/reviews/operations'

const headers = {
  'Cache-Control': 'private, no-store',
  Pragma: 'no-cache',
  Expires: '0',
  Vary: `Authorization, ${CLINIC_SCOPE_CONTRACT_HEADER}`,
}
const response = (body: unknown, status: number) => Response.json(body, { status, headers })
const invalid = () => new APIError('Invalid review request.', 400)
async function body(req: PayloadRequest): Promise<unknown> {
  if (req.headers.get('origin') !== getClinicDashboardOrigin()) throw new APIError('Request rejected.', 403)
  const query = new URL(req.url ?? 'http://localhost:3000').search
  if (query !== '' && query !== '?depth=0') throw invalid()
  if (req.headers.get('content-type')?.split(';')[0]?.trim() !== 'application/json' || !req.body) throw invalid()
  const maximum = 16_384
  if (Number(req.headers.get('content-length')) > maximum) throw new APIError('Request too large.', 413)
  const reader = req.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      const chunk = await reader.read()
      if (chunk.done) break
      size += chunk.value.byteLength
      if (size > maximum) {
        await reader.cancel().catch(() => undefined)
        throw new APIError('Request too large.', 413)
      }
      chunks.push(chunk.value)
    }
  } finally {
    reader.releaseLock()
  }
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)))
  } catch {
    throw invalid()
  }
}
type Operation = (req: PayloadRequest, clinicId: string, input: unknown) => Promise<unknown>
function handler(operation: Operation, write = false): PayloadHandler {
  return async (req) => {
    try {
      const clinicId = String(req.routeParams?.clinicId ?? '')
      if (
        !hasClinicScopeContract(req.headers) ||
        !/^[1-9]\d*$/u.test(clinicId) ||
        !Number.isSafeInteger(Number(clinicId))
      )
        throw invalid()
      const input = write ? await body(req) : undefined
      const access = await revalidateClinicDashboardTargetRequest(req, clinicId)
      if (access.status !== 'authorized')
        return response(
          {
            error: {
              code:
                access.status === 'unauthorized'
                  ? 'UNAUTHENTICATED'
                  : access.status === 'access-denied'
                    ? 'CONTENT_ACCESS_DENIED'
                    : 'SERVICE_UNAVAILABLE',
            },
          },
          access.status === 'unauthorized' ? 401 : access.status === 'access-denied' ? 403 : 503,
        )
      const result = await operation(req, clinicId, input)
      if (result instanceof Response) {
        Object.entries(headers).forEach(([key, value]) => result.headers.set(key, value))
        return result
      }
      return response(result, 200)
    } catch (error) {
      const status = error instanceof APIError && [400, 403, 404, 409, 413].includes(error.status) ? error.status : 503
      const code =
        status === 400
          ? 'INVALID_INPUT'
          : status === 403
            ? 'CONTENT_ACCESS_DENIED'
            : status === 404
              ? 'TARGET_UNAVAILABLE'
              : status === 409
                ? 'CONFLICT'
                : status === 413
                  ? 'PAYLOAD_TOO_LARGE'
                  : 'SERVICE_UNAVAILABLE'
      return response({ error: { code } }, status)
    }
  }
}
const id = (req: PayloadRequest, key = 'id') => {
  const parsed = clinicReviewDetailIdSchema.safeParse(String(req.routeParams?.[key] ?? ''))
  if (!parsed.success) throw invalid()
  return parsed.data
}
export const clinicDashboardReviewsGetHandler = handler(readClinicReviewPage)
export const clinicDashboardReviewRecordGetHandler = handler(async (req, clinicId) => {
  if (new URL(req.url ?? 'http://localhost:3000').search !== '?depth=1') throw invalid()
  const detail = await readClinicReviewDetail(req, id(req), clinicId)
  if (!detail) throw new APIError('Review unavailable.', 404)
  return detail
})
export const clinicDashboardReviewHistoryGetHandler = handler(async (req) => reviewPublicationHistoryGetHandler(req))
export const clinicDashboardReviewResponsesGetHandler = handler((req, clinicId) =>
  readClinicReviewWorkflows(req, clinicId, 'reviewResponses'),
)
export const clinicDashboardReviewAppealsGetHandler = handler((req, clinicId) =>
  readClinicReviewWorkflows(req, clinicId, 'reviewAppeals'),
)
export const clinicDashboardReviewResponseVersionsGetHandler = handler((req, clinicId) =>
  readClinicReviewWorkflowVersions(req, clinicId, 'reviewResponses'),
)
export const clinicDashboardReviewAppealVersionsGetHandler = handler((req, clinicId) =>
  readClinicReviewWorkflowVersions(req, clinicId, 'reviewAppeals'),
)
export const clinicDashboardReviewResponsesPostHandler = handler(
  (req, clinicId, input) => createClinicReviewWorkflow(req, clinicId, 'reviewResponses', input),
  true,
)
export const clinicDashboardReviewAppealsPostHandler = handler(
  (req, clinicId, input) => createClinicReviewWorkflow(req, clinicId, 'reviewAppeals', input),
  true,
)
export const clinicDashboardReviewResponsePatchHandler = handler(
  (req, clinicId, input) => updateClinicReviewResponse(req, clinicId, id(req, 'workflowId'), input),
  true,
)
