import type { Clinic, ClinicStaff } from '@/payload-types'
import { AUTH_FLOW_ERROR_CODES, isAuthFlowError } from '@/auth/errors/authFlowError'
import { extractTokenFromHeader, validateSupabaseBearerToken } from '@/auth/utilities/jwtValidation'
import { findUserBySupabaseId } from '@/auth/utilities/userLookup'
import type { PayloadRequest } from 'payload'
import { toLoggedError } from '@/utilities/logging/shared'

export const CLINIC_DASHBOARD_CAPABILITIES = ['clinic-profile:view', 'clinic-profile:edit'] as const

export type ClinicDashboardCapability = (typeof CLINIC_DASHBOARD_CAPABILITIES)[number]

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

const relationId = (relation: ClinicStaff['clinic']): number | string | null => {
  if (typeof relation === 'number' || typeof relation === 'string') return relation
  if (relation && typeof relation === 'object' && 'id' in relation) return relation.id
  return null
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

const readAssignedClinic = async (req: PayloadRequest, id: number | string): Promise<Clinic | null> => {
  const result = await req.payload.find({
    collection: 'clinics',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    req,
    where: { id: { equals: id } },
  })

  return (result.docs[0] as Clinic | undefined) ?? null
}

export async function resolveClinicDashboardBootstrap(req: PayloadRequest): Promise<ClinicDashboardBootstrapResult> {
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
      principalId = principal.id
    } catch (error: unknown) {
      if (isAuthFlowError(error) && error.code === AUTH_FLOW_ERROR_CODES.USER_LOOKUP_FAILED && !error.retryable) {
        return { status: 'unauthorized' }
      }

      return { status: 'unavailable' }
    }
  }

  try {
    const staff = await readCurrentClinicStaff(req, principalId)
    if (!staff?.id || !staff.email) return { status: 'unauthorized' }

    const clinicId = relationId(staff.clinic)
    if (staff.status !== 'approved' || clinicId === null) return { status: 'access-denied' }

    const clinic = await readAssignedClinic(req, clinicId)
    if (!clinic?.id || !clinic.name?.trim()) return { status: 'access-denied' }

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
        capabilities: [...CLINIC_DASHBOARD_CAPABILITIES],
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
