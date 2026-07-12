const hasControlCharacters = (value: string): boolean => /[\u0000-\u001F\u007F]/.test(value)

export function sanitizeInternalRedirectPathOrNull({
  nextPath,
  blockedPaths = [],
}: {
  nextPath: string | null | undefined
  blockedPaths?: string[]
}): string | null {
  if (!nextPath) return null

  const trimmed = nextPath.trim()
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return null
  if (hasControlCharacters(trimmed)) return null

  try {
    const parsed = new URL(trimmed, 'http://localhost')
    if (parsed.origin !== 'http://localhost') return null

    const safePath = `${parsed.pathname}${parsed.search}${parsed.hash}`
    const safePathnameForBlockedComparison =
      parsed.pathname !== '/' && parsed.pathname.endsWith('/') ? parsed.pathname.slice(0, -1) : parsed.pathname
    const safePathForBlockedComparison = `${safePathnameForBlockedComparison}${parsed.search}${parsed.hash}`
    const normalizedBlockedPaths = blockedPaths.map((path) =>
      path !== '/' && path.endsWith('/') ? path.slice(0, -1) : path,
    )

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
      return null
    }

    return safePath
  } catch {
    return null
  }
}

export function sanitizeInternalRedirectPath({
  nextPath,
  fallbackPath = '/',
  blockedPaths = [],
}: {
  nextPath: string | null | undefined
  fallbackPath?: string
  blockedPaths?: string[]
}): string {
  return sanitizeInternalRedirectPathOrNull({ nextPath, blockedPaths }) ?? fallbackPath
}
