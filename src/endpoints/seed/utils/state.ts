import { randomUUID } from 'crypto'
import type { Payload } from 'payload'
import type { SeedType } from './runtime'
import type { SeedQueueJobInput } from './job-types'
import { formatSeedRunTitle } from './labels'

export type SeedRunStatus = 'queued' | 'running' | 'completed' | 'partial' | 'failed' | 'cancelled'
export type SeedJobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'skipped'
export type SeedLogSeverity = 'INFO' | 'WARN' | 'ERROR'

export type SeedLogEntry = {
  id: string
  at: string
  severity: SeedLogSeverity
  text: string
  runId: string
  title?: string
  jobId?: string
  stepName?: string
  kind?: SeedQueueJobInput['kind']
  collection?: string
  chunkIndex?: number
  chunkTotal?: number
}

export type SeedRunJobRecord = {
  id: string
  order: number
  status: SeedJobStatus
  input: SeedQueueJobInput
  queue: string
  title?: string
  stepName: string
  kind: SeedQueueJobInput['kind']
  collection?: string
  fileName?: string
  chunkIndex?: number
  chunkTotal?: number
  createdAt: string
  startedAt?: string
  completedAt?: string
  created: number
  updated: number
  warnings: string[]
  failures: string[]
  error?: string
  output?: Record<string, unknown>
}

export type SeedRunRecord = {
  runId: string
  type: SeedType
  reset: boolean
  queue: string
  title?: string
  status: SeedRunStatus
  createdAt: string
  startedAt?: string
  completedAt?: string
  totalJobs: number
  completedJobs: number
  succeededJobs: number
  failedJobs: number
  cancelledJobs: number
  activeJobId?: string
  activeStepName?: string
  jobs: SeedRunJobRecord[]
  logs: SeedLogEntry[]
  warnings: string[]
  failures: string[]
  totals: { created: number; updated: number }
}

export type SeedRunSnapshot = SeedRunRecord & {
  progress: {
    completed: number
    total: number
    percent: number
  }
  jobIds: string[]
  hasActiveJob: boolean
}

const RUN_KEY_PREFIX = 'seed:run:'
const ACTIVE_RUN_KEY = 'seed:active'
const LATEST_RUN_KEY = 'seed:latest'

const TERMINAL_STATUSES = new Set<SeedRunStatus>(['completed', 'partial', 'failed', 'cancelled'])

const nowIso = () => new Date().toISOString()

const clone = <T>(value: T): T => structuredClone(value)

const readStoredRunId = async (payload: Payload, key: string): Promise<string | null> => {
  const value = await payload.kv.get(key)
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

export const createSeedRunId = () => randomUUID()

export const getSeedRunKey = (runId: string) => `${RUN_KEY_PREFIX}${runId}`

export const createSeedRunRecord = (args: {
  runId: string
  type: SeedType
  reset: boolean
  queue: string
  totalJobs: number
  title?: string
}): SeedRunRecord => {
  const startedAt = nowIso()
  return {
    runId: args.runId,
    type: args.type,
    reset: args.reset,
    queue: args.queue,
    title: args.title ?? formatSeedRunTitle(args.type, args.reset),
    status: args.totalJobs > 0 ? 'queued' : 'completed',
    createdAt: startedAt,
    startedAt: undefined,
    completedAt: args.totalJobs === 0 ? startedAt : undefined,
    totalJobs: args.totalJobs,
    completedJobs: 0,
    succeededJobs: 0,
    failedJobs: 0,
    cancelledJobs: 0,
    jobs: [],
    logs: [],
    warnings: [],
    failures: [],
    totals: { created: 0, updated: 0 },
  }
}

export const loadSeedRunRecord = async (payload: Payload, runId: string): Promise<SeedRunRecord | null> => {
  if (!runId) return null
  const record = await payload.kv.get<SeedRunRecord>(getSeedRunKey(runId))
  return record ? clone(record) : null
}

export const saveSeedRunRecord = async (payload: Payload, record: SeedRunRecord): Promise<void> => {
  await payload.kv.set(getSeedRunKey(record.runId), clone(record))
}

export const setActiveSeedRunId = async (payload: Payload, runId: string | null): Promise<void> => {
  if (runId) {
    await payload.kv.set(ACTIVE_RUN_KEY, runId)
  } else {
    await payload.kv.delete(ACTIVE_RUN_KEY)
  }
}

export const getActiveSeedRunId = async (payload: Payload): Promise<string | null> => {
  return readStoredRunId(payload, ACTIVE_RUN_KEY)
}

export const setLatestSeedRunId = async (payload: Payload, runId: string): Promise<void> => {
  await payload.kv.set(LATEST_RUN_KEY, runId)
}

export const getLatestSeedRunId = async (payload: Payload): Promise<string | null> => {
  return readStoredRunId(payload, LATEST_RUN_KEY)
}

export const resolveSeedRunId = async (payload: Payload, runId?: string | null): Promise<string | null> => {
  if (runId && runId.trim().length > 0) {
    return runId
  }

  return (await getActiveSeedRunId(payload)) ?? (await getLatestSeedRunId(payload))
}

const recomputeRunStatus = (record: SeedRunRecord): SeedRunStatus => {
  if (TERMINAL_STATUSES.has(record.status)) {
    return record.status
  }

  const completedJobs = record.jobs.filter((job) =>
    ['succeeded', 'failed', 'cancelled', 'skipped'].includes(job.status),
  ).length
  const succeededJobs = record.jobs.filter((job) => job.status === 'succeeded').length
  const failedJobs = record.jobs.filter((job) => job.status === 'failed').length
  const cancelledJobs = record.jobs.filter((job) => job.status === 'cancelled').length
  const activeJobs = record.jobs.filter((job) => job.status === 'running').length
  const queuedJobs = record.jobs.filter((job) => job.status === 'queued').length

  record.completedJobs = completedJobs
  record.succeededJobs = succeededJobs
  record.failedJobs = failedJobs
  record.cancelledJobs = cancelledJobs
  record.totals = record.jobs.reduce(
    (totals, job) => {
      totals.created += job.created
      totals.updated += job.updated
      return totals
    },
    { created: 0, updated: 0 },
  )

  if (record.totalJobs === 0) {
    return 'completed'
  }

  if (record.completedJobs >= record.totalJobs && activeJobs === 0 && queuedJobs === 0) {
    if (record.failedJobs > 0) {
      return record.succeededJobs > 0 ? 'partial' : 'failed'
    }
    return 'completed'
  }

  if (record.failedJobs > 0) {
    return 'partial'
  }

  if (record.activeJobId) {
    return 'running'
  }

  if (queuedJobs > 0) {
    return record.completedJobs > 0 ? 'running' : 'queued'
  }

  return 'queued'
}

const finalizeRunIfNeeded = (record: SeedRunRecord): SeedRunRecord => {
  const nextStatus = recomputeRunStatus(record)
  record.status = nextStatus

  if (TERMINAL_STATUSES.has(nextStatus)) {
    record.completedAt ??= nowIso()
    record.activeJobId = undefined
    record.activeStepName = undefined
  }

  return record
}

export const buildSeedRunSnapshot = (record: SeedRunRecord): SeedRunSnapshot => {
  const finalized = finalizeRunIfNeeded(clone(record))
  const completed = finalized.completedJobs
  const total = finalized.totalJobs

  return {
    ...finalized,
    progress: {
      completed,
      total,
      percent: total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 100,
    },
    jobIds: finalized.jobs.map((job) => job.id),
    hasActiveJob: typeof finalized.activeJobId === 'string' && finalized.activeJobId.length > 0,
  }
}

export const appendSeedRunLog = async (
  payload: Payload,
  runId: string,
  entries: SeedLogEntry | SeedLogEntry[],
): Promise<SeedRunRecord | null> => {
  const record = await loadSeedRunRecord(payload, runId)
  if (!record) return null

  const nextEntries = Array.isArray(entries) ? entries : [entries]
  const seen = new Set(record.logs.map((entry) => entry.id))

  for (const entry of nextEntries) {
    if (!seen.has(entry.id)) {
      record.logs.push(clone(entry))
      seen.add(entry.id)
    }
  }

  finalizeRunIfNeeded(record)
  await saveSeedRunRecord(payload, record)
  return record
}

export const registerSeedRunJob = async (
  payload: Payload,
  runId: string,
  job: SeedRunJobRecord,
): Promise<SeedRunRecord | null> => {
  const record = await loadSeedRunRecord(payload, runId)
  if (!record) return null

  record.jobs.push(clone(job))
  finalizeRunIfNeeded(record)
  await saveSeedRunRecord(payload, record)
  return record
}

export const updateSeedRunJob = async (
  payload: Payload,
  runId: string,
  jobId: string,
  updater: (job: SeedRunJobRecord) => SeedRunJobRecord,
): Promise<SeedRunRecord | null> => {
  const record = await loadSeedRunRecord(payload, runId)
  if (!record) return null

  const index = record.jobs.findIndex((job) => job.id === jobId)
  if (index === -1) return record

  const nextJob = updater(clone(record.jobs[index]!))
  record.jobs[index] = nextJob
  finalizeRunIfNeeded(record)
  await saveSeedRunRecord(payload, record)
  return record
}

export const setSeedRunActiveJob = async (
  payload: Payload,
  runId: string,
  args: { jobId: string; stepName: string },
): Promise<SeedRunRecord | null> => {
  const record = await updateSeedRunJob(payload, runId, args.jobId, (job) => {
    job.status = 'running'
    job.startedAt ??= nowIso()
    return job
  })

  if (!record) return null

  record.activeJobId = args.jobId
  record.activeStepName = args.stepName
  if (!record.startedAt) {
    record.startedAt = nowIso()
  }
  record.status = 'running'
  await saveSeedRunRecord(payload, record)
  return record
}

export const finishSeedRunJob = async (
  payload: Payload,
  runId: string,
  args: {
    jobId: string
    status: Exclude<SeedJobStatus, 'queued' | 'running'>
    created: number
    updated: number
    warnings?: string[]
    failures?: string[]
    error?: string
    output?: Record<string, unknown>
  },
): Promise<SeedRunRecord | null> => {
  const record = await updateSeedRunJob(payload, runId, args.jobId, (job) => {
    job.status = args.status
    job.completedAt ??= nowIso()
    job.created = args.created
    job.updated = args.updated
    job.warnings = [...job.warnings, ...(args.warnings ?? [])]
    job.failures = [...job.failures, ...(args.failures ?? [])]
    if (args.error) {
      job.error = args.error
    }
    if (args.output) {
      job.output = args.output
    }
    return job
  })

  if (!record) return null

  if (record.activeJobId === args.jobId) {
    record.activeJobId = undefined
    record.activeStepName = undefined
  }

  finalizeRunIfNeeded(record)
  await saveSeedRunRecord(payload, record)
  return record
}

export const markSeedRunCancelled = async (payload: Payload, runId: string): Promise<SeedRunRecord | null> => {
  const record = await loadSeedRunRecord(payload, runId)
  if (!record) return null

  for (const job of record.jobs) {
    if (job.status === 'queued' || job.status === 'running') {
      job.status = 'cancelled'
      job.completedAt ??= nowIso()
    }
  }

  record.activeJobId = undefined
  record.activeStepName = undefined
  record.status = 'cancelled'
  record.completedAt ??= nowIso()
  finalizeRunIfNeeded(record)
  await saveSeedRunRecord(payload, record)
  return record
}

export const attachSeedRunWarning = async (
  payload: Payload,
  runId: string,
  warning: string,
  context: Pick<SeedLogEntry, 'title' | 'jobId' | 'stepName' | 'kind' | 'collection' | 'chunkIndex' | 'chunkTotal'>,
): Promise<SeedRunRecord | null> => {
  const entry: SeedLogEntry = {
    id: randomUUID(),
    at: nowIso(),
    severity: 'WARN',
    text: warning,
    runId,
    ...context,
  }
  return appendSeedRunLog(payload, runId, entry)
}

export const attachSeedRunError = async (
  payload: Payload,
  runId: string,
  error: string,
  context: Pick<SeedLogEntry, 'title' | 'jobId' | 'stepName' | 'kind' | 'collection' | 'chunkIndex' | 'chunkTotal'>,
): Promise<SeedRunRecord | null> => {
  const entry: SeedLogEntry = {
    id: randomUUID(),
    at: nowIso(),
    severity: 'ERROR',
    text: error,
    runId,
    ...context,
  }
  return appendSeedRunLog(payload, runId, entry)
}

export const attachSeedRunInfo = async (
  payload: Payload,
  runId: string,
  text: string,
  context: Pick<SeedLogEntry, 'title' | 'jobId' | 'stepName' | 'kind' | 'collection' | 'chunkIndex' | 'chunkTotal'>,
): Promise<SeedRunRecord | null> => {
  const entry: SeedLogEntry = {
    id: randomUUID(),
    at: nowIso(),
    severity: 'INFO',
    text,
    runId,
    ...context,
  }
  return appendSeedRunLog(payload, runId, entry)
}

export const clearActiveSeedRunIfTerminal = async (payload: Payload, runId: string): Promise<void> => {
  const activeRunId = await getActiveSeedRunId(payload)
  if (activeRunId === runId) {
    await setActiveSeedRunId(payload, null)
  }
}

export const saveLatestSeedRun = async (payload: Payload, record: SeedRunRecord): Promise<void> => {
  await setLatestSeedRunId(payload, record.runId)
  if (record.status === 'queued' || record.status === 'running') {
    await setActiveSeedRunId(payload, record.runId)
  } else {
    await clearActiveSeedRunIfTerminal(payload, record.runId)
  }
}

export const normalizeSeedRun = (record: SeedRunRecord): SeedRunRecord => {
  const next = clone(record)
  finalizeRunIfNeeded(next)
  return next
}
