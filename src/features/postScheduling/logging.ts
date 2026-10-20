import { AsyncLocalStorage } from 'node:async_hooks'
import type { CollectionAfterDeleteHook, CollectionBeforeDeleteHook, Payload, PayloadRequest, Where } from 'payload'
import { getRequestLogContext } from '@/utilities/logging/shared'

type Schedule = {
  id?: number | string
  input?: unknown
  waitUntil?: null | string
  completedAt?: null | string
  processing?: boolean | null
}
type RequestContext = { req: PayloadRequest; creationFailed?: boolean; cancelled?: boolean }
// Next.js can load the config and Admin action through separate server bundles.
const contextKey = Symbol.for('findmydoc.post-scheduling.request.v1')
const existingContext: unknown = Reflect.get(globalThis, contextKey)
export const schedulingRequest = (existingContext ??
  new AsyncLocalStorage<RequestContext>()) as AsyncLocalStorage<RequestContext>
if (!existingContext) Object.defineProperty(globalThis, contextKey, { value: schedulingRequest })
const installed = new WeakSet<Payload>()
type DeleteObservation = {
  req?: PayloadRequest
  callerTransaction: boolean
  pending: Map<number | string, Schedule[]>
  explicit: Schedule[]
}
const deletionRequest = new AsyncLocalStorage<DeleteObservation>()
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
const identifier = (value: unknown) =>
  typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value)) ? value : undefined
const inputOf = (schedule: Schedule) => record(schedule.input)
export const isPostSchedule = (schedule: Schedule) => record(inputOf(schedule).doc).relationTo === 'posts'
export function scheduledInstant(value: unknown) {
  const date = value instanceof Date ? value : typeof value === 'string' ? new Date(value) : undefined
  return date && Number.isFinite(date.getTime()) ? date.toISOString() : undefined
}

function fields(schedule: Schedule) {
  const input = inputOf(schedule)
  const user = record(input.user)
  let timezone: string | undefined
  if (typeof input.timezone === 'string') {
    try {
      timezone = new Intl.DateTimeFormat('en', { timeZone: input.timezone }).resolvedOptions().timeZone
    } catch {
      /* Unknown timezone is omitted. */
    }
  }
  return {
    collection: 'posts',
    postId: identifier(record(input.doc).value),
    jobId: identifier(schedule.id),
    action: input.type === 'publish' || !input.type ? 'publish' : 'unpublish',
    scheduledAt: scheduledInstant(schedule.waitUntil),
    timezone,
    locale: input.type === 'publish' && (input.locale === 'en' || input.locale === 'de') ? input.locale : 'all',
    userId: user.relationTo === 'platformStaff' ? identifier(user.value) : undefined,
  }
}

function sanitizedError(error: unknown) {
  const status = record(error).status
  return {
    name:
      error instanceof Error && ['APIError', 'ValidationError', 'Forbidden', 'NotFound'].includes(error.name)
        ? error.name
        : 'Error',
    ...(typeof status === 'number' ? { status } : {}),
  }
}

export function logSchedule(
  payload: Payload,
  event: string,
  schedule: Schedule,
  req?: PayloadRequest,
  extra: Record<string, unknown> = {},
  error?: unknown,
) {
  // Logging must not change native scheduling, deletion or publication outcomes.
  try {
    const context = getRequestLogContext({ req, headers: req?.headers })
    const logger = payload.logger.child(
      { scope: 'posts.scheduling' },
      { level: context.deploymentEnv === 'test' ? 'error' : 'info' },
    )
    const entry = {
      ...context,
      ...fields(schedule),
      ...(req?.user?.collection === 'platformStaff' ? { actorId: identifier(req.user.id) } : {}),
      ...extra,
      event: `posts.scheduling.${event}`,
      eventTime: new Date().toISOString(),
      ...(error === undefined ? {} : { err: sanitizedError(error) }),
    }
    if (error === undefined) logger.info(entry, 'Post scheduling lifecycle')
    else logger.error(entry, 'Post scheduling lifecycle failed')
  } catch {
    /* Diagnostics must not replace the native result. */
  }
}

async function schedules(req: PayloadRequest, where: Where): Promise<Schedule[] | undefined> {
  try {
    const result = await req.payload.find({
      collection: 'payload-jobs',
      where,
      req: {
        ...req,
        transactionID: undefined,
        payloadDataLoader: undefined,
        query: { ...req.query },
        context: { ...req.context },
      },
      overrideAccess: true,
      depth: 0,
      limit: 0,
      pagination: false,
    })
    return result.docs.filter(isPostSchedule)
  } catch (error) {
    logSchedule(req.payload, 'observation_failed', {}, req, {}, error)
    return undefined
  }
}

export async function findSchedule(req: PayloadRequest, id: number | string) {
  return (await schedules(req, { and: [{ id: { equals: id } }, { taskSlug: { equals: 'schedulePublish' } }] }))?.[0]
}

const beforePostDelete: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const observation = deletionRequest.getStore()
  if (!observation) return
  observation.req = req
  const found = await schedules(req, {
    and: [
      { taskSlug: { equals: 'schedulePublish' } },
      { 'input.doc.relationTo': { equals: 'posts' } },
      { 'input.doc.value': { equals: id } },
      { completedAt: { exists: false } },
      { processing: { equals: false } },
    ],
  })
  if (!found?.length) return
  observation.pending.set(id, found)
}

const afterJobDelete: CollectionAfterDeleteHook = ({ doc, req }) => {
  if (doc.taskSlug === 'schedulePublish' && isPostSchedule(doc) && !doc.completedAt && !doc.processing) {
    const observation = deletionRequest.getStore()
    if (observation) {
      observation.req = req
      observation.explicit.push(doc)
    }
  }
  return doc
}

async function observeDeletion<Result>(
  req: Partial<PayloadRequest> | undefined,
  operation: () => Promise<Result>,
): Promise<Result> {
  const observation: DeleteObservation = {
    callerTransaction: req?.transactionID != null,
    pending: new Map(),
    explicit: [],
  }
  return deletionRequest.run(observation, async () => {
    const result = await operation()
    // Native deletion has returned, including its owned transaction commit and bulk outcomes.
    try {
      const request = observation.req
      if (!request || (!observation.pending.size && !observation.explicit.length)) return result
      const output = record(result instanceof Response ? await result.clone().json() : result)
      const docs = Array.isArray(output.docs) ? output.docs : [output.doc ?? output]
      const deleted = new Set(docs.map((doc) => String(identifier(record(doc).id))))
      const explicit = observation.explicit.filter((job) => deleted.has(String(job.id)))
      const context = schedulingRequest.getStore()
      if (explicit.length && context) context.cancelled = true
      if (observation.callerTransaction) {
        logSchedule(
          request.payload,
          'observation_failed',
          {},
          request,
          { reason: 'caller_transaction_pending' },
          new Error(),
        )
        return result
      }
      for (const job of explicit) logSchedule(request.payload, 'cancelled', job, request, { reason: 'explicit' })
      const pending = [...observation.pending].filter(([id]) => deleted.has(String(id))).flatMap(([, jobs]) => jobs)
      if (!pending.length) return result
      const remaining = await schedules(request, { id: { in: pending.map((job) => job.id) } })
      if (remaining)
        for (const job of pending) {
          if (!remaining.some((item) => item.id === job.id))
            logSchedule(request.payload, 'cancelled', job, request, { reason: 'post_deleted' })
          else
            logSchedule(request.payload, 'cancellation_failed', job, request, { reason: 'post_deleted' }, new Error())
        }
    } catch (error) {
      if (observation.req) logSchedule(observation.req.payload, 'observation_failed', {}, observation.req, {}, error)
    }
    return result
  })
}

/** Decorate native APIs after Payload has generated its scheduled publication task. */
export function installPostSchedulingLogs(payload: Payload) {
  if (installed.has(payload)) return
  installed.add(payload)
  const queue = payload.jobs.queue.bind(payload.jobs)
  payload.jobs.queue = async (args) => {
    const schedule = { input: args.input, waitUntil: scheduledInstant(args.waitUntil) }
    if (args.task !== 'schedulePublish' || !isPostSchedule(schedule)) return queue(args)
    const context = schedulingRequest.getStore()
    const req = args.req ?? context?.req
    try {
      const job = await queue(args)
      logSchedule(payload, 'created', { ...schedule, id: job.id }, req)
      return job
    } catch (error) {
      if (context) context.creationFailed = true
      logSchedule(payload, 'creation_failed', schedule, req, {}, error)
      throw error
    }
  }
  const task = payload.config.jobs.tasks?.find((item) => item.slug === 'schedulePublish')
  const handler = task?.handler
  if (task && typeof handler === 'function')
    task.handler = async (args) => {
      if (!isPostSchedule(args.job)) return handler(args)
      const attempt = (args.job.totalTried ?? 0) + 1
      logSchedule(payload, 'attempt_started', args.job, args.req, { attempt })
      try {
        const result = await handler(args)
        if (result.state === 'failed')
          logSchedule(payload, 'attempt_failed', args.job, args.req, { attempt }, new Error())
        else logSchedule(payload, 'attempt_succeeded', args.job, args.req, { attempt })
        return result
      } catch (error) {
        logSchedule(payload, 'attempt_failed', args.job, args.req, { attempt }, error)
        throw error
      }
    }
  const posts = payload.collections.posts.config
  posts.hooks.beforeDelete = [...posts.hooks.beforeDelete, beforePostDelete]
  const jobs = payload.collections['payload-jobs'].config
  jobs.hooks.afterDelete = [...jobs.hooks.afterDelete, afterJobDelete]
  const nativeDelete = payload.delete.bind(payload)
  payload.delete = ((args: Parameters<Payload['delete']>[0]) =>
    args.collection === 'posts' || args.collection === 'payload-jobs'
      ? observeDeletion(args.req, () => nativeDelete(args))
      : nativeDelete(args)) as Payload['delete']
  for (const config of [posts, jobs]) {
    if (config.endpoints)
      config.endpoints = config.endpoints.map((endpoint) => {
        if (endpoint.method !== 'delete') return endpoint
        const handler = endpoint.handler
        return { ...endpoint, handler: (req) => observeDeletion(req, async () => handler(req)) }
      })
  }
}
