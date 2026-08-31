import { getPayload, type SanitizedConfig } from 'payload'

import {
  classifyDatabaseAvailabilityError,
  databaseTemporarilyUnavailableGraphqlResponse,
  databaseTemporarilyUnavailableResponse,
  reportDatabaseAvailabilityFailure,
} from './availability'

type PayloadRouteHandler<Args extends unknown[]> = (request: Request, ...args: Args) => Promise<Response> | Response

export const withPayloadInitializationAvailability = <Args extends unknown[]>(
  config: Promise<SanitizedConfig> | SanitizedConfig,
  handler: PayloadRouteHandler<Args>,
  responseKind: 'graphql' | 'rest',
): PayloadRouteHandler<Args> => {
  return async (request, ...args) => {
    try {
      await getPayload({ config, cron: true })
    } catch (error: unknown) {
      const failure = classifyDatabaseAvailabilityError(error)
      if (!failure) throw error

      reportDatabaseAvailabilityFailure({
        failure,
        phase: 'payload-init',
        req: request,
      })
      return responseKind === 'graphql'
        ? databaseTemporarilyUnavailableGraphqlResponse()
        : databaseTemporarilyUnavailableResponse()
    }

    return handler(request, ...args)
  }
}
