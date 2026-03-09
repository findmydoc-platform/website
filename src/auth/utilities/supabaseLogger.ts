import { createAdminClient } from './supaBaseServer'
import { getServerLogger } from '@/utilities/logging/serverLogger'
import {
  createScopedLogger,
  getRequestLogContext,
  toLoggedError,
  type ScopedLogger,
  type ServerLogger,
} from '@/utilities/logging/shared'

type RequestContextArgs = Parameters<typeof getRequestLogContext>[0]

type SupabaseLoggerArgs = RequestContextArgs & {
  bindings?: Record<string, unknown>
  logger?: ServerLogger
}

type SupabaseAdminClientArgs = SupabaseLoggerArgs & {
  component: string
  meta?: Record<string, unknown>
}

export const getSupabaseLogger = async ({
  bindings,
  headers,
  logger,
  req,
  request,
}: SupabaseLoggerArgs = {}): Promise<ScopedLogger> => {
  const baseLogger =
    logger ??
    createScopedLogger(await getServerLogger(), {
      scope: 'auth.supabase',
      ...getRequestLogContext({ headers, req, request }),
    })

  return createScopedLogger(baseLogger, bindings ?? {})
}

export const getLoggedSupabaseAdminClient = async ({
  bindings,
  component,
  headers,
  logger,
  meta = {},
  req,
  request,
}: SupabaseAdminClientArgs): Promise<{
  activeLogger: ScopedLogger
  supabase: Awaited<ReturnType<typeof createAdminClient>>
}> => {
  const activeLogger = await getSupabaseLogger({
    bindings: {
      component,
      ...bindings,
    },
    headers,
    logger,
    req,
    request,
  })

  try {
    const supabase = await createAdminClient()
    return { activeLogger, supabase }
  } catch (error) {
    activeLogger.error(
      {
        ...meta,
        err: toLoggedError(error),
        event: 'auth.supabase.admin.client_init_failed',
      },
      'Failed to initialize Supabase admin client',
    )
    throw error
  }
}
