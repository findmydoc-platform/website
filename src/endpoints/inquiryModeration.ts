import type { PayloadHandler, PayloadRequest } from 'payload'
import type { ZodType } from 'zod'

import { revalidateClinicDashboardRequest } from '@/features/clinicDashboard/authorization'
import { resolveClinicDashboardContract } from '@/features/clinicDashboard/contractNegotiation'
import {
  inquiryModerationAccessExpandInputSchema,
  inquiryModerationAppealDecisionInputSchema,
  inquiryModerationAppealInputSchema,
  inquiryModerationCaseReadInputSchema,
  inquiryModerationDecisionInputSchema,
  inquiryModerationReportInputSchema,
} from '@/features/inquiryModeration/contracts'
import {
  createInquiryModerationReport,
  decideInquiryModerationAppeal,
  decideInquiryModerationCase,
  expandInquiryModerationAccess,
  InquiryModerationServiceError,
  readInquiryModerationCase,
  submitInquiryModerationAppeal,
} from '@/features/inquiryModeration/service'
import { toLoggedError } from '@/utilities/logging/shared'

const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store',
  Expires: '0',
  Pragma: 'no-cache',
  Vary: 'Authorization, Cookie',
} as const

const CLINIC_PRIVATE_HEADERS = {
  ...PRIVATE_HEADERS,
  Vary: 'Authorization, X-Findmydoc-Clinic-Dashboard-Contract',
} as const

const response = (body: unknown, status: number, headers: HeadersInit = PRIVATE_HEADERS): Response =>
  Response.json(body, { headers, status })

const errorResponse = (code: string, status: number, headers: HeadersInit = PRIVATE_HEADERS): Response =>
  response({ error: { code } }, status, headers)

const readBody = async <Value>(
  req: PayloadRequest,
  schema: ZodType<Value>,
  headers: HeadersInit = PRIVATE_HEADERS,
): Promise<Response | Value> => {
  const body = typeof req.json === 'function' ? await req.json().catch(() => undefined) : undefined
  const parsed = schema.safeParse(body)
  return parsed.success ? parsed.data : errorResponse('MODERATION_INVALID_INPUT', 400, headers)
}

const serviceErrorResponse = (
  error: InquiryModerationServiceError,
  headers: HeadersInit = PRIVATE_HEADERS,
): Response => {
  const descriptions = {
    'access-denied': ['MODERATION_ACCESS_DENIED', 403],
    conflict: ['MODERATION_CONFLICT', 409],
    'invalid-input': ['MODERATION_INVALID_INPUT', 400],
    'invalid-state': ['MODERATION_INVALID_STATE', 409],
    'not-found': ['MODERATION_NOT_FOUND', 404],
    unauthorized: ['MODERATION_UNAUTHORIZED', 401],
    unavailable: ['MODERATION_SERVICE_UNAVAILABLE', 503],
  } as const
  const [code, status] = descriptions[error.kind]
  return errorResponse(code, status, headers)
}

const run = async <Value>(
  req: PayloadRequest,
  operation: () => Promise<Value>,
  options: { event: string; headers?: HeadersInit; status?: number },
): Promise<Response> => {
  const headers = options.headers ?? PRIVATE_HEADERS
  try {
    return response(await operation(), options.status ?? 200, headers)
  } catch (error: unknown) {
    if (error instanceof InquiryModerationServiceError) return serviceErrorResponse(error, headers)
    req.payload.logger.error({ err: toLoggedError(error), event: options.event }, 'Inquiry moderation request failed')
    return errorResponse('MODERATION_SERVICE_UNAVAILABLE', 503, headers)
  }
}

const authorizePatient = (req: PayloadRequest): Response | null => {
  if (!req.user) return errorResponse('MODERATION_UNAUTHORIZED', 401)
  if (req.user.collection !== 'patients') return errorResponse('MODERATION_ACCESS_DENIED', 403)
  return null
}

const authorizeClinic = async (req: PayloadRequest): Promise<Response | null> => {
  if (resolveClinicDashboardContract(req.headers) !== 'inquiry') {
    return errorResponse('MODERATION_INVALID_INPUT', 400, CLINIC_PRIVATE_HEADERS)
  }
  const authorization = await revalidateClinicDashboardRequest(req, 'inquiry')
  if (authorization.status === 'unauthorized') {
    return errorResponse('MODERATION_UNAUTHORIZED', 401, CLINIC_PRIVATE_HEADERS)
  }
  if (authorization.status === 'unavailable') {
    return errorResponse('MODERATION_SERVICE_UNAVAILABLE', 503, CLINIC_PRIVATE_HEADERS)
  }
  if (authorization.status !== 'authorized' || !authorization.data.capabilities.includes('clinic-inquiries:view')) {
    return errorResponse('MODERATION_ACCESS_DENIED', 403, CLINIC_PRIVATE_HEADERS)
  }
  return null
}

const authorizePlatform = (req: PayloadRequest): Response | null => {
  if (!req.user) return errorResponse('MODERATION_UNAUTHORIZED', 401)
  if (req.user.collection !== 'platformStaff') return errorResponse('MODERATION_ACCESS_DENIED', 403)
  return null
}

export const patientInquiryReportPostHandler: PayloadHandler = async (req) => {
  const denied = authorizePatient(req)
  if (denied) return denied
  const input = await readBody(req, inquiryModerationReportInputSchema)
  if (input instanceof Response) return input
  return run(req, () => createInquiryModerationReport(req, input), {
    event: 'patient.inquiry_moderation.report_failed',
    status: 201,
  })
}

export const clinicInquiryReportPostHandler: PayloadHandler = async (req) => {
  const denied = await authorizeClinic(req)
  if (denied) return denied
  const input = await readBody(req, inquiryModerationReportInputSchema, CLINIC_PRIVATE_HEADERS)
  if (input instanceof Response) return input
  return run(req, () => createInquiryModerationReport(req, input), {
    event: 'clinic.inquiry_moderation.report_failed',
    headers: CLINIC_PRIVATE_HEADERS,
    status: 201,
  })
}

export const patientInquiryAppealPostHandler: PayloadHandler = async (req) => {
  const denied = authorizePatient(req)
  if (denied) return denied
  const input = await readBody(req, inquiryModerationAppealInputSchema)
  if (input instanceof Response) return input
  return run(req, () => submitInquiryModerationAppeal(req, input), {
    event: 'patient.inquiry_moderation.appeal_failed',
    status: 201,
  })
}

export const clinicInquiryAppealPostHandler: PayloadHandler = async (req) => {
  const denied = await authorizeClinic(req)
  if (denied) return denied
  const input = await readBody(req, inquiryModerationAppealInputSchema, CLINIC_PRIVATE_HEADERS)
  if (input instanceof Response) return input
  return run(req, () => submitInquiryModerationAppeal(req, input), {
    event: 'clinic.inquiry_moderation.appeal_failed',
    headers: CLINIC_PRIVATE_HEADERS,
    status: 201,
  })
}

export const platformInquiryModerationCaseReadPostHandler: PayloadHandler = async (req) => {
  const denied = authorizePlatform(req)
  if (denied) return denied
  const input = await readBody(req, inquiryModerationCaseReadInputSchema)
  if (input instanceof Response) return input
  return run(req, () => readInquiryModerationCase(req, input), {
    event: 'platform.inquiry_moderation.case_read_failed',
  })
}

export const platformInquiryModerationAccessExpandPostHandler: PayloadHandler = async (req) => {
  const denied = authorizePlatform(req)
  if (denied) return denied
  const input = await readBody(req, inquiryModerationAccessExpandInputSchema)
  if (input instanceof Response) return input
  return run(req, () => expandInquiryModerationAccess(req, input), {
    event: 'platform.inquiry_moderation.access_expand_failed',
  })
}

export const platformInquiryModerationDecisionPostHandler: PayloadHandler = async (req) => {
  const denied = authorizePlatform(req)
  if (denied) return denied
  const input = await readBody(req, inquiryModerationDecisionInputSchema)
  if (input instanceof Response) return input
  return run(req, () => decideInquiryModerationCase(req, input), {
    event: 'platform.inquiry_moderation.decision_failed',
  })
}

export const platformInquiryModerationAppealDecisionPostHandler: PayloadHandler = async (req) => {
  const denied = authorizePlatform(req)
  if (denied) return denied
  const input = await readBody(req, inquiryModerationAppealDecisionInputSchema)
  if (input instanceof Response) return input
  return run(req, () => decideInquiryModerationAppeal(req, input), {
    event: 'platform.inquiry_moderation.appeal_decision_failed',
  })
}
