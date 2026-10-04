import { createLocalReq, getPayload } from 'payload'
import configPromise from '@/payload.config'
import { resolveTransactionalEmailEnvironment } from '@/features/transactionalEmail/environment'
import { resolveAuthActionProtocolKeys } from '@/auth/actions/protocol/credentials'
import {
  authenticateProtocolHttpRequest,
  authActionProtocolResponse,
  bindAuthActionProtocol,
} from '@/auth/actions/protocol/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request, context: { params: Promise<{ operation: string }> }): Promise<Response> {
  try {
    const { operation } = await context.params
    const keys = resolveAuthActionProtocolKeys(resolveTransactionalEmailEnvironment())
    if (!(await authenticateProtocolHttpRequest(request.clone(), operation, keys)))
      return authActionProtocolResponse('invalid')
    const payload = await getPayload({ config: configPromise })
    const req = await createLocalReq({}, payload)
    return bindAuthActionProtocol(req, { keys })(request, operation)
  } catch {
    return authActionProtocolResponse('unavailable')
  }
}
