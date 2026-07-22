import type { PayloadHandler } from 'payload'
import { resolveClinicDashboardBootstrap } from '@/features/clinicDashboard/bootstrap'

export const CLINIC_DASHBOARD_ERROR_CODES = {
  accessDenied: 'CLINIC_DASHBOARD_ACCESS_DENIED',
  temporarilyUnavailable: 'CLINIC_DASHBOARD_TEMPORARILY_UNAVAILABLE',
  unauthorized: 'CLINIC_DASHBOARD_UNAUTHORIZED',
} as const

const PRIVATE_LIVE_HEADERS = {
  'Cache-Control': 'private, no-store',
  Expires: '0',
  Pragma: 'no-cache',
  Vary: 'Authorization',
} as const

const jsonResponse = (body: unknown, status: number): Response =>
  Response.json(body, { status, headers: PRIVATE_LIVE_HEADERS })

export const clinicDashboardBootstrapGetHandler: PayloadHandler = async (req) => {
  const result = await resolveClinicDashboardBootstrap(req)

  switch (result.status) {
    case 'success':
      return jsonResponse(result.data, 200)
    case 'access-denied':
      return jsonResponse({ error: { code: CLINIC_DASHBOARD_ERROR_CODES.accessDenied } }, 403)
    case 'unavailable':
      return jsonResponse({ error: { code: CLINIC_DASHBOARD_ERROR_CODES.temporarilyUnavailable } }, 503)
    case 'unauthorized':
      return jsonResponse({ error: { code: CLINIC_DASHBOARD_ERROR_CODES.unauthorized } }, 401)
  }
}
