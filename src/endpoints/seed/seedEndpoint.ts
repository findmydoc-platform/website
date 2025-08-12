import type { PayloadRequest } from 'payload'

// Extracted seed endpoint logic to keep payload.config.ts lean.
export const seedPostHandler = async (req: PayloadRequest, res?: any) => {
  const payloadInstance = req.payload
  const start = Date.now()
  const type = (req.query.type as string) || 'baseline'
  const reset = req.query.reset === '1'
  const respond = (statusCode: number, body: any) => {
    if (res && res.status && res.json) {
      return res.status(statusCode).json(body)
    }
    if (statusCode >= 400) throw new Error(body?.error || body?.detail || 'Seed failed')
    return new Response(JSON.stringify(body), {
      status: statusCode,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  try {
    if (!req.user || (req.user as any).userType !== 'platform') {
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
          created: results.reduce((a: number, r: any) => a + r.created, 0),
          updated: results.reduce((a: number, r: any) => a + r.updated, 0),
        },
        units: results,
      }
      ;(global as any).__lastSeedRun = summary
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
        payloadInstance.logger.warn({ msg: 'Partial demo seed run', partialFailures: outcome.partialFailures, totals: summary.totals })
      }
      ;(global as any).__lastSeedRun = summary
      const httpStatus = status === 'failed' ? 500 : 200
      return respond(httpStatus, summary)
    }
    return respond(400, { error: 'Invalid type parameter' })
  } catch (e: any) {
    payloadInstance.logger.error(`Seed endpoint error: ${e.message}`)
    return respond(500, { error: 'Seed failed', detail: e.message })
  }
}

export const seedGetHandler = async (req: PayloadRequest, res?: any) => {
  const respond = (statusCode: number, body: any) => {
    if (res && res.status && res.json) {
      return res.status(statusCode).json(body)
    }
    if (statusCode >= 400) throw new Error(body?.error || 'Request failed')
    return new Response(JSON.stringify(body), {
      status: statusCode,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  if (!req.user || (req.user as any).userType !== 'platform') {
    return respond(403, { error: 'Forbidden' })
  }
  return respond(200, (global as any).__lastSeedRun || { message: 'No seed run yet' })
}
