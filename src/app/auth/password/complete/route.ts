import type { NextRequest } from 'next/server'
import { completeWebsiteRecovery } from '@/auth/actions/websiteRecoveryHttp'

export async function POST(request: NextRequest) {
  return completeWebsiteRecovery(request)
}
