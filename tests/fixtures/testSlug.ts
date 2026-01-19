/**
 * Deterministic slug utility for test data
 * @param fileName Name of the test file
 * @param base Optional base string
 * @returns Slug string
 */
export function testSlug(fileName: string, base?: string): string {
  const fileNameBase = fileName.replace(/\.[^/.]+$/, '')
  const raw = `${base ? base + '-' : ''}test-${fileNameBase}`.toLowerCase()

  return raw
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')
}
