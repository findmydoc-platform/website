import type { APIRequestContext } from '@playwright/test'
import { describe, expect, it } from 'vitest'

import { buildCollectionQueryPath, getFirstCollectionDoc, getRecordId } from '../../e2e/helpers/adminApi'

const createRequestContext = (responseBody: unknown, ok = true) =>
  ({
    get: async () => ({
      json: async () => responseBody,
      ok: () => ok,
    }),
  }) as unknown as APIRequestContext

describe('admin e2e api helpers', () => {
  it('normalizes raw and populated relationship ids', () => {
    expect(getRecordId('clinic-1')).toBe('clinic-1')
    expect(getRecordId(123)).toBe(123)
    expect(getRecordId({ id: 'clinic-2' })).toBe('clinic-2')
    expect(getRecordId({ value: 456 })).toBe(456)
    expect(getRecordId({ name: 'Missing id' })).toBeUndefined()
  })

  it('builds deterministic Payload collection query paths', () => {
    expect(buildCollectionQueryPath('clinics', { status: 'approved', city: 7 })).toBe(
      '/api/clinics?depth=0&limit=1&sort=-createdAt&where%5Bstatus%5D%5Bequals%5D=approved&where%5Bcity%5D%5Bequals%5D=7',
    )
  })

  it('reads the first collection doc from a Payload list response', async () => {
    const request = createRequestContext({
      docs: [{ id: 'first' }, { id: 'second' }],
    })

    await expect(getFirstCollectionDoc(request, '/api/clinics')).resolves.toEqual({ id: 'first' })
  })
})
