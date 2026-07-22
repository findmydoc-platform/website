import type { DashboardUserType } from './Seeding/SeedingCardView'

type DashboardUserLike = {
  collection?: unknown
  userType?: unknown
}

const isDashboardUserType = (value: unknown): value is DashboardUserType => {
  return value === 'platform' || value === 'clinic' || value === 'patient' || value === 'unknown'
}

export const resolveDashboardUserType = (user: DashboardUserLike | null | undefined): DashboardUserType => {
  const rawUserType = user?.userType
  if (isDashboardUserType(rawUserType)) return rawUserType

  const rawCollection = user?.collection
  if (rawCollection === 'platformStaff') return 'platform'
  if (rawCollection === 'patients') return 'patient'
  if (rawCollection === 'clinicStaff') return 'clinic'
  return 'unknown'
}
