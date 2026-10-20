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
const pendingDeletes = new WeakMap<PayloadRequest, Map<number | string, Schedule[]>>()
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
      req: { ...req, query: { ...req.query }, context: { ...req.context } },
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
  const entries = pendingDeletes.get(req) ?? new Map()
  entries.set(id, found)
  pendingDeletes.set(req, entries)
}

const afterPostDelete: CollectionAfterDeleteHook = async ({ id, req, doc }) => {
  const entries = pendingDeletes.get(req)
  const pending = entries?.get(id)
  entries?.delete(id)
  if (pending?.length) {
    const remaining = await schedules(req, { id: { in: pending.map((job) => job.id) } })
    if (remaining)
      for (const job of pending) {
        if (!remaining.some((item) => item.id === job.id))
          logSchedule(req.payload, 'cancelled', job, req, { reason: 'post_deleted' })
        else logSchedule(req.payload, 'cancellation_failed', job, req, { reason: 'post_deleted' }, new Error())
      }
  }
  return doc
}

const afterJobDelete: CollectionAfterDeleteHook = ({ doc, req }) => {
  if (doc.taskSlug === 'schedulePublish' && isPostSchedule(doc) && !doc.completedAt && !doc.processing) {
    logSchedule(req.payload, 'cancelled', doc, req, { reason: 'explicit' })
    const context = schedulingRequest.getStore()
    if (context) context.cancelled = true
  }
  return doc
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
  posts.hooks.afterDelete = [...posts.hooks.afterDelete, afterPostDelete]
  const jobs = payload.collections['payload-jobs'].config
  jobs.hooks.afterDelete = [...jobs.hooks.afterDelete, afterJobDelete]
}
