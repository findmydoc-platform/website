import type { AccessArgs } from 'payload'

export const isPlatformAdminUser = (user: unknown): boolean => {
  if (!user || typeof user !== 'object') return false
  return 'collection' in user && user.collection === 'platformStaff' && 'role' in user && user.role === 'admin'
}

export const isPlatformAdmin = async ({ req }: Pick<AccessArgs, 'req'>): Promise<boolean> => {
  if (req.user?.collection !== 'platformStaff') return false

  try {
    const staff = await req.payload.findByID({
      collection: 'platformStaff',
      id: req.user.id,
      depth: 0,
      overrideAccess: true,
      req,
      select: { role: true },
    })

    return staff?.role === 'admin'
  } catch {
    req.payload?.logger?.warn('Unable to resolve current platform administrator access')
    return false
  }
}
