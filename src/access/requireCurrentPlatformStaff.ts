import { APIError, type PayloadRequest } from 'payload'
import { classifyDatabaseAvailabilityError } from '@/features/databaseAvailability'

export type PlatformStaffLookupOptions = { propagateDatabaseFailure?: boolean }

export async function requireCurrentPlatformStaff(
  req: PayloadRequest,
  options?: PlatformStaffLookupOptions,
): Promise<void> {
  if (req.user?.collection !== 'platformStaff') throw new APIError('Platform staff access is required.', 403)
  const staff = await req.payload
    .findByID({
      collection: 'platformStaff',
      id: req.user.id,
      depth: 0,
      overrideAccess: true,
      req,
      select: { role: true },
    })
    .catch((error: unknown) => {
      if (options?.propagateDatabaseFailure && classifyDatabaseAvailabilityError(error)) throw error
      return null
    })
  if (!staff || !['admin', 'support', 'content-manager'].includes(staff.role)) {
    throw new APIError('Platform staff access is required.', 403)
  }
}
