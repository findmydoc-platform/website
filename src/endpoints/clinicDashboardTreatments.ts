import type { PayloadHandler, PayloadRequest } from 'payload'
import type { ZodType } from 'zod'

import { resolveClinicDashboardBootstrap } from '@/features/clinicDashboard/bootstrap'
import type { ClinicDashboardCapability } from '@/features/clinicDashboard/bootstrap'
import {
  clinicTreatmentCreateInputSchema,
  clinicTreatmentUpdateInputSchema,
} from '@/features/clinicDashboard/treatments/contracts'
import {
  ClinicTreatmentServiceError,
  createClinicTreatment,
  readClinicTreatmentSnapshot,
  updateClinicTreatment,
} from '@/features/clinicDashboard/treatments/service'
import { toLoggedError } from '@/utilities/logging/shared'
import { CLINIC_DASHBOARD_ERROR_CODES, clinicDashboardPrivateJsonResponse } from './clinicDashboardBootstrap'

export const CLINIC_TREATMENT_ERROR_CODES = {
  conflict: 'CLINIC_TREATMENT_CONFLICT',
  invalidInput: 'CLINIC_TREATMENT_INVALID_INPUT',
  notFound: 'CLINIC_TREATMENT_NOT_FOUND',
} as const

type AuthorizedClinic =
  | { ok: true; clinicId: string }
  | {
      ok: false
      response: Response
    }

const authorizeClinic = async (
  req: PayloadRequest,
  requiredCapability: ClinicDashboardCapability,
): Promise<AuthorizedClinic> => {
  const result = await resolveClinicDashboardBootstrap(req)

  switch (result.status) {
    case 'success':
      return result.data.capabilities.includes(requiredCapability)
        ? { ok: true, clinicId: result.data.clinic.id }
        : {
            ok: false,
            response: clinicDashboardPrivateJsonResponse(
              { error: { code: CLINIC_DASHBOARD_ERROR_CODES.accessDenied } },
              403,
            ),
          }
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

const readBody = async <T>(req: PayloadRequest, schema: ZodType<T>): Promise<T | Response> => {
  const body = typeof req.json === 'function' ? await req.json().catch(() => undefined) : undefined
  const parsed = schema.safeParse(body)
  return parsed.success
    ? parsed.data
    : clinicDashboardPrivateJsonResponse({ error: { code: CLINIC_TREATMENT_ERROR_CODES.invalidInput } }, 400)
}

const serviceErrorResponse = (error: ClinicTreatmentServiceError): Response => {
  switch (error.kind) {
    case 'conflict':
      return clinicDashboardPrivateJsonResponse({ error: { code: CLINIC_TREATMENT_ERROR_CODES.conflict } }, 409)
    case 'invalid-input':
      return clinicDashboardPrivateJsonResponse({ error: { code: CLINIC_TREATMENT_ERROR_CODES.invalidInput } }, 422)
    case 'not-found':
      return clinicDashboardPrivateJsonResponse({ error: { code: CLINIC_TREATMENT_ERROR_CODES.notFound } }, 404)
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
      event: `clinic_dashboard.treatments.${operation}_failed`,
    },
    'Clinic Dashboard treatment operation failed',
  )
  return clinicDashboardPrivateJsonResponse(
    { error: { code: CLINIC_DASHBOARD_ERROR_CODES.temporarilyUnavailable } },
    503,
  )
}

export const clinicDashboardTreatmentsGetHandler: PayloadHandler = async (req) => {
  const authorization = await authorizeClinic(req, 'clinic-treatments:view')
  if (!authorization.ok) return authorization.response

  try {
    return clinicDashboardPrivateJsonResponse(await readClinicTreatmentSnapshot(req, authorization.clinicId), 200)
  } catch (error: unknown) {
    if (error instanceof ClinicTreatmentServiceError) return serviceErrorResponse(error)
    return unexpectedErrorResponse(req, error, 'read')
  }
}

export const clinicDashboardTreatmentsPostHandler: PayloadHandler = async (req) => {
  const authorization = await authorizeClinic(req, 'clinic-treatments:edit')
  if (!authorization.ok) return authorization.response
  const input = await readBody(req, clinicTreatmentCreateInputSchema)
  if (input instanceof Response) return input

  try {
    return clinicDashboardPrivateJsonResponse(await createClinicTreatment(req, authorization.clinicId, input), 201)
  } catch (error: unknown) {
    if (error instanceof ClinicTreatmentServiceError) return serviceErrorResponse(error)
    return unexpectedErrorResponse(req, error, 'create')
  }
}

export const clinicDashboardTreatmentsPatchHandler: PayloadHandler = async (req) => {
  const authorization = await authorizeClinic(req, 'clinic-treatments:edit')
  if (!authorization.ok) return authorization.response
  const input = await readBody(req, clinicTreatmentUpdateInputSchema)
  if (input instanceof Response) return input

  try {
    return clinicDashboardPrivateJsonResponse(await updateClinicTreatment(req, authorization.clinicId, input), 200)
  } catch (error: unknown) {
    if (error instanceof ClinicTreatmentServiceError) return serviceErrorResponse(error)
    return unexpectedErrorResponse(req, error, 'update')
  }
}
