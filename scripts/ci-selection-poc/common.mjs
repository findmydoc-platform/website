const STATUSES = new Set(['M', 'A', 'D', 'R', 'C', 'T'])

const safePath = (value) =>
  typeof value === 'string' &&
  value.length > 0 &&
  !value.startsWith('/') &&
  !value.includes('\\') &&
  !value.includes('\0') &&
  !value.split('/').some((part) => part === '..' || part === '.' || part === '')

export function validateInput(input) {
  if (input?.classificationFailed) return { valid: false, changes: [], reason: 'classification-failed' }
  if (!Array.isArray(input?.changes) || input.changes.length === 0)
    return { valid: false, changes: [], reason: 'missing-change-manifest' }
  for (const change of input.changes) {
    if (!change || !STATUSES.has(change.status) || !safePath(change.path))
      return { valid: false, changes: [], reason: 'invalid-change-manifest' }
    if ((change.status === 'R' || change.status === 'C') && !safePath(change.previousPath))
      return { valid: false, changes: [], reason: 'missing-previous-path' }
    if (change.previousPath !== undefined && !['R', 'C'].includes(change.status))
      return { valid: false, changes: [], reason: 'unexpected-previous-path' }
    if (change.previousPath !== undefined && !safePath(change.previousPath))
      return { valid: false, changes: [], reason: 'invalid-previous-path' }
  }
  return { valid: true, changes: input.changes, reason: 'classified' }
}
