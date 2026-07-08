import type { PayloadRequest } from 'payload'

import { getCacheRevalidationVisibilitySnapshot } from '@/utilities/cacheRevalidation/visibility'

type ExpressResponse = {
  status: (code: number) => ExpressResponse
  json: (body: unknown) => void
}

const ALLOWED_PLATFORM_STAFF_ROLES = ['admin', 'support'] as const

const respond = (res: unknown, statusCode: number, body: unknown) => {
  const response = res as ExpressResponse | undefined

  if (response && typeof response.status === 'function' && typeof response.json === 'function') {
    return response.status(statusCode).json(body)
  }

  return Response.json(body, { status: statusCode })
}

const isPlatformBasicUser = (req: PayloadRequest): boolean => {
  const user = req.user as { collection?: unknown; userType?: unknown } | null | undefined
  return Boolean(user && user.collection === 'basicUsers' && user.userType === 'platform')
}

const getPlatformBasicUserId = (req: PayloadRequest): string | number | null => {
  const user = req.user as { id?: unknown } | null | undefined
  return typeof user?.id === 'string' || typeof user?.id === 'number' ? user.id : null
}

const hasVisibilityAccess = async (req: PayloadRequest): Promise<boolean> => {
  if (!isPlatformBasicUser(req)) return false
  const userId = getPlatformBasicUserId(req)
  if (!userId) return false

  try {
    const result = await req.payload.find({
      collection: 'platformStaff',
      depth: 0,
      limit: 1,
      pagination: false,
      req,
      where: {
        and: [
          {
            user: {
              equals: userId,
            },
          },
          {
            role: {
              in: [...ALLOWED_PLATFORM_STAFF_ROLES],
            },
          },
        ],
      },
    })

    const role = (result.docs[0] as { role?: unknown } | undefined)?.role
    return role === 'admin' || role === 'support'
  } catch (error) {
    req.payload.logger.warn(
      {
        event: 'cache.revalidation.visibility.access_lookup_failed',
        scope: 'cache-revalidation.visibility',
        errorType: error instanceof Error ? error.name : typeof error,
      },
      'Unable to resolve cache revalidation visibility access',
    )
    return false
  }
}

export const cacheRevalidationVisibilityGetHandler = async (req: PayloadRequest, res?: unknown) => {
  const allowed = await hasVisibilityAccess(req)
  if (!allowed) {
    return respond(res, 403, { error: 'Access denied' })
  }

  return respond(res, 200, getCacheRevalidationVisibilitySnapshot())
}
