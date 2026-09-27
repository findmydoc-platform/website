import { receiveLettermintWebhook } from '@/features/transactionalEmail/lettermintWebhook'

export const runtime = 'nodejs'

export function POST(request: Request, context: { params: Promise<{ environment: string }> }) {
  return receiveLettermintWebhook(request, context.params)
}
