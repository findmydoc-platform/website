import { createHmac, timingSafeEqual } from 'node:crypto'

export type CmsRedirectResult = { status: 200 | 301 | 302; path: string }

export const CMS_TRANSLATION_SOURCE_HEADER = 'x-fmd-cms-translation-source'

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
