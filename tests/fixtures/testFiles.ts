import { Buffer } from 'node:buffer'

const base64Png =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQI12NgYGBgAAAABQABDQottAAAAABJRU5ErkJggg=='

export const createPngFile = (name = 'test.png') => {
  const data = Buffer.from(base64Png, 'base64')
  return {
    data,
    name,
    mimetype: 'image/png',
    size: data.length,
  }
}

export const createLargeFile = (sizeInBytes: number, name = 'large.png') => {
  const data = Buffer.alloc(sizeInBytes, 0)
  return {
    data,
    name,
    mimetype: 'image/png',
    size: data.length,
  }
}
