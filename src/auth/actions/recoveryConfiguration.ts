import { z } from 'zod'
import { authActionEnvironments } from './contracts'
import { validatedRecoveryKeys, type RecoveryKey } from './recoveryContext'

/** Resolved lazily so disabled recovery cannot affect unrelated commands. */
export function resolveRecoveryKeys(
  environment: (typeof authActionEnvironments)[number],
  env: Record<string, string | undefined> = process.env,
): readonly RecoveryKey[] {
  try {
    const config = z
      .object({
        environment: z.enum(authActionEnvironments),
        keys: z.array(z.object({ version: z.string(), secret: z.string() }).strict()).min(1),
      })
      .strict()
      .parse(JSON.parse(env.AUTH_RECOVERY_CORRELATION_KEYS_JSON ?? ''))
    const keys = validatedRecoveryKeys(config.keys)
    if (config.environment !== environment || !keys) throw new Error()
    return keys
  } catch {
    throw new Error('Recovery configuration is unavailable.')
  }
}
