export function sanitizeInternalRedirectPath({
  nextPath,
  fallbackPath = '/',
  blockedPaths = [],
}: {
  nextPath: string | null | undefined
  fallbackPath?: string
  blockedPaths?: string[]
}): string {
  if (!nextPath) return fallbackPath

  const trimmed = nextPath.trim()
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return fallbackPath
  if (trimmed.includes('\r') || trimmed.includes('\n')) return fallbackPath

  try {
    const parsed = new URL(trimmed, 'http://localhost')
    if (parsed.origin !== 'http://localhost') return fallbackPath

    const safePath = `${parsed.pathname}${parsed.search}${parsed.hash}`
    const safePathnameForBlockedComparison =
      parsed.pathname !== '/' && parsed.pathname.endsWith('/') ? parsed.pathname.slice(0, -1) : parsed.pathname
    const safePathForBlockedComparison = `${safePathnameForBlockedComparison}${parsed.search}${parsed.hash}`
    const normalizedBlockedPaths = blockedPaths.map((path) => (path.endsWith('/') ? path.slice(0, -1) : path))

    if (
      normalizedBlockedPaths.some((path) => {
        if (!path) return false
        return (
          safePathForBlockedComparison === path ||
          safePathForBlockedComparison.startsWith(`${path}?`) ||
          safePathForBlockedComparison.startsWith(`${path}#`)
        )
      })
    ) {
      return fallbackPath
    }

    return safePath
  } catch {
    return fallbackPath
  }
}
