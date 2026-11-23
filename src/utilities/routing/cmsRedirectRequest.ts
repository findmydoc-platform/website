import { createHmac, timingSafeEqual } from 'node:crypto'

export const CMS_REDIRECT_RESOLVER_PATH = '/api/internal/cms-redirects'

export function cmsRedirectRequestToken(): string | null {
  const secret = process.env.PAYLOAD_SECRET
  return secret ? createHmac('sha256', secret).update('cms-permanent-redirect:v1').digest('hex') : null
}

export function isCmsRedirectRequestAuthorized(request: Request): boolean {
  const expected = cmsRedirectRequestToken()
  const supplied = request.headers.get('authorization')
  const signature = supplied?.match(/^Bearer ([a-f0-9]{64})$/)?.[1]
  return !!expected && !!signature && timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'))
}
