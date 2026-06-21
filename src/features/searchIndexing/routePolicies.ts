export type NoindexFollowRobots = {
  index: false
  follow: true
}

export type IndexingPolicyReason = 'canonical-route' | 'query-variant'

export type IndexingPolicyResult = {
  canonicalPath: string
  robots?: NoindexFollowRobots
  reason?: IndexingPolicyReason
}

export type RouteSearchParams = Record<string, string | string[] | undefined> | URLSearchParams | null | undefined

export const NOINDEX_FOLLOW_ROBOTS: NoindexFollowRobots = {
  index: false,
  follow: true,
}

export function hasRouteSearchParams(searchParams: RouteSearchParams): boolean {
  if (!searchParams) return false

  if (typeof (searchParams as URLSearchParams).keys === 'function') {
    return !((searchParams as URLSearchParams).keys().next().done ?? true)
  }

  return Object.keys(searchParams).length > 0
}
