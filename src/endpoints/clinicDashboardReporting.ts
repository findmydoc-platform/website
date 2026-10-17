import type { PayloadHandler, PayloadRequest } from 'payload'
import { parseReportingPeriodDays, resolveClinicDashboardReporting } from '@/features/clinicDashboard/reporting/service'
import { CLINIC_SCOPE_CONTRACT_HEADER, hasClinicScopeContract } from '@/features/clinicDashboard/contractNegotiation'

const REPORTING_PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store',
  Expires: '0',
  Pragma: 'no-cache',
  Vary: `Authorization, ${CLINIC_SCOPE_CONTRACT_HEADER}`,
} as const

const errorResponse = (
  code:
    | 'CLINIC_DASHBOARD_REPORTING_INVALID_INPUT'
    | 'CLINIC_DASHBOARD_UNAUTHORIZED'
    | 'CLINIC_DASHBOARD_ACCESS_DENIED'
    | 'CLINIC_DASHBOARD_TEMPORARILY_UNAVAILABLE',
  message: string,
  status: number,
): Response => Response.json({ error: { code, message } }, { headers: REPORTING_PRIVATE_HEADERS, status })

const hasOnlyPeriodDays = (req: PayloadRequest): boolean =>
  [...req.searchParams.keys()].every((key) => key === 'periodDays')

const reportingInput = (req: PayloadRequest) => {
  if (!hasOnlyPeriodDays(req)) return undefined
  const values = req.searchParams.getAll('periodDays')
  if (values.length !== 1) return undefined
  return parseReportingPeriodDays(values[0])
}

export const clinicDashboardReportingGetHandler: PayloadHandler = async (req) => {
  if (!hasClinicScopeContract(req.headers)) {
    return Response.json(
      { error: { code: 'CLINIC_DASHBOARD_INVALID_CONTRACT' } },
      { status: 400, headers: REPORTING_PRIVATE_HEADERS },
    )
  }
  const clinicId = req.routeParams?.clinicId
  if (typeof clinicId !== 'string' || !/^[1-9]\d*$/u.test(clinicId) || !Number.isSafeInteger(Number(clinicId))) {
    return errorResponse('CLINIC_DASHBOARD_REPORTING_INVALID_INPUT', 'A valid clinic target is required.', 400)
  }
  const periodDays = reportingInput(req)
  if (!periodDays) {
    return errorResponse('CLINIC_DASHBOARD_REPORTING_INVALID_INPUT', 'Reporting period must be 7, 30, or 90 days.', 400)
  }

  let result: Awaited<ReturnType<typeof resolveClinicDashboardReporting>>
  try {
    result = await resolveClinicDashboardReporting(req, clinicId, periodDays)
  } catch {
    return errorResponse('CLINIC_DASHBOARD_TEMPORARILY_UNAVAILABLE', 'Reporting is temporarily unavailable.', 503)
  }
  switch (result.status) {
    case 'success':
      return Response.json(result.data, { headers: REPORTING_PRIVATE_HEADERS, status: 200 })
    case 'unauthorized':
      return errorResponse('CLINIC_DASHBOARD_UNAUTHORIZED', 'Authentication is required.', 401)
    case 'access-denied':
      return errorResponse('CLINIC_DASHBOARD_ACCESS_DENIED', 'Reporting access is not available.', 403)
    case 'unavailable':
      return errorResponse('CLINIC_DASHBOARD_TEMPORARILY_UNAVAILABLE', 'Reporting is temporarily unavailable.', 503)
  }
}
