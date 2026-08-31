import config from '@payload-config'
import '@payloadcms/next/css'
import { REST_DELETE, REST_GET, REST_OPTIONS, REST_PATCH, REST_POST, REST_PUT } from '@payloadcms/next/routes'

import { withPayloadInitializationAvailability } from './payloadInitialization'

export const GET = withPayloadInitializationAvailability(config, REST_GET(config), 'rest')
export const POST = withPayloadInitializationAvailability(config, REST_POST(config), 'rest')
export const DELETE = withPayloadInitializationAvailability(config, REST_DELETE(config), 'rest')
export const PATCH = withPayloadInitializationAvailability(config, REST_PATCH(config), 'rest')
export const PUT = withPayloadInitializationAvailability(config, REST_PUT(config), 'rest')
export const OPTIONS = withPayloadInitializationAvailability(config, REST_OPTIONS(config), 'rest')
