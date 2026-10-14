import type { PayloadHandler } from 'payload'
import { revalidateClinicDashboardRequest } from '@/features/clinicDashboard/authorization'
import { clinicReviewDetailIdSchema, clinicReviewDetailSchema } from '@/features/clinicDashboard/reviews/contracts'
import { readClinicReviewDetail } from '@/features/clinicDashboard/reviews/service'
import { CLINIC_DASHBOARD_PRIVATE_LIVE_HEADERS } from './clinicDashboardBootstrap'

const response = (body: unknown, status: number) =>
  Response.json(body, { status, headers: CLINIC_DASHBOARD_PRIVATE_LIVE_HEADERS })
export const clinicDashboardReviewGetHandler: PayloadHandler = async (req) => {
  const id = clinicReviewDetailIdSchema.safeParse(String(req.routeParams?.id ?? ''))
  if (!id.success || new URL(req.url ?? 'http://localhost:3000').search)
    return response({ error: { code: 'INVALID_INPUT' } }, 400)
  try {
    const authorization = await revalidateClinicDashboardRequest(req, 'inquiry')
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
    const detail = await readClinicReviewDetail(req, id.data)
    return detail
      ? response({ data: clinicReviewDetailSchema.parse(detail) }, 200)
      : response({ error: { code: 'TARGET_UNAVAILABLE' } }, 404)
  } catch {
    return response({ error: { code: 'SERVICE_UNAVAILABLE' } }, 503)
  }
}
