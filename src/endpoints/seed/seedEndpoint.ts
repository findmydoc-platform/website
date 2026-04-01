import type { PayloadRequest } from 'payload'
import { revalidateTag } from 'next/cache'
import { assertSeedRunPolicy, isSeedEndpointPostEnabled, resolveSeedRuntimeEnv, type SeedType } from './utils/runtime'
import { buildSeedQueueJobs, getSeedQueueName } from './utils/planner'
import { formatSeedRetryTitle, formatSeedRunTitle, formatSeedJobTitle } from './utils/labels'
import type { SeedQueueJobInput } from './utils/job-types'
import {
  buildSeedRunSnapshot,
  clearActiveSeedRunIfTerminal,
  createSeedRunId,
  createSeedRunRecord,
  getActiveSeedRunId,
  loadSeedRunRecord,
  registerSeedRunJob,
  resolveSeedRunId,
  saveSeedRunRecord,
  setActiveSeedRunId,
  setLatestSeedRunId,
  type SeedRunRecord,
  type SeedRunSnapshot,
} from './utils/state'

interface ExpressResponse {
  status: (code: number) => ExpressResponse
  json: (body: unknown) => void
}

const respond = (res: unknown, statusCode: number, body: unknown) => {
  const response = res as ExpressResponse | undefined

  if (response && typeof response.status === 'function' && typeof response.json === 'function') {
    return response.status(statusCode).json(body)
  }

  return Response.json(body, { status: statusCode })
}

const isPlatformSeedUser = (req: PayloadRequest): boolean => {
  return (req.user as { userType?: string } | null | undefined)?.userType === 'platform'
}

const revalidateNavigationGlobals = (req: PayloadRequest) => {
  const tags = ['global_header', 'global_footer', 'global_cookieConsent'] as const

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

const getSeedType = (req: PayloadRequest): SeedType | null => {
  const type = req.query.type
  if (type === 'baseline' || type === 'demo') {
    return type
  }
  return null
}

const getResetFlag = (req: PayloadRequest): boolean => req.query.reset === '1'

const finalizeRunSnapshot = async (req: PayloadRequest, snapshot: SeedRunSnapshot): Promise<void> => {
  if (snapshot.status === 'completed' || snapshot.status === 'partial' || snapshot.status === 'failed') {
    await clearActiveSeedRunIfTerminal(req.payload, snapshot.runId)
    revalidateNavigationGlobals(req)
  }
}

type SeedQueuePlanJob = {
  input: SeedQueueJobInput
  title: string
}

const queueSeedRunFromPlannedJobs = async (args: {
  req: PayloadRequest
  runId: string
  type: SeedType
  reset: boolean
  queue: string
  title?: string
  plannedJobs: SeedQueuePlanJob[]
}): Promise<SeedRunSnapshot> => {
  const payload = args.req.payload
  const runRecord = createSeedRunRecord({
    runId: args.runId,
    type: args.type,
    reset: args.reset,
    queue: args.queue,
    totalJobs: args.plannedJobs.length,
    title: args.title,
  })

  await saveSeedRunRecord(payload, runRecord)
  await setLatestSeedRunId(payload, args.runId)
  await setActiveSeedRunId(payload, args.runId)

  try {
    for (const [index, job] of args.plannedJobs.entries()) {
      const queuedJob = (await (
        payload.jobs as unknown as {
          queue: (options: {
            task: string
            input: unknown
            queue: string
            req: PayloadRequest
            overrideAccess?: boolean
          }) => Promise<{ id: string | number }>
        }
      ).queue({
        task: 'seedChunk',
        input: job.input,
        queue: args.queue,
        req: args.req,
        overrideAccess: true,
      })) as { id: string | number }

      await registerSeedRunJob(payload, args.runId, {
        id: String(queuedJob.id),
        order: index + 1,
        status: 'queued',
        input: job.input,
        queue: args.queue,
        title: job.title,
        stepName: job.input.stepName,
        kind: job.input.kind,
        collection: job.input.collection,
        fileName: job.input.fileName,
        chunkIndex: job.input.chunkIndex,
        chunkTotal: job.input.chunkTotal,
        createdAt: new Date().toISOString(),
        created: 0,
        updated: 0,
        warnings: [],
        failures: [],
      })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    args.req.payload.logger.error(`Unable to queue seed run ${args.runId}: ${message}`)
    const currentRecord = (await loadSeedRunRecord(payload, args.runId)) ?? runRecord
    await saveSeedRunRecord(payload, {
      ...currentRecord,
      status: 'failed',
      completedAt: new Date().toISOString(),
      failures: [...currentRecord.failures, message],
      logs: [
        ...currentRecord.logs,
        {
          id: `${args.runId}-queue-error`,
          at: new Date().toISOString(),
          severity: 'ERROR',
          text: `Unable to queue seed run: ${message}`,
          runId: args.runId,
          title: args.title ?? formatSeedRunTitle(args.type, args.reset),
        },
      ],
    })
    await clearActiveSeedRunIfTerminal(payload, args.runId)
    throw error
  }

  const snapshot = buildSeedRunSnapshot((await loadSeedRunRecord(payload, args.runId)) ?? runRecord)
  return snapshot
}

const queueSeedRun = async (req: PayloadRequest, type: SeedType, reset: boolean): Promise<SeedRunSnapshot> => {
  const runId = createSeedRunId()
  const queue = getSeedQueueName(runId)

  const plannedJobs = await buildSeedQueueJobs({
    runId,
    type,
    reset,
    queue,
  })

  return queueSeedRunFromPlannedJobs({
    req,
    runId,
    type,
    reset,
    queue,
    plannedJobs,
  })
}

const isRetryableSeedJob = (job: SeedRunRecord['jobs'][number]): boolean => {
  return job.status === 'failed' || job.status === 'cancelled'
}

const parseRequestedRetryJobIds = (req: PayloadRequest): string[] => {
  const jobIds: string[] = []

  if (typeof req.query.jobId === 'string' && req.query.jobId.trim().length > 0) {
    jobIds.push(req.query.jobId.trim())
  }

  if (typeof req.query.jobIds === 'string' && req.query.jobIds.trim().length > 0) {
    for (const candidate of req.query.jobIds.split(',')) {
      const trimmed = candidate.trim()
      if (trimmed.length > 0) {
        jobIds.push(trimmed)
      }
    }
  }

  return Array.from(new Set(jobIds))
}

const queueSeedRetryRun = async (req: PayloadRequest): Promise<SeedRunSnapshot> => {
  const payload = req.payload
  const sourceRunId = typeof req.query.runId === 'string' ? req.query.runId.trim() : ''

  if (!sourceRunId) {
    throw new Error('Missing runId parameter')
  }

  const sourceRun = await loadSeedRunRecord(payload, sourceRunId)
  if (!sourceRun) {
    throw new Error(`Seed run ${sourceRunId} not found`)
  }

  if (sourceRun.status === 'queued' || sourceRun.status === 'running') {
    throw new Error('Cannot retry an active seed run')
  }

  const requestedJobIds = parseRequestedRetryJobIds(req)
  const candidateJobs =
    requestedJobIds.length > 0
      ? sourceRun.jobs.filter((job) => requestedJobIds.includes(job.id))
      : sourceRun.jobs.filter(isRetryableSeedJob)

  if (requestedJobIds.length > 0 && candidateJobs.length !== requestedJobIds.length) {
    throw new Error('One or more requested jobs were not found')
  }

  const retryableJobs = candidateJobs.filter(isRetryableSeedJob)

  if (requestedJobIds.length > 0 && retryableJobs.length !== candidateJobs.length) {
    throw new Error('One or more requested jobs are not retryable')
  }

  if (retryableJobs.length === 0) {
    throw new Error('No failed or cancelled jobs to retry')
  }

  const retryRunId = createSeedRunId()
  const retryQueue = getSeedQueueName(retryRunId)
  const retryRunTitle = formatSeedRetryTitle(sourceRun.title ?? formatSeedRunTitle(sourceRun.type, sourceRun.reset))

  const plannedJobs = retryableJobs
    .slice()
    .sort((left, right) => left.order - right.order)
    .map((job) => {
      const baseTitle = job.title ?? formatSeedJobTitle(job.stepName, job.chunkIndex, job.chunkTotal)
      const retryTitle = formatSeedRetryTitle(baseTitle)
      const input = structuredClone(job.input) as SeedQueueJobInput

      return {
        title: retryTitle,
        input: {
          ...input,
          runId: retryRunId,
          queue: retryQueue,
          title: retryTitle,
        },
      }
    })

  return queueSeedRunFromPlannedJobs({
    req,
    runId: retryRunId,
    type: sourceRun.type,
    reset: sourceRun.reset,
    queue: retryQueue,
    title: retryRunTitle,
    plannedJobs,
  })
}

const loadSeedRunSnapshot = async (
  req: PayloadRequest,
  requestedRunId?: string | null,
): Promise<SeedRunSnapshot | null> => {
  if (requestedRunId) {
    const requestedRecord = await loadSeedRunRecord(req.payload, requestedRunId)
    return requestedRecord ? buildSeedRunSnapshot(requestedRecord) : null
  }

  const resolvedRunId = await resolveSeedRunId(req.payload, undefined)
  if (!resolvedRunId) return null

  const record = await loadSeedRunRecord(req.payload, resolvedRunId)
  if (!record) return null

  return buildSeedRunSnapshot(record)
}

/** POST /seed: start a queued seed run from the Developer Dashboard. */
export const seedPostHandler = async (req: PayloadRequest, res?: unknown) => {
  if (!isPlatformSeedUser(req)) {
    return respond(res, 403, { error: 'Forbidden' })
  }

  const type = getSeedType(req)
  const reset = getResetFlag(req)
  const runtimeEnv = resolveSeedRuntimeEnv(undefined, process.env)
  const payload = req.payload

  if (!type) {
    return respond(res, 400, { error: 'Invalid type parameter' })
  }

  if (!isSeedEndpointPostEnabled(runtimeEnv)) {
    return respond(res, 405, { error: 'Seed requests are disabled in this runtime.' })
  }

  try {
    assertSeedRunPolicy({ runtimeEnv, type, reset })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Seed request is not allowed'
    payload.logger.warn(`Rejected seed request by policy: ${message}`)
    return respond(res, 400, { error: message })
  }

  const activeRunId = await getActiveSeedRunId(payload)
  if (activeRunId) {
    const activeRecord = await loadSeedRunRecord(payload, activeRunId)
    if (
      activeRecord &&
      activeRecord.status !== 'completed' &&
      activeRecord.status !== 'partial' &&
      activeRecord.status !== 'failed' &&
      activeRecord.status !== 'cancelled'
    ) {
      return respond(res, 409, {
        error: 'A seed run is already active.',
        runId: activeRunId,
        run: buildSeedRunSnapshot(activeRecord),
      })
    }

    await clearActiveSeedRunIfTerminal(payload, activeRunId)
  }

  try {
    const snapshot = await queueSeedRun(req, type, reset)
    return respond(res, 202, snapshot)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    payload.logger.error(`Seed failed: ${message}`)
    return respond(res, 500, { error: 'Seed failed' })
  }
}

/** POST /seed/retry: queue a retry run for failed or cancelled jobs. */
export const seedRetryHandler = async (req: PayloadRequest, res?: unknown) => {
  if (!isPlatformSeedUser(req)) {
    return respond(res, 403, { error: 'Forbidden' })
  }

  try {
    const snapshot = await queueSeedRetryRun(req)
    return respond(res, 202, snapshot)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const statusCode = message.includes('not found')
      ? 404
      : message.includes('active seed run')
        ? 409
        : message.includes('Missing runId') ||
            message.includes('No failed or cancelled jobs to retry') ||
            message.includes('not retryable')
          ? 400
          : 500
    if (statusCode === 500) {
      req.payload.logger.error(`Seed retry failed: ${message}`)
      return respond(res, statusCode, { error: 'Seed retry failed' })
    }

    return respond(res, statusCode, { error: message })
  }
}

/** GET /seed: return the current or latest seed run snapshot. */
export const seedGetHandler = async (req: PayloadRequest, res?: unknown) => {
  if (!isPlatformSeedUser(req)) {
    return respond(res, 403, { error: 'Forbidden' })
  }

  const requestedRunId = typeof req.query.runId === 'string' ? req.query.runId : undefined
  const snapshot = await loadSeedRunSnapshot(req, requestedRunId)

  if (!snapshot) {
    return respond(res, 200, {
      message: requestedRunId ? 'Seed run not found' : 'No seed run yet',
    })
  }

  return respond(res, 200, snapshot)
}

/** GET /seed/advance: run the next queued job for the active seed run. */
export const seedAdvanceHandler = async (req: PayloadRequest, res?: unknown) => {
  if (!isPlatformSeedUser(req)) {
    return respond(res, 403, { error: 'Forbidden' })
  }

  const payload = req.payload
  const requestedRunId = typeof req.query.runId === 'string' ? req.query.runId : undefined
  let resolvedRunId = await resolveSeedRunId(payload, requestedRunId)

  if (!resolvedRunId) {
    return respond(res, 200, { message: 'No seed run yet' })
  }

  const existingRun = await loadSeedRunRecord(payload, resolvedRunId)
  if (!existingRun) {
    return respond(res, 200, {
      message: requestedRunId ? 'Seed run not found' : 'No seed run yet',
    })
  }
  const fallbackRun = existingRun
  resolvedRunId = fallbackRun.runId

  const currentSnapshot = buildSeedRunSnapshot(fallbackRun)
  if (
    currentSnapshot.status === 'completed' ||
    currentSnapshot.status === 'partial' ||
    currentSnapshot.status === 'failed' ||
    currentSnapshot.status === 'cancelled'
  ) {
    await clearActiveSeedRunIfTerminal(payload, currentSnapshot.runId)
    revalidateNavigationGlobals(req)
    return respond(res, 200, currentSnapshot)
  }

  if (fallbackRun.activeJobId) {
    return respond(res, 200, currentSnapshot)
  }

  try {
    await (
      payload.jobs as unknown as {
        run: (args: {
          queue: string
          limit: number
          sequential: boolean
          req: PayloadRequest
          overrideAccess?: boolean
          silent?: boolean
        }) => Promise<unknown>
      }
    ).run({
      queue: fallbackRun.queue,
      limit: 1,
      sequential: true,
      req,
      overrideAccess: true,
      silent: true,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    payload.logger.error(`Seed advance failed for ${resolvedRunId}: ${message}`)
    return respond(res, 500, { error: 'Seed advance failed' })
  }

  const updatedRun = await loadSeedRunRecord(payload, resolvedRunId)
  if (!updatedRun) {
    return respond(res, 404, { error: 'Seed run not found' })
  }

  const snapshot = buildSeedRunSnapshot(updatedRun)
  await finalizeRunSnapshot(req, snapshot)
  return respond(res, 200, snapshot)
}
