import { timingSafeEqual } from 'node:crypto'
import { NextRequest } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POSTHOG_PREVIEW_EXCEPTION_TEST_HEADER = 'x-posthog-preview-exception-test-token'
export const POSTHOG_PREVIEW_EXCEPTION_TEST_MESSAGE = 'PostHog preview exception verification'

const unavailable = (): Response =>
  new Response(null, {
    headers: { 'Cache-Control': 'private, no-store' },
    status: 404,
  })

const hasValidToken = (provided: string | null, expected: string | undefined): boolean => {
  if (!provided || !expected) return false

  const providedBytes = Buffer.from(provided)
  const expectedBytes = Buffer.from(expected)
  return providedBytes.length === expectedBytes.length && timingSafeEqual(providedBytes, expectedBytes)
}

export async function POST(request: NextRequest): Promise<Response> {
  if (process.env.DEPLOYMENT_ENVIRONMENT !== 'preview') return unavailable()

  if (
    !hasValidToken(
      request.headers.get(POSTHOG_PREVIEW_EXCEPTION_TEST_HEADER),
      process.env.POSTHOG_PREVIEW_EXCEPTION_TEST_TOKEN,
    )
  ) {
    return unavailable()
  }

  throw new Error(POSTHOG_PREVIEW_EXCEPTION_TEST_MESSAGE)
}
