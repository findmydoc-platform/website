import type { PayloadRequest } from 'payload'
import { isProductionRuntime } from './utils/runtime'

interface ExpressResponse {
  status: (code: number) => ExpressResponse
  json: (body: unknown) => void
}

/**
 * Determine a seed run status from units and failures.
 *
 * Rules:
 * - If there are no failures, status is 'ok'.
 * - If there are failures and there are units processed, status is 'partial'.
 * - If there are failures and no units were processed, status is 'failed'.
 */
export function determineSeedStatus(units: { created: number; updated: number }[], failures: string[]) {
  if (Array.isArray(failures) && failures.length > 0) {
    return Array.isArray(units) && units.length > 0 ? 'partial' : 'failed'
  }
  return 'ok'
}

/** POST /seed: run baseline or demo seeds (optional reset). Platform-only; demo blocked in production. */
export const seedPostHandler = async (req: PayloadRequest, res?: unknown) => {
  const payloadInstance = req.payload
  const start = Date.now()
  const type = (req.query.type as string | undefined) ?? 'baseline'
  const reset = req.query.reset === '1'

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

  try {
    const userType = (req.user as { userType?: string } | null | undefined)?.userType
    if (!userType || userType !== 'platform') {
      return respond(403, { error: 'Forbidden' })
    }

    if (type !== 'baseline' && type !== 'demo') {
      return respond(400, { error: 'Invalid type parameter' })
    }

    if (isProductionRuntime() && type === 'demo') {
      return respond(400, { error: 'Demo seeding disabled in production' })
    }

    if (isProductionRuntime() && reset) {
      return respond(400, { error: 'Reset is disabled in production' })
    }

    const { runBaselineSeeds } = await import('./baseline')
    const { runDemoSeeds } = await import('./demo')

    if (type === 'baseline') {
      const results = await runBaselineSeeds(payloadInstance, { reset })
      const status = determineSeedStatus(results.units, results.failures)
      const summary = {
        type,
        reset,
        status,
        startedAt: new Date(start).toISOString(),
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - start,
        totals: {
          created: results.units.reduce((a, r) => a + r.created, 0),
          updated: results.units.reduce((a, r) => a + r.updated, 0),
        },
        units: results.units,
        warnings: results.warnings,
        failures: results.failures,
      }

      ;(global as unknown as Record<string, unknown>).__lastSeedRun = summary

      // Baseline always returns HTTP 200 with a status field; callers can inspect status for 'partial' or 'failed'.
      return respond(200, summary)
    } else if (type === 'demo') {
      const outcome = await runDemoSeeds(payloadInstance, { reset })
      const created = outcome.units.reduce((a, r) => a + r.created, 0)
      const updated = outcome.units.reduce((a, r) => a + r.updated, 0)
      const status = determineSeedStatus(outcome.units, outcome.failures)
      const summary = {
        type,
        reset,
        status,
        startedAt: new Date(start).toISOString(),
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - start,
        totals: { created, updated },
        units: outcome.units,
        warnings: outcome.warnings,
        failures: outcome.failures,
      }

      if (status === 'partial') {
        payloadInstance.logger.warn({
          msg: 'Partial demo seed run',
          failures: outcome.failures,
          totals: summary.totals,
        })
      }

      ;(global as unknown as Record<string, unknown>).__lastSeedRun = summary
      const httpStatus = status === 'failed' ? 500 : 200
      return respond(httpStatus, summary)
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    payloadInstance.logger.error(`Seed endpoint error: ${msg}`)
    return respond(500, { error: 'Seed failed', detail: 'An internal error occurred' })
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
