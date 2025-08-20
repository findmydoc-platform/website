/**
 * Convert a string into a URL-safe slug.
 * Behavior:
 * - Replace spaces with '-'
 * - Strip all characters except word chars (A-Z a-z 0-9 _), and '-'
 * - Lowercase the result
 */
export function slugify(s: string): string {
  return (s ?? '')
    .replace(/ /g, '-')
    .replace(/[^\w-]+/g, '')
    .toLowerCase()
}
