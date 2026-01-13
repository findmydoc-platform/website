import type { PayloadRequest } from 'payload'

interface ExpressResponse {
  status: (code: number) => ExpressResponse
  json: (body: unknown) => void
}

/** POST /seed: run baseline or demo seeds (optional reset). Platform-only; demo blocked in production. */
export const seedPostHandler = async (req: PayloadRequest, res?: unknown) => {
  const payloadInstance = req.payload
  const start = Date.now()
  const queryType = req.query.type as string | undefined
  const legacyDemo = req.query.demo === 'true'
  const type = queryType || (legacyDemo ? 'demo' : 'baseline')
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

    if (process.env.NODE_ENV === 'production' && type === 'demo') {
      return respond(400, { error: 'Demo seeding disabled in production' })
    }

    if (process.env.NODE_ENV === 'production' && reset) {
      return respond(400, { error: 'Reset is disabled in production' })
    }

    const { runBaselineSeeds } = await import('./baseline')
    const { runDemoSeeds } = await import('./demo')

    if (type === 'baseline') {
      const results = await runBaselineSeeds(payloadInstance, { reset })
      const summary = {
        type,
        reset,
        status: results.failures.length > 0 ? 'partial' : 'ok',
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

      return respond(200, summary)
    } else if (type === 'demo') {
      const outcome = await runDemoSeeds(payloadInstance, { reset })
      const created = outcome.units.reduce((a, r) => a + r.created, 0)
      const updated = outcome.units.reduce((a, r) => a + r.updated, 0)
      const hasFailures = outcome.failures.length > 0
      const status = hasFailures ? (outcome.units.length > 0 ? 'partial' : 'failed') : 'ok'
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
    return respond(500, { error: 'Seed failed', detail: msg })
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
