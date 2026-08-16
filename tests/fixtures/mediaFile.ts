import type { File } from 'payload'

// Shared tiny PNG file factory for integration upload tests.
// Use this helper whenever tests only need a valid image payload.
export function createTinyPngFile(name: string): File {
  const base64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADklEQVQImWP4DwUMMAYAj4IP8cvlVgcAAAAASUVORK5CYII='
  const data = Buffer.from(base64, 'base64')

  return {
    name,
    data,
    mimetype: 'image/png',
    size: data.length,
  }
}
