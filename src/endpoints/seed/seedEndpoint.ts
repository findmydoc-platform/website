import type { PayloadRequest } from 'payload'

interface ExpressResponse {
  status: (code: number) => ExpressResponse
  json: (body: unknown) => void
}

/** POST /seed: run baseline or demo seeds (optional reset). Platform-only; demo blocked in production. */
export const seedPostHandler = async (req: PayloadRequest, res?: unknown) => {
  const payloadInstance = req.payload
  const start = Date.now()
  const type = (req.query.type as string) || 'baseline'
  const reset = req.query.reset === '1'

  const respond = (statusCode: number, body: unknown) => {
    const r = res as ExpressResponse | undefined
    if (r && typeof r.status === 'function' && typeof r.json === 'function') {
      return r.status(statusCode).json(body)
    }
    const b = body as Record<string, unknown>
    if (statusCode >= 400) throw new Error(String(b?.error || b?.detail || 'Seed failed'))
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

    if (process.env.NODE_ENV === 'production' && type !== 'baseline') {
      return respond(400, { error: 'Demo seeding disabled in production' })
    }

    const { runBaselineSeeds } = await import('./baseline')
    const { runDemoSeeds } = await import('./demo')

    if (type === 'baseline') {
      const results = await runBaselineSeeds(payloadInstance)
      const summary = {
        type,
        reset,
        status: 'ok' as const,
        baselineFailed: false,
        startedAt: new Date(start).toISOString(),
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - start,
        totals: {
          created: results.reduce((a: number, r: { created: number; updated: number }) => a + r.created, 0),
          updated: results.reduce((a: number, r: { created: number; updated: number }) => a + r.updated, 0),
        },
        units: results,
      }

      ;(global as unknown as Record<string, unknown>).__lastSeedRun = summary

      return respond(200, summary)
    } else if (type === 'demo') {
      const outcome = await runDemoSeeds(payloadInstance, { reset })
      const created = outcome.units.reduce((a, r) => a + r.created, 0)
      const updated = outcome.units.reduce((a, r) => a + r.updated, 0)
      let status: 'ok' | 'partial' | 'failed'
      if (outcome.units.length === 0 && outcome.partialFailures.length > 0) status = 'failed'
      else if (outcome.partialFailures.length > 0) status = 'partial'
      else status = 'ok'
      const summary = {
        type,
        reset,
        status,
        baselineFailed: false,
        startedAt: new Date(start).toISOString(),
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - start,
        totals: { created, updated },
        units: outcome.units,
        partialFailures: outcome.partialFailures,
        beforeCounts: outcome.beforeCounts,
        afterCounts: outcome.afterCounts,
      }

      if (status === 'partial') {
        payloadInstance.logger.warn({
          msg: 'Partial demo seed run',
          partialFailures: outcome.partialFailures,
          totals: summary.totals,
        })
      }

      ;(global as unknown as Record<string, unknown>).__lastSeedRun = summary
      const httpStatus = status === 'failed' ? 500 : 200
      return respond(httpStatus, summary)
    }
    return respond(400, { error: 'Invalid type parameter' })
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
    const b = body as Record<string, unknown>
    if (statusCode >= 400) throw new Error(String(b?.error || 'Request failed'))
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
