import { POST as payloadPost } from '@/features/databaseAvailability/payloadRestRoute'
import { withMcpResponseCompletion } from '@/features/mcp/responseCompletion'

export { DELETE, GET, OPTIONS, PATCH, PUT } from '@/features/databaseAvailability/payloadRestRoute'
export const POST = withMcpResponseCompletion(payloadPost)
