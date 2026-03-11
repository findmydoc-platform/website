import type { PayloadRequest } from 'payload'
import type { SeedType } from './utils/runtime'
import { assertSeedRunPolicy, isSeedEndpointPostEnabled, resolveSeedRuntimeEnv } from './utils/runtime'
import { buildSeedSummary } from './utils/summary'
import { revalidateTag } from 'next/cache'

interface ExpressResponse {
  status: (code: number) => ExpressResponse
  json: (body: unknown) => void
}

const postDeprecationMessage =
  'POST /api/seed is intended for local development convenience. Use the Seed Data GitHub workflow or pnpm seed:run for hosted environments.'

const postDisabledMessage =
  'POST /api/seed is disabled outside development/test by default. Use the Seed Data GitHub workflow or set SEED_ENDPOINT_ALLOW_POST=true temporarily if needed.'

const postResponseHeaders = {
  'X-Seed-Endpoint-Deprecated': 'true',
  'X-Seed-Endpoint-Message': postDeprecationMessage,
}

function revalidateNavigationGlobals(req: PayloadRequest) {
  const tags = ['global_header', 'global_footer'] as const

  for (const tag of tags) {
    try {
      revalidateTag(tag, { expire: 0 })
      req.payload.logger.info(`Revalidated seed cache tag: ${tag}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      req.payload.logger.warn(`Unable to revalidate seed cache tag ${tag}: ${message}`)
    }
  }
}

/** POST /seed: local dev convenience only (platform role). Prefer seed CLI/workflow for hosted environments. */
export const seedPostHandler = async (req: PayloadRequest, res?: unknown) => {
  const payloadInstance = req.payload
  const start = Date.now()
  const type = (req.query.type as SeedType | undefined) ?? 'baseline'
  const reset = req.query.reset === '1'
  const runtimeEnv = resolveSeedRuntimeEnv(undefined, process.env)

  const respond = (statusCode: number, body: unknown, extraHeaders?: Record<string, string>) => {
    const r = res as ExpressResponse | undefined
    const headers = { 'Content-Type': 'application/json', ...(extraHeaders ?? {}) }
    if (r && typeof r.status === 'function' && typeof r.json === 'function') {
      return r.status(statusCode).json(body)
    }
    return new Response(JSON.stringify(body), {
      status: statusCode,
      headers,
    })
  }

  try {
    const userType = (req.user as { userType?: string } | null | undefined)?.userType
    if (!userType || userType !== 'platform') {
      return respond(403, { error: 'Forbidden' })
    }

    if (type !== 'baseline' && type !== 'demo') {
      return respond(400, { error: 'Invalid type parameter' }, postResponseHeaders)
    }

    if (!isSeedEndpointPostEnabled(runtimeEnv, process.env)) {
      return respond(405, { error: postDisabledMessage }, postResponseHeaders)
    }

    try {
      assertSeedRunPolicy({ runtimeEnv, type, reset })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return respond(400, { error: message }, postResponseHeaders)
    }

    payloadInstance.logger.warn(postDeprecationMessage)

    const { runBaselineSeeds } = await import('./baseline')
    const { runDemoSeeds } = await import('./demo')

    if (type === 'baseline') {
      const results = await runBaselineSeeds(payloadInstance, { reset, req })
      revalidateNavigationGlobals(req)
      const summary = buildSeedSummary({ type, reset, startedAtMs: start, result: results })

      ;(global as unknown as Record<string, unknown>).__lastSeedRun = summary

      // Baseline always returns HTTP 200 with a status field; callers can inspect status for 'partial' or 'failed'.
      return respond(200, summary, postResponseHeaders)
    } else if (type === 'demo') {
      const outcome = await runDemoSeeds(payloadInstance, { reset })
      const summary = buildSeedSummary({ type, reset, startedAtMs: start, result: outcome })

      if (summary.status === 'partial') {
        payloadInstance.logger.warn({
          msg: 'Partial demo seed run',
          failures: outcome.failures,
          totals: summary.totals,
        })
      }

      ;(global as unknown as Record<string, unknown>).__lastSeedRun = summary
      const httpStatus = summary.status === 'failed' ? 500 : 200
      return respond(httpStatus, summary, postResponseHeaders)
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    payloadInstance.logger.error(`Seed endpoint error: ${msg}`)
    return respond(500, { error: 'Seed failed', detail: 'An internal error occurred' }, postResponseHeaders)
  }
}

/** GET /seed: return cached last seed run summary (platform-only). */
export const seedGetHandler = async (req: PayloadRequest, res?: unknown) => {
  const respond = (statusCode: number, body: unknown) => {
    const r = res as ExpressResponse | undefined
    if (r && typeof r.status === 'function' && typeof r.json === 'function') {
      return r.status(statusCode).json(body)
    }
    return new Response(JSON.stringify(body), {
      status: statusCode,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  const userType = (req.user as { userType?: string } | null | undefined)?.userType
  if (!userType || userType !== 'platform') {
    return respond(403, { error: 'Forbidden' })
  }
  return respond(200, (global as unknown as Record<string, unknown>).__lastSeedRun || { message: 'No seed run yet' })
}
