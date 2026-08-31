import config from '@payload-config'
import { GRAPHQL_POST, REST_OPTIONS } from '@payloadcms/next/routes'

import { withPayloadInitializationAvailability } from './payloadInitialization'

export const POST = withPayloadInitializationAvailability(config, GRAPHQL_POST(config), 'graphql')
export const OPTIONS = withPayloadInitializationAvailability(config, REST_OPTIONS(config), 'graphql')
