import { describe, expect, test } from 'vitest'
import { DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT } from '@/app/api/auth/register/first-admin/route'

describe('/api/auth/register/first-admin', () => {
  test.each([
    ['DELETE', DELETE],
    ['GET', GET],
    ['HEAD', HEAD],
    ['OPTIONS', OPTIONS],
    ['PATCH', PATCH],
    ['POST', POST],
    ['PUT', PUT],
  ])('returns a bare 404 for %s', async (_method, handler) => {
    const response = handler()

    expect(response.status).toBe(404)
    expect(await response.text()).toBe('')
  })
})
