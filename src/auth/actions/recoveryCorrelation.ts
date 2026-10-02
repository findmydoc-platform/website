import { createHmac } from 'node:crypto'
import { validatedRecoveryKeys, type RecoveryKey } from './recoveryContext'
import { authActionEnvironments } from './contracts'

export const recoveryWindowMs = 60 * 60 * 1000
export const recoveryCooldownMs = 5 * 60 * 1000
export const recoveryHourlyLimit = 5

export function recoveryCorrelations(
  email: string,
  ip: string,
  environment: (typeof authActionEnvironments)[number],
  keys: readonly RecoveryKey[],
) {
  const ring = validatedRecoveryKeys(keys)
  if (!ring) throw new Error('Recovery correlation unavailable.')
  return (['target', 'ip'] as const).map((dimension) => ({
    dimension,
    correlations: ring.map(({ version, secret }) => ({
      keyVersion: version,
      digest: createHmac('sha256', secret)
        .update(
          JSON.stringify(['auth-recovery-correlation-v1', environment, dimension, dimension === 'target' ? email : ip]),
          'utf8',
        )
        .digest('hex'),
    })),
  }))
}
