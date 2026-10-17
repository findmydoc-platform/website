import type { PayloadHandler } from 'payload'
import { revalidateClinicDashboardTargetRequest } from '@/features/clinicDashboard/authorization'
import { clinicReviewDetailIdSchema, clinicReviewDetailSchema } from '@/features/clinicDashboard/reviews/contracts'
import { readClinicReviewDetail } from '@/features/clinicDashboard/reviews/service'
import { hasClinicScopeContract, CLINIC_SCOPE_CONTRACT_HEADER } from '@/features/clinicDashboard/contractNegotiation'
const CLINIC_DASHBOARD_PRIVATE_LIVE_HEADERS = {
  'Cache-Control': 'private, no-store',
  Pragma: 'no-cache',
  Expires: '0',
  Vary: `Authorization, ${CLINIC_SCOPE_CONTRACT_HEADER}`,
}

const response = (body: unknown, status: number) =>
  Response.json(body, { status, headers: CLINIC_DASHBOARD_PRIVATE_LIVE_HEADERS })
export const clinicDashboardReviewGetHandler: PayloadHandler = async (req) => {
  const targetClinicId = String(req.routeParams?.clinicId ?? '')
  if (
    !hasClinicScopeContract(req.headers) ||
    !/^[1-9]\d*$/u.test(targetClinicId) ||
    !Number.isSafeInteger(Number(targetClinicId))
  )
    return response({ error: { code: 'INVALID_INPUT' } }, 400)
  const id = clinicReviewDetailIdSchema.safeParse(String(req.routeParams?.id ?? ''))
  if (!id.success || new URL(req.url ?? 'http://localhost:3000').search)
    return response({ error: { code: 'INVALID_INPUT' } }, 400)
  try {
    const authorization = await revalidateClinicDashboardTargetRequest(req, targetClinicId)
    if (authorization.status !== 'authorized') {
      const code =
        authorization.status === 'unauthorized'
          ? 'UNAUTHENTICATED'
          : authorization.status === 'access-denied'
            ? 'CONTENT_ACCESS_DENIED'
            : 'SERVICE_UNAVAILABLE'
      return response(
        { error: { code } },
        code === 'UNAUTHENTICATED' ? 401 : code === 'CONTENT_ACCESS_DENIED' ? 403 : 503,
      )
    }
    const detail = await readClinicReviewDetail(req, id.data, targetClinicId)
    return detail
      ? response({ data: clinicReviewDetailSchema.parse(detail) }, 200)
      : response({ error: { code: 'TARGET_UNAVAILABLE' } }, 404)
  } catch {
    return response({ error: { code: 'SERVICE_UNAVAILABLE' } }, 503)
  }
}
