import { formatSeedJobTitle, formatSeedStepTitle } from '@/endpoints/seed/utils/labels'
import type { SeedRunSnapshot } from '@/endpoints/seed/utils/state'

export type SeedJob = SeedRunSnapshot['jobs'][number]

export type SeedJobSummary = {
  id: string
  order: number
  title: string
  status: SeedJob['status']
  jobs: SeedJob[]
  created: number
  updated: number
  warningCount: number
  failureCount: number
  chunkIndex?: number
  chunkTotal?: number
  retryableJobs: SeedJob[]
  issueLabels: string[]
  isBatchGroup: boolean
}

const formatJobStatus = (status: SeedJob['status']): string => {
  if (status === 'succeeded') return 'succeeded'
  if (status === 'failed') return 'failed'
  if (status === 'cancelled') return 'cancelled'
  if (status === 'skipped') return 'skipped'
  if (status === 'running') return 'running'
  return 'queued'
}

const isTerminalJobStatus = (status: SeedJob['status']): boolean => {
  return status === 'succeeded' || status === 'failed' || status === 'cancelled' || status === 'skipped'
}

const isBatchJob = (job: SeedJob): boolean => {
  return typeof job.chunkTotal === 'number' && job.chunkTotal > 1
}

const getSeedUnitKey = (job: SeedJob): string => {
  if (!isBatchJob(job)) return `job:${job.id}`

  return ['batch', job.kind, job.stepName, job.collection ?? '', job.fileName ?? ''].join(':')
}

const resolveSeedUnitStatus = (jobs: SeedJob[]): SeedJob['status'] => {
  if (jobs.some((job) => job.status === 'failed')) return 'failed'
  if (jobs.some((job) => job.status === 'cancelled')) return 'cancelled'
  if (jobs.some((job) => job.status === 'running')) return 'running'
  if (jobs.some((job) => isTerminalJobStatus(job.status)) && jobs.some((job) => job.status === 'queued')) {
    return 'running'
  }
  if (jobs.every((job) => job.status === 'skipped')) return 'skipped'
  if (jobs.every((job) => job.status === 'succeeded' || job.status === 'skipped')) return 'succeeded'
  return 'queued'
}

const resolveSeedUnitChunkIndex = (jobs: SeedJob[]): number | undefined => {
  const runningChunkIndex = jobs.find((job) => job.status === 'running')?.chunkIndex
  if (typeof runningChunkIndex === 'number') return runningChunkIndex

  const completedChunks = jobs.filter((job) => isTerminalJobStatus(job.status)).length
  if (completedChunks > 0) return completedChunks

  return jobs.find((job) => typeof job.chunkIndex === 'number')?.chunkIndex
}

const formatBatchLabel = (job: SeedJob): string => {
  if (typeof job.chunkIndex === 'number' && typeof job.chunkTotal === 'number' && job.chunkTotal > 1) {
    return `Batch ${job.chunkIndex}/${job.chunkTotal}`
  }

  return job.title ?? formatSeedJobTitle(job.stepName, job.chunkIndex, job.chunkTotal)
}

export const formatRetryBatchLabel = (job: SeedJob): string => {
  if (typeof job.chunkIndex === 'number' && typeof job.chunkTotal === 'number' && job.chunkTotal > 1) {
    return `${job.chunkIndex}/${job.chunkTotal}`
  }

  return 'job'
}

const buildIssueLabel = (job: SeedJob): string | null => {
  const issueParts: string[] = []

  if (job.status === 'failed' || job.status === 'cancelled') {
    issueParts.push(formatJobStatus(job.status))
  }
  if (job.warnings.length > 0) {
    issueParts.push(`${job.warnings.length} warning(s)`)
  }
  if (job.failures.length > 0) {
    issueParts.push(`${job.failures.length} failure(s)`)
  }

  if (issueParts.length === 0) return null

  return `${formatBatchLabel(job)}: ${issueParts.join(', ')}`
}

export const buildSeedJobSummaries = (jobs: SeedJob[]): SeedJobSummary[] => {
  const groups = new Map<string, SeedJob[]>()
  const order: string[] = []

  for (const job of jobs) {
    const key = getSeedUnitKey(job)
    if (!groups.has(key)) {
      groups.set(key, [])
      order.push(key)
    }
    groups.get(key)!.push(job)
  }

  return order.map((key) => {
    const groupedJobs = [...groups.get(key)!].sort((a, b) => a.order - b.order)
    const firstJob = groupedJobs[0]!
    const isBatchGroup = groupedJobs.some(isBatchJob)
    const title = isBatchGroup
      ? formatSeedStepTitle(firstJob.stepName)
      : (firstJob.title ?? formatSeedJobTitle(firstJob.stepName, firstJob.chunkIndex, firstJob.chunkTotal))
    const chunkTotal = isBatchGroup
      ? Math.max(...groupedJobs.map((job) => job.chunkTotal ?? groupedJobs.length))
      : undefined

    return {
      id: isBatchGroup ? key : firstJob.id,
      order: firstJob.order,
      title,
      status: resolveSeedUnitStatus(groupedJobs),
      jobs: groupedJobs,
      created: groupedJobs.reduce((total, job) => total + job.created, 0),
      updated: groupedJobs.reduce((total, job) => total + job.updated, 0),
      warningCount: groupedJobs.reduce((total, job) => total + job.warnings.length, 0),
      failureCount: groupedJobs.reduce((total, job) => total + job.failures.length, 0),
      chunkIndex: isBatchGroup ? resolveSeedUnitChunkIndex(groupedJobs) : undefined,
      chunkTotal,
      retryableJobs: groupedJobs.filter((job) => job.status === 'failed' || job.status === 'cancelled'),
      issueLabels: groupedJobs.flatMap((job) => {
        const issueLabel = buildIssueLabel(job)
        return issueLabel ? [issueLabel] : []
      }),
      isBatchGroup,
    }
  })
}
