import type { File } from 'payload'

// Shared tiny PNG file factory for integration upload tests.
// Use this helper whenever tests only need a valid image payload.
export function createTinyPngFile(name: string): File {
  const base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII='
  const data = Buffer.from(base64, 'base64')

  return {
    name,
    data,
    mimetype: 'image/png',
    size: data.length,
  }
}
