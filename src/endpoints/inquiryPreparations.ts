import type { PayloadHandler } from 'payload'
import { z } from 'zod'
import {
  newPreparationBinding,
  preparationCookie,
  readPreparationBinding,
} from '@/features/inquiryPreparations/context'
import {
  preparePatientInquiry,
  readInquiryPreparations,
  submitInquiryPreparation,
  InquiryCommunicationServiceError,
} from '@/features/inquiryCommunication/service'

const headers = {
  'Cache-Control': 'private, no-store',
  Vary: 'Authorization, Cookie',
  Pragma: 'no-cache',
  Expires: '0',
}
function failure(error: unknown): Response {
  const status =
    error instanceof InquiryCommunicationServiceError
      ? ((
          {
            'invalid-input': 400,
            unauthorized: 401,
            'access-denied': 403,
            'not-found': 404,
            conflict: 409,
            'invalid-state': 409,
          } as Record<string, number>
        )[error.kind] ?? 503)
      : 503
  return Response.json({ error: 'The prepared inquiry could not be processed.' }, { status, headers })
}
const sameOrigin = (req: Parameters<PayloadHandler>[0]) => req.headers.get('origin') === new URL(req.url!).origin

export const preparationPostHandler: PayloadHandler = async (req) => {
  if (!sameOrigin(req)) return new Response(null, { status: 403, headers })
  if (req.user || req.headers.has('authorization') || /sb-.*-auth-token/.test(req.headers.get('cookie') ?? ''))
    return new Response(null, { status: 401, headers })
  const binding = readPreparationBinding(req.headers) ?? newPreparationBinding()
  try {
    const result = await preparePatientInquiry(req, binding, await req.json!())
    return Response.json(result, { status: 201, headers: { ...headers, 'Set-Cookie': preparationCookie(binding) } })
  } catch (error) {
    return failure(error)
  }
}

export const preparationGetHandler: PayloadHandler = async (req) => {
  if (req.user && req.user.collection !== 'patients') return new Response(null, { status: 403, headers })
  try {
    const binding = readPreparationBinding(req.headers)
    if (!binding) return Response.json({ preparations: [], nextCursor: null }, { headers })
    const parsed = z
      .object({ cursor: z.coerce.number().int().positive().optional() })
      .strict()
      .safeParse(Object.fromEntries(req.searchParams))
    if (!parsed.success) return new Response(null, { status: 400, headers })
    return Response.json(await readInquiryPreparations(req, binding, parsed.data.cursor), { headers })
  } catch (error) {
    return failure(error)
  }
}

export const preparationSubmitHandler: PayloadHandler = async (req) => {
  if (!sameOrigin(req)) return new Response(null, { status: 403, headers })
  const binding = readPreparationBinding(req.headers)
  if (!binding) return new Response(null, { status: 403, headers })
  const parsed = z
    .object({ reference: z.string().uuid(), retry: z.boolean().default(false) })
    .strict()
    .safeParse(await req.json!().catch(() => null))
  if (!parsed.success) return new Response(null, { status: 400, headers })
  try {
    return Response.json(await submitInquiryPreparation(req, binding, parsed.data), { headers })
  } catch (error) {
    return failure(error)
  }
}
