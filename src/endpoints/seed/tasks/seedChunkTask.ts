import type { Payload, PayloadRequest } from 'payload'
import type { BasicUser } from '@/payload-types'
import { createStableIdResolvers } from '../utils/resolvers'
import { importCollection } from '../utils/import-collection'
import { importGlobals } from '../utils/import-globals'
import { resetCollections } from '../utils/reset'
import type { SeedQueueJobInput } from '../utils/job-types'
import { formatSeedChangeSummary, formatSeedJobTitle, formatSeedStepTitle } from '../utils/labels'
import {
  attachSeedRunError,
  attachSeedRunInfo,
  attachSeedRunWarning,
  finishSeedRunJob,
  loadSeedRunRecord,
  markSeedRunCancelled,
  type SeedLogEntry,
  setSeedRunActiveJob,
} from '../utils/state'

const resolvePlatformSeedActorId = async (
  payload: Payload,
  req?: Partial<PayloadRequest>,
): Promise<string | number | null> => {
  if (req?.user && typeof req.user === 'object' && 'collection' in req.user && 'id' in req.user) {
    const collection = (req.user as { collection?: unknown }).collection
    const id = (req.user as { id?: unknown }).id
    if (collection === 'basicUsers' && (typeof id === 'string' || typeof id === 'number')) {
      return id
    }
  }

  const users = await payload.find({
    collection: 'basicUsers',
    where: { userType: { equals: 'platform' } },
    limit: 1,
    sort: 'createdAt',
    overrideAccess: true,
    depth: 0,
  })

  return users.docs[0]?.id ?? null
}

const resolveSeedReqForJob = async (
  payload: Payload,
  input: SeedQueueJobInput,
): Promise<Partial<PayloadRequest> | undefined> => {
  if (!input.reqUserStableId) {
    return undefined
  }

  const resolvers = createStableIdResolvers(payload)
  const userId = await resolvers.resolveIdByStableId('basicUsers', input.reqUserStableId)
  if (!userId) {
    return undefined
  }

  const userDoc = (await payload.findByID({
    collection: 'basicUsers',
    id: userId,
    overrideAccess: true,
  })) as BasicUser

  return {
    user: { ...userDoc, collection: 'basicUsers' } as NonNullable<PayloadRequest['user']>,
  }
}

const getLogContext = (
  input: SeedQueueJobInput,
  jobId: string,
): Pick<SeedLogEntry, 'title' | 'jobId' | 'stepName' | 'kind' | 'collection' | 'chunkIndex' | 'chunkTotal'> => ({
  title: formatSeedStepTitle(input.stepName),
  jobId,
  stepName: input.stepName,
  kind: input.kind,
  collection: input.collection,
  chunkIndex: input.chunkIndex,
  chunkTotal: input.chunkTotal,
})

const cancelQueuedJobsForBaselineRun = async (args: {
  payload: Payload
  queue: string
  req: PayloadRequest
  runId: string
}) => {
  const jobsApi = args.payload.jobs as unknown as {
    cancel: (options: {
      queue?: string
      where: unknown
      req: PayloadRequest
      overrideAccess?: boolean
    }) => Promise<void>
  }

  try {
    await jobsApi.cancel({
      queue: args.queue,
      where: { status: { equals: 'queued' } },
      req: args.req,
      overrideAccess: true,
    })
  } catch {
    // Ignore queue cancellation failures; the run record still prevents further advancement.
  }

  await markSeedRunCancelled(args.payload, args.runId)
}

export const seedChunkTask = {
  slug: 'seedChunk',
  label: 'Seed chunk',
  concurrency: ({ input }: { input: SeedQueueJobInput; queue: string }) => input.runId,
  handler: async ({
    input,
    job,
    req,
  }: {
    input: SeedQueueJobInput
    job: { id: string | number }
    req: PayloadRequest
  }) => {
    const runId = input.runId
    const jobId = String(job.id)
    const payload = req.payload
    const jobTitle = input.title ?? formatSeedJobTitle(input.stepName, input.chunkIndex, input.chunkTotal)

    const run = await loadSeedRunRecord(payload, runId)
    if (!run) {
      throw new Error(`Seed run ${runId} not found`)
    }

    await setSeedRunActiveJob(payload, runId, { jobId, stepName: input.stepName })
    await attachSeedRunInfo(payload, runId, 'Started', getLogContext(input, jobId))

    try {
      if (input.kind === 'reset') {
        await resetCollections(payload, input.type)

        const next = await finishSeedRunJob(payload, runId, {
          jobId,
          status: 'succeeded',
          created: 0,
          updated: 0,
          warnings: [],
          failures: [],
          output: {
            runId,
            jobId,
            stepName: input.stepName,
            kind: input.kind,
            status: 'succeeded',
            created: 0,
            updated: 0,
            warnings: [],
            failures: [],
          },
        })

        if (!next) {
          throw new Error(`Seed run ${runId} disappeared while finishing ${jobTitle}`)
        }

        await attachSeedRunInfo(payload, runId, 'Completed', getLogContext(input, jobId))

        return {
          output: {
            runId,
            jobId,
            stepName: input.stepName,
            kind: input.kind,
            status: 'succeeded',
            created: 0,
            updated: 0,
            warnings: [],
            failures: [],
          },
        }
      }

      if (input.kind === 'globals') {
        const result = await importGlobals(payload)
        const warnings = [...result.warnings]
        const failures = [...result.failures]
        const jobStatus = failures.length > 0 ? 'failed' : 'succeeded'

        for (const warning of warnings) {
          await attachSeedRunWarning(payload, runId, warning, getLogContext(input, jobId))
        }
        for (const failure of failures) {
          await attachSeedRunError(payload, runId, failure, getLogContext(input, jobId))
        }

        const next = await finishSeedRunJob(payload, runId, {
          jobId,
          status: jobStatus,
          created: result.created,
          updated: result.updated,
          warnings,
          failures,
          error: failures[0],
          output: {
            runId,
            jobId,
            stepName: input.stepName,
            kind: input.kind,
            status: jobStatus,
            created: result.created,
            updated: result.updated,
            warnings,
            failures,
          },
        })

        if (!next) {
          throw new Error(`Seed run ${runId} disappeared while finishing globals job`)
        }

        if (jobStatus === 'failed') {
          await attachSeedRunError(
            payload,
            runId,
            `Failed: ${formatSeedChangeSummary(result.created, result.updated)}`,
            getLogContext(input, jobId),
          )
          if (input.type === 'baseline') {
            await attachSeedRunError(
              payload,
              runId,
              'Baseline seed failed; cancelling remaining jobs.',
              getLogContext(input, jobId),
            )
            await cancelQueuedJobsForBaselineRun({
              payload,
              queue: input.queue,
              req,
              runId,
            })
          }

          return {
            state: 'failed' as const,
            errorMessage: failures[0] ?? `Seed chunk ${jobTitle} failed`,
          }
        }

        await attachSeedRunInfo(
          payload,
          runId,
          `Completed: ${formatSeedChangeSummary(result.created, result.updated)}`,
          getLogContext(input, jobId),
        )

        return {
          output: {
            runId,
            jobId,
            stepName: input.stepName,
            kind: input.kind,
            status: 'succeeded',
            created: result.created,
            updated: result.updated,
            warnings,
            failures,
          },
        }
      }

      const resolvers = createStableIdResolvers(payload)
      const seedReq = await resolveSeedReqForJob(payload, input)

      let defaults: Record<string, unknown> | undefined
      if (input.requiresPlatformUser) {
        const platformSeedActorId = await resolvePlatformSeedActorId(payload, seedReq)
        if (!platformSeedActorId) {
          const warning = 'No platform basic user available for media attribution.'
          await attachSeedRunWarning(payload, runId, warning, getLogContext(input, jobId))

          const next = await finishSeedRunJob(payload, runId, {
            jobId,
            status: 'skipped',
            created: 0,
            updated: 0,
            warnings: [warning],
            failures: [],
            output: {
              runId,
              jobId,
              stepName: input.stepName,
              kind: input.kind,
              status: 'skipped',
              created: 0,
              updated: 0,
              warnings: [warning],
              failures: [],
              skipped: true,
            },
          })

          if (!next) {
            throw new Error(`Seed run ${runId} disappeared while skipping ${jobTitle}`)
          }

          await attachSeedRunInfo(payload, runId, 'Skipped', getLogContext(input, jobId))

          return {
            output: {
              runId,
              jobId,
              stepName: input.stepName,
              kind: input.kind,
              status: 'succeeded',
              created: 0,
              updated: 0,
              warnings: [warning],
              failures: [],
              skipped: true,
            },
          }
        }

        if (input.collection === 'platformContentMedia') {
          defaults = { createdBy: platformSeedActorId }
        }
      }

      const result = await importCollection({
        payload,
        kind: input.type,
        collection: input.collection as never,
        fileName: input.fileName ?? input.stepName,
        mapping: input.mapping,
        defaults,
        resolvers,
        context: input.context,
        req: seedReq,
        stableIds: input.stableIds,
      })

      const warnings = [...result.warnings]
      const failures = [...result.failures]
      const jobStatus = failures.length > 0 ? 'failed' : 'succeeded'

      for (const warning of warnings) {
        await attachSeedRunWarning(payload, runId, warning, getLogContext(input, jobId))
      }
      for (const failure of failures) {
        await attachSeedRunError(payload, runId, failure, getLogContext(input, jobId))
      }

      const next = await finishSeedRunJob(payload, runId, {
        jobId,
        status: jobStatus,
        created: result.created,
        updated: result.updated,
        warnings,
        failures,
        error: failures[0],
        output: {
          runId,
          jobId,
          stepName: input.stepName,
          kind: input.kind,
          status: jobStatus,
          created: result.created,
          updated: result.updated,
          warnings,
          failures,
        },
      })

      if (!next) {
        throw new Error(`Seed run ${runId} disappeared while finishing ${jobTitle}`)
      }

      if (jobStatus === 'failed') {
        await attachSeedRunError(
          payload,
          runId,
          `Failed: ${formatSeedChangeSummary(result.created, result.updated)}`,
          getLogContext(input, jobId),
        )
      } else {
        await attachSeedRunInfo(
          payload,
          runId,
          `Completed: ${formatSeedChangeSummary(result.created, result.updated)}`,
          getLogContext(input, jobId),
        )
      }

      if (jobStatus === 'failed') {
        if (input.type === 'baseline') {
          await attachSeedRunError(
            payload,
            runId,
            'Baseline seed failed; cancelling remaining jobs.',
            getLogContext(input, jobId),
          )
          await cancelQueuedJobsForBaselineRun({
            payload,
            queue: input.queue,
            req,
            runId,
          })
        }

        return {
          state: 'failed' as const,
          errorMessage: failures[0] ?? `Seed chunk ${jobTitle} failed`,
        }
      }

      return {
        output: {
          runId,
          jobId,
          stepName: input.stepName,
          kind: input.kind,
          status: 'succeeded',
          created: result.created,
          updated: result.updated,
          warnings,
          failures,
          chunkIndex: input.chunkIndex,
          chunkTotal: input.chunkTotal,
        },
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await attachSeedRunError(payload, runId, message, getLogContext(input, jobId))

      const currentRun = await loadSeedRunRecord(payload, runId)
      if (currentRun && currentRun.type === 'baseline' && currentRun.status !== 'cancelled') {
        await cancelQueuedJobsForBaselineRun({
          payload,
          queue: input.queue,
          req,
          runId,
        })
      }

      throw error
    }
  },
}
