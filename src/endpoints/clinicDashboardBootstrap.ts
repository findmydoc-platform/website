import type { PayloadHandler } from 'payload'
import { resolveClinicDashboardBootstrap } from '@/features/clinicDashboard/bootstrap'
import {
  CLINIC_DASHBOARD_CONTRACT_HEADER,
  resolveClinicDashboardContract,
} from '@/features/clinicDashboard/contractNegotiation'

export const CLINIC_DASHBOARD_ERROR_CODES = {
  accessDenied: 'CLINIC_DASHBOARD_ACCESS_DENIED',
  invalidContract: 'CLINIC_DASHBOARD_INVALID_CONTRACT',
  temporarilyUnavailable: 'CLINIC_DASHBOARD_TEMPORARILY_UNAVAILABLE',
  unauthorized: 'CLINIC_DASHBOARD_UNAUTHORIZED',
} as const

export const CLINIC_DASHBOARD_PRIVATE_LIVE_HEADERS = {
  'Cache-Control': 'private, no-store',
  Expires: '0',
  Pragma: 'no-cache',
  Vary: `Authorization, ${CLINIC_DASHBOARD_CONTRACT_HEADER}`,
} as const

export const clinicDashboardPrivateJsonResponse = (body: unknown, status: number): Response =>
  Response.json(body, { status, headers: CLINIC_DASHBOARD_PRIVATE_LIVE_HEADERS })

export const clinicDashboardBootstrapGetHandler: PayloadHandler = async (req) => {
  const contract = resolveClinicDashboardContract(req.headers)
  if (contract === 'invalid') {
    return clinicDashboardPrivateJsonResponse({ error: { code: CLINIC_DASHBOARD_ERROR_CODES.invalidContract } }, 400)
  }
  const result = await resolveClinicDashboardBootstrap(req, contract)

  switch (result.status) {
    case 'success':
      return clinicDashboardPrivateJsonResponse(result.data, 200)
    case 'access-denied':
      return clinicDashboardPrivateJsonResponse({ error: { code: CLINIC_DASHBOARD_ERROR_CODES.accessDenied } }, 403)
    case 'unavailable':
      return clinicDashboardPrivateJsonResponse(
        { error: { code: CLINIC_DASHBOARD_ERROR_CODES.temporarilyUnavailable } },
        503,
      )
    case 'unauthorized':
      return clinicDashboardPrivateJsonResponse({ error: { code: CLINIC_DASHBOARD_ERROR_CODES.unauthorized } }, 401)
  }
}
