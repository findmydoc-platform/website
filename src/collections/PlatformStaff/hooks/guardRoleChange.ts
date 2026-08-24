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

const normalizedCapabilities = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .filter((entry): entry is string => typeof entry === 'string')
        .sort((left, right) => left.localeCompare(right))
    : []

export const guardPlatformStaffRoleChange: CollectionBeforeChangeHook = async ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  const requestedRole = data.role
  const previousRole = originalDoc?.role
  const capabilitiesChanged =
    JSON.stringify(normalizedCapabilities(data.capabilities)) !==
    JSON.stringify(normalizedCapabilities(originalDoc?.capabilities))
  const roleChanged = isPlatformStaffRole(requestedRole) && requestedRole !== previousRole

  if (!roleChanged && !capabilitiesChanged) return data
  if (isTrustedPlatformStaffOps(req.context)) return data

  if (operation === 'create') {
    throw new Error('Platform staff accounts must be provisioned through the trusted operations path')
  }

  if (!req.user || req.user.collection !== 'platformStaff') {
    throw new Error('Only an administrator may change platform staff privileges')
  }

  if (String(req.user.id) === String(originalDoc?.id)) {
    throw new Error('Platform staff may not change their own privileges')
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
    throw new Error('Only an administrator may change platform staff privileges')
  }

  return data
}
