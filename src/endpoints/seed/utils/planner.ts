import fs from 'fs'
import path from 'path'
import type { RelationMapping } from './import-collection'
import { loadSeedFile } from './load-json'
import { baselinePlan, demoPlan, type SeedPlanStep } from './plan'
import type { SeedType } from './runtime'
import type { SeedQueueJobInput, SeedQueueJobKind } from './job-types'
import { formatSeedJobTitle } from './labels'

export type SeedQueueJob = {
  input: SeedQueueJobInput
  title: string
}

const DEFAULT_MAX_CHUNK_BYTES = 1_000_000
const DEFAULT_MAX_CHUNK_ITEMS = 4

type SeedRecordLike = {
  stableId: string
  filePath?: string
}

type ChunkResult = {
  stableIds: string[]
  chunkIndex: number
  chunkTotal: number
}

const getStepPlan = (type: SeedType): SeedPlanStep[] => {
  return type === 'baseline' ? baselinePlan : demoPlan
}

const resolveFileSize = (record: SeedRecordLike): number => {
  if (typeof record.filePath === 'string' && record.filePath.trim().length > 0) {
    const resolvedPath = path.isAbsolute(record.filePath)
      ? record.filePath
      : path.resolve(process.cwd(), record.filePath)
    try {
      return fs.statSync(resolvedPath).size
    } catch {
      return Buffer.byteLength(record.filePath)
    }
  }

  return Buffer.byteLength(record.stableId)
}

const chunkRecords = (records: SeedRecordLike[]): ChunkResult[] => {
  if (records.length === 0) {
    return []
  }

  const chunks: SeedRecordLike[][] = []
  let currentChunk: SeedRecordLike[] = []
  let currentBytes = 0

  const flush = () => {
    if (currentChunk.length > 0) {
      chunks.push(currentChunk)
      currentChunk = []
      currentBytes = 0
    }
  }

  for (const record of records) {
    const recordBytes = resolveFileSize(record)
    const nextBytes = currentBytes + recordBytes
    const nextCount = currentChunk.length + 1
    const wouldOverflow =
      currentChunk.length > 0 && (nextBytes > DEFAULT_MAX_CHUNK_BYTES || nextCount > DEFAULT_MAX_CHUNK_ITEMS)

    if (wouldOverflow) {
      flush()
    }

    currentChunk.push(record)
    currentBytes += recordBytes

    if (currentChunk.length >= DEFAULT_MAX_CHUNK_ITEMS || currentBytes >= DEFAULT_MAX_CHUNK_BYTES) {
      flush()
    }
  }

  flush()

  return chunks.map((chunk, index) => ({
    stableIds: chunk.map((record) => record.stableId),
    chunkIndex: index + 1,
    chunkTotal: chunks.length,
  }))
}

const isMediaChunkableStep = (step: SeedPlanStep, records: SeedRecordLike[]): boolean => {
  if (step.kind !== 'collection') return false
  return records.some((record) => typeof record.filePath === 'string' && record.filePath.trim().length > 0)
}

const createJobInput = (args: {
  runId: string
  type: SeedType
  reset: boolean
  queue: string
  title: string
  step: SeedPlanStep
  kind: SeedQueueJobKind
  stableIds?: string[]
  chunkIndex?: number
  chunkTotal?: number
}): SeedQueueJobInput => {
  if (args.kind === 'reset') {
    return {
      runId: args.runId,
      type: args.type,
      reset: args.reset,
      queue: args.queue,
      title: args.title,
      stepName: 'reset',
      kind: 'reset',
    }
  }

  if (args.step.kind === 'globals') {
    return {
      runId: args.runId,
      type: args.type,
      reset: args.reset,
      queue: args.queue,
      title: args.title,
      stepName: args.step.name,
      kind: 'globals',
      fileName: args.step.fileName,
    }
  }

  return {
    runId: args.runId,
    type: args.type,
    reset: args.reset,
    queue: args.queue,
    title: args.title,
    stepName: args.step.name,
    kind: 'collection',
    collection: args.step.collection,
    fileName: args.step.fileName,
    mapping: args.step.mapping as RelationMapping[] | undefined,
    context: args.step.context,
    reqUserStableId: args.step.reqUserStableId,
    requiresPlatformUser: args.step.requiresPlatformUser,
    stableIds: args.stableIds,
    chunkIndex: args.chunkIndex,
    chunkTotal: args.chunkTotal,
  }
}

export const buildSeedQueueJobs = async (options: {
  runId: string
  type: SeedType
  reset: boolean
  queue: string
}): Promise<SeedQueueJob[]> => {
  const jobs: SeedQueueJob[] = []
  const steps = getStepPlan(options.type)

  if (options.reset) {
    jobs.push({
      input: createJobInput({
        runId: options.runId,
        type: options.type,
        reset: options.reset,
        queue: options.queue,
        title: formatSeedJobTitle('reset'),
        step: { kind: 'globals', name: 'reset', fileName: 'globals' },
        kind: 'reset',
      }),
      title: formatSeedJobTitle('reset'),
    })
  }

  for (const step of steps) {
    if (step.kind === 'globals') {
      jobs.push({
        input: createJobInput({
          runId: options.runId,
          type: options.type,
          reset: options.reset,
          queue: options.queue,
          title: formatSeedJobTitle(step.name),
          step,
          kind: 'globals',
        }),
        title: formatSeedJobTitle(step.name),
      })
      continue
    }

    const records = await loadSeedFile(options.type, step.fileName)
    const chunkable = isMediaChunkableStep(step, records)
    const chunks = chunkable
      ? chunkRecords(records as SeedRecordLike[])
      : [
          {
            stableIds: records.map((record) => record.stableId),
            chunkIndex: 1,
            chunkTotal: 1,
          },
        ]

    for (const chunk of chunks) {
      const jobTitle = formatSeedJobTitle(step.name, chunk.chunkIndex, chunk.chunkTotal)
      jobs.push({
        input: createJobInput({
          runId: options.runId,
          type: options.type,
          reset: options.reset,
          queue: options.queue,
          title: jobTitle,
          step,
          kind: 'collection',
          stableIds: chunk.stableIds,
          chunkIndex: chunk.chunkIndex,
          chunkTotal: chunk.chunkTotal,
        }),
        title: jobTitle,
      })
    }
  }

  return jobs
}

export const getSeedQueueName = (runId: string) => `seed:${runId}`
