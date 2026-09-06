export type SeedRunType = 'baseline' | 'demo'
export type SeedRunStatus = 'queued' | 'running' | 'completed' | 'partial' | 'failed' | 'cancelled'
export type SeedJobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'skipped'
export type SeedLogSeverity = 'INFO' | 'WARN' | 'ERROR'

export type SeedJobViewModel = {
  id: string
  order: number
  status: SeedJobStatus
  title?: string
  stepName: string
  kind: string
  collection?: string
  fileName?: string
  chunkIndex?: number
  chunkTotal?: number
  created: number
  updated: number
  warnings: string[]
  failures: string[]
  input?: unknown
  queue?: string
  createdAt?: string
  startedAt?: string
  completedAt?: string
  error?: string
  output?: Record<string, unknown>
}

export type SeedLogEntryViewModel = {
  id: string
  severity: SeedLogSeverity
  text: string
  title?: string
  jobId?: string
  stepName?: string
  chunkIndex?: number
  chunkTotal?: number
  at?: string
  runId?: string
  kind?: string
  collection?: string
}

export type SeedRunFinalFlushViewModel = {
  status: 'executed' | 'failed' | 'skipped'
  tagCount: number
  pathCount: number
  failureCount: number
  reason?: 'no-public-work' | 'incomplete-atomic-group' | 'planner-error' | 'executor-error'
  completedAt?: string
}

export type SeedRunViewModel = {
  runId: string
  type: SeedRunType
  reset: boolean
  queue: string
  title?: string
  status: SeedRunStatus
  completedAt?: string
  activeStepName?: string
  jobs: SeedJobViewModel[]
  logs: SeedLogEntryViewModel[]
  progress: {
    completed: number
    total: number
    percent: number
  }
  hasActiveJob: boolean
  finalFlush?: SeedRunFinalFlushViewModel
  createdAt?: string
  startedAt?: string
  totalJobs?: number
  completedJobs?: number
  succeededJobs?: number
  failedJobs?: number
  cancelledJobs?: number
  activeJobId?: string
  warnings?: string[]
  failures?: string[]
  totals?: { created: number; updated: number }
  jobIds?: string[]
}
