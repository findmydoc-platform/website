import type { PayloadHandler } from 'payload'
import {
  CLINIC_NOTIFICATIONS_CONTRACT_VERSION,
  CLINIC_NOTIFICATIONS_SUPPORT_HEADER,
} from '@/features/clinicNotifications/contracts'
import { resolveClinicScopeBootstrap } from '@/features/clinicDashboard/bootstrap'
import {
  CLINIC_DASHBOARD_CONTRACT_HEADER,
  CLINIC_SCOPE_CONTRACT_HEADER,
  hasClinicScopeContract,
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
  [CLINIC_NOTIFICATIONS_SUPPORT_HEADER]: CLINIC_NOTIFICATIONS_CONTRACT_VERSION,
  Expires: '0',
  Pragma: 'no-cache',
  Vary: `Authorization, ${CLINIC_DASHBOARD_CONTRACT_HEADER}`,
} as const

export const clinicDashboardPrivateJsonResponse = (body: unknown, status: number): Response =>
  Response.json(body, { status, headers: CLINIC_DASHBOARD_PRIVATE_LIVE_HEADERS })

const clinicScopePrivateJsonResponse = (body: unknown, status: number): Response => {
  const response = clinicDashboardPrivateJsonResponse(body, status)
  response.headers.append('Vary', CLINIC_SCOPE_CONTRACT_HEADER)
  return response
}

export const clinicDashboardBootstrapGetHandler: PayloadHandler = async (req) => {
  const contract = resolveClinicDashboardContract(req.headers)
  if (contract === 'invalid' || !hasClinicScopeContract(req.headers)) {
    return clinicScopePrivateJsonResponse({ error: { code: CLINIC_DASHBOARD_ERROR_CODES.invalidContract } }, 400)
  }
  const result = await resolveClinicScopeBootstrap(req)

  switch (result.status) {
    case 'success':
      return clinicScopePrivateJsonResponse(result.data, 200)
    case 'access-denied':
      return clinicScopePrivateJsonResponse({ error: { code: CLINIC_DASHBOARD_ERROR_CODES.accessDenied } }, 403)
    case 'unavailable':
      return clinicScopePrivateJsonResponse(
        { error: { code: CLINIC_DASHBOARD_ERROR_CODES.temporarilyUnavailable } },
        503,
      )
    case 'unauthorized':
      return clinicScopePrivateJsonResponse({ error: { code: CLINIC_DASHBOARD_ERROR_CODES.unauthorized } }, 401)
  }
}
