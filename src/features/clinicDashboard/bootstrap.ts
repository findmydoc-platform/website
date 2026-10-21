import type { ClinicStaff } from '@/payload-types'
import { AUTH_FLOW_ERROR_CODES, isAuthFlowError } from '@/auth/errors/authFlowError'
import { extractTokenFromHeader, validateSupabaseBearerToken } from '@/auth/utilities/jwtValidation'
import { findUserBySupabaseId } from '@/auth/utilities/userLookup'
import { readClinicAccessState } from '@/auth/utilities/clinicAccessState'
import { readClinicPrincipalAccess } from '@/auth/utilities/clinicPrincipalAccess'
import type { PayloadRequest } from 'payload'
import { toLoggedError } from '@/utilities/logging/shared'
import type { ClinicDashboardContract } from './contractNegotiation'
import { CLINIC_SCOPE_CONTRACT_VERSION } from './contractNegotiation'

const CLINIC_DASHBOARD_LEGACY_CAPABILITIES = [
  'clinic-profile:view',
  'clinic-profile:edit',
  'clinic-treatments:view',
  'clinic-treatments:edit',
  'clinic-gallery:view',
  'clinic-gallery:edit',
] as const

const CLINIC_DASHBOARD_INQUIRY_CAPABILITIES = ['clinic-inquiries:view', 'clinic-inquiries:edit'] as const

const CLINIC_DASHBOARD_CAPABILITIES = [
  ...CLINIC_DASHBOARD_LEGACY_CAPABILITIES,
  ...CLINIC_DASHBOARD_INQUIRY_CAPABILITIES,
] as const

export type ClinicDashboardCapability = (typeof CLINIC_DASHBOARD_CAPABILITIES)[number]

/** Internal local-only authorization projection for domains awaiting explicit clinic targets. */
export type ClinicDashboardBootstrapDTO = {
  principal: {
    id: string
    displayName: string
    email: string
  }
  clinic: {
    id: string
    name: string
  }
  status: 'approved'
  capabilities: ClinicDashboardCapability[]
}

export type ClinicDashboardBootstrapResult =
  | { status: 'success'; data: ClinicDashboardBootstrapDTO }
  | { status: 'unauthorized' }
  | { status: 'access-denied' }
  | { status: 'unavailable' }

export type ClinicScopeBootstrapDTO = {
  schemaVersion: typeof CLINIC_SCOPE_CONTRACT_VERSION
  principal: ClinicDashboardBootstrapDTO['principal']
  status: 'approved'
  clinics: Array<ClinicDashboardBootstrapDTO['clinic'] & { capabilities: ClinicDashboardCapability[] }>
}

type BootstrapFailure = { status: 'unauthorized' | 'access-denied' | 'unavailable' }

/** Binds the current Payload principal to the independently validated personal Bearer identity. */
export async function resolveClinicDashboardPrincipal(
  req: PayloadRequest,
): Promise<{ status: 'success'; principalId: number | string } | BootstrapFailure> {
  const token = extractTokenFromHeader(req.headers)
  if (!token) return { status: 'unauthorized' }
  try {
    const validation = await validateSupabaseBearerToken({ token, headers: req.headers, logger: req.payload.logger })
    if (validation.status === 'unavailable') return { status: 'unavailable' }
    if (validation.status === 'invalid' || validation.authData.userType !== 'clinic') return { status: 'unauthorized' }
    const principal =
      req.user ?? (await findUserBySupabaseId(req.payload, validation.authData, req, req.payload.logger))
    if (
      principal?.collection !== 'clinicStaff' ||
      principal.supabaseUserId?.trim() !== validation.authData.supabaseUserId
    )
      return { status: 'unauthorized' }
    req.user = principal
    return { status: 'success', principalId: principal.id }
  } catch (error: unknown) {
    if (isAuthFlowError(error) && error.code === AUTH_FLOW_ERROR_CODES.USER_LOOKUP_FAILED && !error.retryable)
      return { status: 'unauthorized' }
    return { status: 'unavailable' }
  }
}

export async function resolveClinicScopeBootstrap(
  req: PayloadRequest,
): Promise<{ status: 'success'; data: ClinicScopeBootstrapDTO } | BootstrapFailure> {
  const principal = await resolveClinicDashboardPrincipal(req)
  if (principal.status !== 'success') return principal
  try {
    const access = await readClinicPrincipalAccess(req.payload, principal.principalId, req)
    if (!access || !access.staff.email) return { status: 'access-denied' }
    if (access.clinics.some((clinic) => !clinic.name?.trim())) return { status: 'access-denied' }
    return {
      status: 'success',
      data: {
        schemaVersion: CLINIC_SCOPE_CONTRACT_VERSION,
        principal: { id: String(access.staff.id), displayName: displayName(access.staff), email: access.staff.email },
        status: 'approved',
        clinics: access.clinics
          .map((clinic) => ({
            id: String(clinic.id),
            name: clinic.name,
            capabilities: [...CLINIC_DASHBOARD_CAPABILITIES],
          }))
          .sort((a, b) => a.name.localeCompare(b.name, 'en') || a.id.localeCompare(b.id, 'en')),
      },
    }
  } catch (error: unknown) {
    req.payload.logger.error(
      { err: toLoggedError(error), event: 'clinic_dashboard.bootstrap.read_failed' },
      'Clinic Dashboard bootstrap state could not be read',
    )
    return { status: 'unavailable' }
  }
}

const displayName = (staff: ClinicStaff): string => {
  const name = [staff.firstName, staff.lastName]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(' ')

  return name || staff.email?.trim() || ''
}

const readCurrentClinicStaff = async (req: PayloadRequest, id: number | string): Promise<ClinicStaff | null> => {
  const result = await req.payload.find({
    collection: 'clinicStaff',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    req,
    where: { id: { equals: id } },
  })

  return (result.docs[0] as ClinicStaff | undefined) ?? null
}

/** Retains fail-closed local authorization for unconverted domains; never the person bootstrap wire contract. */
export async function resolveClinicDashboardBootstrap(
  req: PayloadRequest,
  contract: ClinicDashboardContract = 'legacy',
): Promise<ClinicDashboardBootstrapResult> {
  const token = extractTokenFromHeader(req.headers)
  if (!token) return { status: 'unauthorized' }

  let principalId: number | string

  if (req.user) {
    if (req.user.collection !== 'clinicStaff') return { status: 'unauthorized' }
    principalId = req.user.id
  } else {
    const validation = await validateSupabaseBearerToken({ token, headers: req.headers, logger: req.payload.logger })
    if (validation.status === 'unavailable') return { status: 'unavailable' }
    if (validation.status === 'invalid' || validation.authData.userType !== 'clinic') {
      return { status: 'unauthorized' }
    }

    try {
      const principal = await findUserBySupabaseId(req.payload, validation.authData, req, req.payload.logger)
      if (!principal || !('collection' in principal) || principal.collection !== 'clinicStaff') {
        return { status: 'unauthorized' }
      }
      req.user = principal
      principalId = principal.id
    } catch (error: unknown) {
      if (isAuthFlowError(error) && error.code === AUTH_FLOW_ERROR_CODES.USER_LOOKUP_FAILED && !error.retryable) {
        return { status: 'unauthorized' }
      }

      return { status: 'unavailable' }
    }
  }

  try {
    const accessState = await readClinicAccessState(req.payload, principalId, req)
    if (!accessState) {
      const staff = await readCurrentClinicStaff(req, principalId)
      return staff?.id && staff.email ? { status: 'access-denied' } : { status: 'unauthorized' }
    }

    const { clinic, staff } = accessState
    if (!staff.email || !clinic.name?.trim()) return { status: 'access-denied' }

    return {
      status: 'success',
      data: {
        principal: {
          id: String(staff.id),
          displayName: displayName(staff),
          email: staff.email,
        },
        clinic: {
          id: String(clinic.id),
          name: clinic.name,
        },
        status: 'approved',
        capabilities:
          contract === 'inquiry' ? [...CLINIC_DASHBOARD_CAPABILITIES] : [...CLINIC_DASHBOARD_LEGACY_CAPABILITIES],
      },
    }
  } catch (error: unknown) {
    req.payload.logger.error(
      {
        err: toLoggedError(error),
        event: 'clinic_dashboard.bootstrap.read_failed',
      },
      'Clinic Dashboard bootstrap state could not be read',
    )
    return { status: 'unavailable' }
  }
}
