import { handleNotificationRetentionRequest } from '@/features/clinicNotifications/schedulerRequest'
export const runtime = 'nodejs'
export const maxDuration = 300
export const GET = (request: Request) => handleNotificationRetentionRequest(request, 'production', 'GET')
export const POST = (request: Request) => handleNotificationRetentionRequest(request, 'production', 'unsupported')
export const HEAD = POST
export const PUT = POST
export const PATCH = POST
export const DELETE = POST
export const OPTIONS = POST
