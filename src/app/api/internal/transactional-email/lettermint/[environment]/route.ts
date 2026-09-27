import { receiveLettermintWebhook } from '@/features/transactionalEmail/lettermintWebhook'

export const runtime = 'nodejs'

export async function POST(request: Request, context: { params: Promise<{ environment: string }> }) {
  const { environment } = await context.params
  return receiveLettermintWebhook(request, environment)
}
