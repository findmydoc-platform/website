import { describe, it, expect } from 'vitest'
import { extractFileSizeFromRequest } from '@/utilities/requestFileUtils'
import type { PayloadRequest } from 'payload'

describe('extractFileSizeFromRequest', () => {
  it('returns undefined for invalid inputs', () => {
    expect(extractFileSizeFromRequest()).toBeUndefined()
    expect(extractFileSizeFromRequest(null as unknown as PayloadRequest)).toBeUndefined()
    expect(extractFileSizeFromRequest('bad' as unknown as PayloadRequest)).toBeUndefined()
  })

  it('reads size from single file shape', () => {
    const req = { file: { size: 42 } }
    expect(extractFileSizeFromRequest(req)).toBe(42)
  })

  it('reads size from array of files', () => {
    const req = { files: [{ size: 99 }, { size: 100 }] }
    expect(extractFileSizeFromRequest(req)).toBe(99)
  })

  it('reads size from object of file arrays', () => {
    const req = { files: { upload: [{ size: 123 }] } }
    expect(extractFileSizeFromRequest(req)).toBe(123)
  })

  it('reads size from object of single file entries', () => {
    const req = { files: { upload: { size: 777 } } }
    expect(extractFileSizeFromRequest(req)).toBe(777)
  })

  it('returns undefined when no size is present', () => {
    const req = { files: [{ name: 'nofile' }] }
    expect(extractFileSizeFromRequest(req)).toBeUndefined()
  })
})
