import { receiveLettermintWebhook } from '@/features/transactionalEmail/lettermintWebhook'
import { createDeliveryEdgeSignals } from '@/features/transactionalEmail/operationalSignals'
import { fallbackConsoleLogger } from '@/utilities/logging/consoleLogger'

export const runtime = 'nodejs'

export function POST(request: Request, context: { params: Promise<{ environment: string }> }) {
  const signals = createDeliveryEdgeSignals({ log: (event) => fallbackConsoleLogger.warn(event) })
  return receiveLettermintWebhook(request, context.params, { signal: signals.emit })
}
