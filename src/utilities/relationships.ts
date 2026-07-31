export const getRelationshipName = (value: unknown): string => {
  if (!value || typeof value !== 'object' || !('name' in value)) return ''

  const name = (value as { name?: unknown }).name
  return typeof name === 'string' ? name.trim() : ''
}
