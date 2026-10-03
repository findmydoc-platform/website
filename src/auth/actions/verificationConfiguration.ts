import { z } from 'zod'
import { authActionEnvironments } from './contracts'
import { verificationCorrelations, type VerificationCorrelationKey } from './verificationCorrelation'

const configurationSchema = z
  .object({
    environment: z.enum(authActionEnvironments),
    keys: z.array(z.object({ version: z.string(), secret: z.string() }).strict()).min(1),
  })
  .strict()

/** Resolve only when verification is used; an absent ring must not disable unrelated mail commands. */
export function resolveVerificationKeys(
  environment: (typeof authActionEnvironments)[number],
  env: Record<string, string | undefined> = process.env,
): readonly VerificationCorrelationKey[] {
  try {
    const configuration = configurationSchema.parse(JSON.parse(env.AUTH_VERIFICATION_CORRELATION_KEYS_JSON ?? ''))
    if (configuration.environment !== environment) throw new Error()
    verificationCorrelations('configuration@example.test', environment, configuration.keys)
    return configuration.keys
  } catch {
    throw new Error('Patient verification configuration is unavailable.')
  }
}
