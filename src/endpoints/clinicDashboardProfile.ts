import type { PayloadHandler, PayloadRequest } from 'payload'
import type { ZodType } from 'zod'

import { resolveClinicDashboardBootstrap } from '@/features/clinicDashboard/bootstrap'
import {
  clinicProfileDraftCreateInputSchema,
  clinicProfileDraftDiscardInputSchema,
  clinicProfileDraftSaveInputSchema,
  clinicProfilePublishInputSchema,
} from '@/features/clinicDashboard/profile/contracts'
import {
  ClinicProfileServiceError,
  createClinicProfileDraft,
  discardClinicProfileDraft,
  publishClinicProfileDraft,
  readClinicProfileSnapshot,
  saveClinicProfileDraft,
} from '@/features/clinicDashboard/profile/service'
import { toLoggedError } from '@/utilities/logging/shared'
import { CLINIC_DASHBOARD_ERROR_CODES, clinicDashboardPrivateJsonResponse } from './clinicDashboardBootstrap'

export const CLINIC_PROFILE_ERROR_CODES = {
  conflict: 'CLINIC_PROFILE_CONFLICT',
  invalidInput: 'CLINIC_PROFILE_INVALID_INPUT',
  notFound: 'CLINIC_PROFILE_DRAFT_NOT_FOUND',
} as const

type AuthorizedClinic =
  | { ok: true; clinicId: string }
  | {
      ok: false
      response: Response
    }

const authorizeClinic = async (req: PayloadRequest): Promise<AuthorizedClinic> => {
  const result = await resolveClinicDashboardBootstrap(req)

  switch (result.status) {
    case 'success':
      return { ok: true, clinicId: result.data.clinic.id }
    case 'access-denied':
      return {
        ok: false,
        response: clinicDashboardPrivateJsonResponse(
          { error: { code: CLINIC_DASHBOARD_ERROR_CODES.accessDenied } },
          403,
        ),
      }
    case 'unavailable':
      return {
        ok: false,
        response: clinicDashboardPrivateJsonResponse(
          { error: { code: CLINIC_DASHBOARD_ERROR_CODES.temporarilyUnavailable } },
          503,
        ),
      }
    case 'unauthorized':
      return {
        ok: false,
        response: clinicDashboardPrivateJsonResponse(
          { error: { code: CLINIC_DASHBOARD_ERROR_CODES.unauthorized } },
          401,
        ),
      }
  }
}

const serviceErrorResponse = (error: ClinicProfileServiceError): Response => {
  switch (error.kind) {
    case 'conflict':
      return clinicDashboardPrivateJsonResponse({ error: { code: CLINIC_PROFILE_ERROR_CODES.conflict } }, 409)
    case 'invalid-input':
      return clinicDashboardPrivateJsonResponse({ error: { code: CLINIC_PROFILE_ERROR_CODES.invalidInput } }, 422)
    case 'not-found':
      return clinicDashboardPrivateJsonResponse({ error: { code: CLINIC_PROFILE_ERROR_CODES.notFound } }, 404)
    case 'unavailable':
      return clinicDashboardPrivateJsonResponse(
        { error: { code: CLINIC_DASHBOARD_ERROR_CODES.temporarilyUnavailable } },
        503,
      )
  }
}

const unexpectedErrorResponse = (req: PayloadRequest, error: unknown, operation: string): Response => {
  req.payload.logger.error(
    {
      err: toLoggedError(error),
      event: `clinic_dashboard.profile.${operation}_failed`,
    },
    'Clinic Dashboard profile operation failed',
  )

  return clinicDashboardPrivateJsonResponse(
    { error: { code: CLINIC_DASHBOARD_ERROR_CODES.temporarilyUnavailable } },
    503,
  )
}

const readBody = async <T>(req: PayloadRequest, schema: ZodType<T>): Promise<T | Response> => {
  const body = typeof req.json === 'function' ? await req.json().catch(() => undefined) : undefined
  const parsed = schema.safeParse(body)

  return parsed.success
    ? parsed.data
    : clinicDashboardPrivateJsonResponse({ error: { code: CLINIC_PROFILE_ERROR_CODES.invalidInput } }, 400)
}

export const clinicDashboardProfileGetHandler: PayloadHandler = async (req) => {
  const authorization = await authorizeClinic(req)
  if (!authorization.ok) return authorization.response

  try {
    return clinicDashboardPrivateJsonResponse(await readClinicProfileSnapshot(req, authorization.clinicId), 200)
  } catch (error: unknown) {
    if (error instanceof ClinicProfileServiceError) return serviceErrorResponse(error)
    return unexpectedErrorResponse(req, error, 'read')
  }
}

export const clinicDashboardProfileDraftPutHandler: PayloadHandler = async (req) => {
  const authorization = await authorizeClinic(req)
  if (!authorization.ok) return authorization.response

  const input = await readBody(req, clinicProfileDraftSaveInputSchema)
  if (input instanceof Response) return input

  try {
    return clinicDashboardPrivateJsonResponse(await saveClinicProfileDraft(req, authorization.clinicId, input), 200)
  } catch (error: unknown) {
    if (error instanceof ClinicProfileServiceError) return serviceErrorResponse(error)
    return unexpectedErrorResponse(req, error, 'save')
  }
}

export const clinicDashboardProfileDraftPostHandler: PayloadHandler = async (req) => {
  const authorization = await authorizeClinic(req)
  if (!authorization.ok) return authorization.response

  const input = await readBody(req, clinicProfileDraftCreateInputSchema)
  if (input instanceof Response) return input

  try {
    return clinicDashboardPrivateJsonResponse(await createClinicProfileDraft(req, authorization.clinicId, input), 201)
  } catch (error: unknown) {
    if (error instanceof ClinicProfileServiceError) return serviceErrorResponse(error)
    return unexpectedErrorResponse(req, error, 'create')
  }
}

export const clinicDashboardProfileDraftDiscardPostHandler: PayloadHandler = async (req) => {
  const authorization = await authorizeClinic(req)
  if (!authorization.ok) return authorization.response

  const input = await readBody(req, clinicProfileDraftDiscardInputSchema)
  if (input instanceof Response) return input

  try {
    return clinicDashboardPrivateJsonResponse(await discardClinicProfileDraft(req, authorization.clinicId, input), 200)
  } catch (error: unknown) {
    if (error instanceof ClinicProfileServiceError) return serviceErrorResponse(error)
    return unexpectedErrorResponse(req, error, 'discard')
  }
}

export const clinicDashboardProfilePublishPostHandler: PayloadHandler = async (req) => {
  const authorization = await authorizeClinic(req)
  if (!authorization.ok) return authorization.response

  const input = await readBody(req, clinicProfilePublishInputSchema)
  if (input instanceof Response) return input

  try {
    return clinicDashboardPrivateJsonResponse(await publishClinicProfileDraft(req, authorization.clinicId, input), 200)
  } catch (error: unknown) {
    if (error instanceof ClinicProfileServiceError) return serviceErrorResponse(error)
    return unexpectedErrorResponse(req, error, 'publish')
  }
}
