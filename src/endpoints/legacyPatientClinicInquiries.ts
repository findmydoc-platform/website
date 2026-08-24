import type { PayloadHandler, PayloadRequest } from 'payload'

import { revalidateClinicDashboardRequest } from '@/features/clinicDashboard/authorization'
import { resolveClinicDashboardContract } from '@/features/clinicDashboard/contractNegotiation'
import { inquiryIdSchema, legacyInquiryStatusInputSchema } from '@/features/inquiryCommunication/contracts'
import {
  changeLegacyClinicInquiryStatus,
  InquiryCommunicationServiceError,
  readLegacyClinicInquiryDetail,
  readLegacyClinicInquiryQueue,
} from '@/features/inquiryCommunication/service'
import { toLoggedError } from '@/utilities/logging/shared'
import { clinicDashboardPrivateJsonResponse } from './clinicDashboardBootstrap'

const legacyErrorResponse = (status: number, message: string): Response =>
  clinicDashboardPrivateJsonResponse({ errors: [{ message }] }, status)

const authorizeLegacyRequest = async (req: PayloadRequest): Promise<Response | undefined> => {
  if (resolveClinicDashboardContract(req.headers) !== 'legacy') {
    return legacyErrorResponse(400, 'Invalid request.')
  }
  const result = await revalidateClinicDashboardRequest(req, 'legacy')
  switch (result.status) {
    case 'authorized':
      return undefined
    case 'access-denied':
      return legacyErrorResponse(403, 'Access denied.')
    case 'unauthorized':
      return legacyErrorResponse(401, 'Authentication required.')
    case 'unavailable':
      return legacyErrorResponse(503, 'Inquiry service unavailable.')
  }
}

const legacyServiceErrorResponse = (error: InquiryCommunicationServiceError, mutation: boolean): Response => {
  switch (error.kind) {
    case 'unauthorized':
      return legacyErrorResponse(401, 'Authentication required.')
    case 'access-denied':
      return legacyErrorResponse(403, 'Access denied.')
    case 'not-found':
      return legacyErrorResponse(404, 'Inquiry not found.')
    case 'conflict':
    case 'invalid-state':
      return legacyErrorResponse(409, 'Inquiry status conflict.')
    case 'invalid-input':
      return legacyErrorResponse(mutation ? 409 : 400, mutation ? 'Inquiry status conflict.' : 'Invalid request.')
    default:
      return legacyErrorResponse(503, 'Inquiry service unavailable.')
  }
}

const executeLegacy = async (
  req: PayloadRequest,
  operation: string,
  mutation: boolean,
  command: () => Promise<Response>,
): Promise<Response> => {
  try {
    return await command()
  } catch (error: unknown) {
    if (error instanceof InquiryCommunicationServiceError) return legacyServiceErrorResponse(error, mutation)
    req.payload.logger.error(
      { err: toLoggedError(error), event: `clinic_dashboard.legacy_inquiries.${operation}_failed` },
      'Legacy Clinic Dashboard inquiry operation failed',
    )
    return legacyErrorResponse(503, 'Inquiry service unavailable.')
  }
}

const exactLegacyQueueQuery = (req: PayloadRequest): boolean => {
  if ([...req.searchParams.keys()].some((key) => !['depth', 'limit', 'sort'].includes(key))) return false
  return (
    req.searchParams.getAll('depth').length === 1 &&
    req.searchParams.get('depth') === '1' &&
    req.searchParams.getAll('limit').length === 1 &&
    req.searchParams.get('limit') === '100' &&
    req.searchParams.getAll('sort').length === 1 &&
    req.searchParams.get('sort') === '-createdAt'
  )
}

const routeInquiryId = (req: PayloadRequest): string | null => {
  const parsed = inquiryIdSchema.safeParse(req.routeParams?.id)
  return parsed.success ? parsed.data : null
}

export const legacyPatientClinicInquiriesGetHandler: PayloadHandler = async (req) => {
  if (!exactLegacyQueueQuery(req)) return legacyErrorResponse(400, 'Invalid request.')
  const authorization = await authorizeLegacyRequest(req)
  if (authorization) return authorization
  return executeLegacy(req, 'queue_read', false, async () =>
    clinicDashboardPrivateJsonResponse(await readLegacyClinicInquiryQueue(req), 200),
  )
}

export const legacyPatientClinicInquiryGetHandler: PayloadHandler = async (req) => {
  if ([...req.searchParams.keys()].length > 0) return legacyErrorResponse(400, 'Invalid request.')
  const inquiryId = routeInquiryId(req)
  if (!inquiryId) return legacyErrorResponse(400, 'Invalid request.')
  const authorization = await authorizeLegacyRequest(req)
  if (authorization) return authorization
  return executeLegacy(req, 'detail_read', false, async () =>
    clinicDashboardPrivateJsonResponse(await readLegacyClinicInquiryDetail(req, { inquiryId }), 200),
  )
}

export const legacyPatientClinicInquiryPatchHandler: PayloadHandler = async (req) => {
  if ([...req.searchParams.keys()].length > 0) return legacyErrorResponse(400, 'Invalid request.')
  const inquiryId = routeInquiryId(req)
  if (!inquiryId) return legacyErrorResponse(400, 'Invalid request.')
  const body = typeof req.json === 'function' ? await req.json().catch(() => undefined) : undefined
  const parsed = legacyInquiryStatusInputSchema.safeParse(body)
  if (!parsed.success) return legacyErrorResponse(400, 'Invalid request.')
  const authorization = await authorizeLegacyRequest(req)
  if (authorization) return authorization
  return executeLegacy(req, 'status_update', true, async () =>
    clinicDashboardPrivateJsonResponse(
      { doc: await changeLegacyClinicInquiryStatus(req, { inquiryId, status: parsed.data.status }) },
      200,
    ),
  )
}
