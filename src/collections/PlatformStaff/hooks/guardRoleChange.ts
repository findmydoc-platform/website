import type { CollectionBeforeChangeHook } from 'payload'

type PlatformStaffRole = 'admin' | 'content-manager' | 'support'

const isPlatformStaffRole = (value: unknown): value is PlatformStaffRole =>
  value === 'admin' || value === 'content-manager' || value === 'support'

const isTrustedPlatformStaffOps = (context: unknown): boolean =>
  Boolean(
    context &&
    typeof context === 'object' &&
    (context as { trustedPlatformStaffOps?: unknown }).trustedPlatformStaffOps === true,
  )

export const guardPlatformStaffRoleChange: CollectionBeforeChangeHook = async ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  const requestedRole = data.role
  const previousRole = originalDoc?.role

  if (!isPlatformStaffRole(requestedRole) || requestedRole === previousRole) return data
  if (isTrustedPlatformStaffOps(req.context)) return data

  if (operation === 'create') {
    throw new Error('Platform staff accounts must be provisioned through the trusted operations path')
  }

  if (!req.user || req.user.collection !== 'platformStaff') {
    throw new Error('Only an administrator may change a platform staff role')
  }

  if (String(req.user.id) === String(originalDoc?.id)) {
    throw new Error('Platform staff may not change their own role')
  }

  const actor = await req.payload.findByID({
    collection: 'platformStaff',
    depth: 0,
    id: req.user.id,
    overrideAccess: true,
    req,
    select: { role: true },
  })

  if (actor.role !== 'admin') {
    throw new Error('Only an administrator may change a platform staff role')
  }

  return data
}
