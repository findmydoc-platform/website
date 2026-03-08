import { getPayload } from 'payload'
import type { ServerLogger } from './shared'

let payloadPromise: Promise<Awaited<ReturnType<typeof getPayload>>> | null = null

const initializePayload = async () => {
  const { default: config } = await import('@payload-config')
  return getPayload({ config })
}

const consoleLogger: ServerLogger = {
  debug: console.debug.bind(console),
  error: console.error.bind(console),
  fatal: console.error.bind(console),
  info: console.info.bind(console),
  level: 'error',
  trace: console.trace.bind(console),
  warn: console.warn.bind(console),
}

export const getServerLogger = async (): Promise<ServerLogger> => {
  try {
    if (!payloadPromise) {
      const nextPayloadPromise = initializePayload().catch((error) => {
        if (payloadPromise === nextPayloadPromise) {
          payloadPromise = null
        }

        throw error
      })

      payloadPromise = nextPayloadPromise
    }

    const payload = await payloadPromise
    return payload.logger as ServerLogger
  } catch (error) {
    console.error('Failed to initialize Payload logger, falling back to console logger', error)
    return consoleLogger
  }
}
