import { describe, expect, test } from 'vitest'
import { POST } from '@/app/api/auth/register/first-admin/route'

describe('POST /api/auth/register/first-admin', () => {
  test('returns a bare 404 for the public first-admin endpoint', async () => {
    const response = POST()

    expect(response.status).toBe(404)
    expect(await response.text()).toBe('')
  })
})
