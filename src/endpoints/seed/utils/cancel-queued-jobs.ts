import type { Payload, PayloadRequest } from 'payload'

export const cancelQueuedSeedJobs = async (args: { payload: Payload; queue: string; req: PayloadRequest }) => {
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
}
