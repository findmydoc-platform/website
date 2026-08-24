import type { PayloadRequest } from 'payload'

import { extractTokenFromHeader, validateSupabaseBearerToken } from '@/auth/utilities/jwtValidation'
import { resolveClinicDashboardBootstrap, type ClinicDashboardBootstrapDTO } from './bootstrap'
import type { ClinicDashboardContract } from './contractNegotiation'

export type ClinicDashboardAuthorizationResult =
  | { status: 'authorized'; data: ClinicDashboardBootstrapDTO }
  | { status: 'access-denied' | 'unauthorized' | 'unavailable' }

export const revalidateClinicDashboardRequest = async (
  req: PayloadRequest,
  contract: ClinicDashboardContract,
): Promise<ClinicDashboardAuthorizationResult> => {
  const token = extractTokenFromHeader(req.headers)
  if (!token) return { status: 'unauthorized' }

  const bearer = await validateSupabaseBearerToken({ token, headers: req.headers, logger: req.payload.logger })
  if (bearer.status === 'unavailable') return { status: 'unavailable' }
  if (bearer.status === 'invalid' || bearer.authData.userType !== 'clinic') return { status: 'unauthorized' }

  const bootstrap = await resolveClinicDashboardBootstrap(req, contract)
  if (bootstrap.status !== 'success') return bootstrap

  const principal = req.user
  const resolvedSubject =
    principal?.collection === 'clinicStaff' && typeof principal.supabaseUserId === 'string'
      ? principal.supabaseUserId.trim()
      : ''
  if (!resolvedSubject || resolvedSubject !== bearer.authData.supabaseUserId) return { status: 'unauthorized' }

  return { status: 'authorized', data: bootstrap.data }
}
