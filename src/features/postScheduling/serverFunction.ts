import { schedulePublishHandler } from '@payloadcms/ui/utilities/schedulePublishHandler'
import { findSchedule, isPostSchedule, logSchedule, scheduledInstant, schedulingRequest } from './logging'

export const loggedSchedulePublishHandler: typeof schedulePublishHandler = async (args) => {
  const { req } = args
  const schedule = args.deleteID
    ? await findSchedule(req, args.deleteID)
    : {
        input: {
          doc: args.doc,
          type: args.type,
          locale: args.localeToPublish,
          timezone: args.timezone,
          user: req.user?.collection ? { relationTo: req.user.collection, value: req.user.id } : undefined,
        },
        waitUntil: scheduledInstant(args.date),
      }
  if (!schedule || !isPostSchedule(schedule)) return schedulePublishHandler(args)
  return schedulingRequest.run({ req }, async () => {
    const context = schedulingRequest.getStore()!
    const failure = (error: unknown) => {
      if (!context.creationFailed && !context.cancelled)
        logSchedule(
          req.payload,
          args.deleteID ? 'cancellation_failed' : 'creation_failed',
          schedule ?? { id: args.deleteID },
          req,
          args.deleteID ? { reason: 'explicit' } : {},
          error,
        )
    }
    try {
      const result = await schedulePublishHandler(args)
      if (result && typeof result === 'object' && 'error' in result) failure(new Error())
      else if (args.deleteID && !context.cancelled && (await findSchedule(req, args.deleteID))) failure(new Error())
      return result
    } catch (error) {
      failure(error)
      throw error
    }
  })
}
