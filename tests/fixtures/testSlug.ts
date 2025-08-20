/**
 * Deterministic slug utility for test data
 * @param fileName Name of the test file
 * @param base Optional base string
 * @returns Slug string
 */
export function testSlug(fileName: string, base?: string): string {
  const name = fileName.replace(/\.[^/.]+$/, '')
  return `${base ? base + '-' : ''}test-${name}`.toLowerCase()
}
