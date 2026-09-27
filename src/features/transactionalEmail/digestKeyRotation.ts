import type { PayloadRequest } from 'payload'
import { countOutboxDigestVersionReferences } from './capability'
import { TransactionalEmailError } from './errors'
import {
  loadHostedLettermintBinding,
  requireVerifiedHostedBinding,
  type HostedLettermintBinding,
} from './hostedConfiguration'
import { countSuppressionVersionReferences } from './suppression'
import { runOwnedTransaction } from './transactions'

export type DigestKeyRetirementEvidence = Readonly<{
  environment: 'preview' | 'production'
  version: string
  outboxRecords: number
  suppressionRecords: number
  previewAllowlistEntries: number
}>
export type DigestKeyRetirementApproval = Readonly<{
  environment: 'preview' | 'production'
  version: string
  fingerprint: Readonly<{ bindingId: string; sha256: string; version: string }>
}>

export class DigestKeyRetirementBlockedError extends TransactionalEmailError {
  constructor(readonly evidence: DigestKeyRetirementEvidence) {
    super('digest-key-retirement-blocked')
    this.name = 'DigestKeyRetirementBlockedError'
  }
}

function countPreviewAllowlistReferences(binding: HostedLettermintBinding, version: string) {
  if (binding.target.environment === 'production') {
    if (process.env.LETTERMINT_PREVIEW_RECIPIENT_DIGESTS !== undefined)
      throw new TransactionalEmailError('environment-unavailable')
    return 0
  }
  let previewAllowlist: unknown
  try {
    previewAllowlist = JSON.parse(process.env.LETTERMINT_PREVIEW_RECIPIENT_DIGESTS ?? '[]')
  } catch {
    throw new TransactionalEmailError('environment-unavailable')
  }
  if (
    !Array.isArray(previewAllowlist) ||
    previewAllowlist.some(
      (digest) => typeof digest !== 'string' || !/^[A-Za-z0-9_-]{1,128}:[a-f0-9]{64}$/.test(digest),
    ) ||
    new Set(previewAllowlist).size !== previewAllowlist.length
  )
    throw new TransactionalEmailError('environment-unavailable')
  const supported = new Set(binding.recipientDigestKeys.map((key) => key.version))
  if (previewAllowlist.some((digest) => !supported.has(digest.slice(0, digest.indexOf(':')))))
    throw new TransactionalEmailError('environment-unavailable')
  return previewAllowlist.filter((digest) => digest.startsWith(`${version}:`)).length
}

/**
 * Returns only non-secret usage counts. Removing a key is permitted only when this proof succeeds.
 * There is deliberately no force option; forced retirement needs a separate approved migration.
 */
async function requireDigestKeyRetirementSafety(
  req: PayloadRequest,
  binding: HostedLettermintBinding,
  version: string,
): Promise<DigestKeyRetirementEvidence> {
  requireVerifiedHostedBinding(binding)
  if (!binding.recipientDigestKeys.slice(1).some((key) => key.version === version))
    throw new TransactionalEmailError('environment-unavailable')
  const previewAllowlistEntries = countPreviewAllowlistReferences(binding, version)
  const { outboxRecords, suppressionRecords } = await runOwnedTransaction(req, async (transactionReq) => {
    const outboxRecords = await countOutboxDigestVersionReferences(transactionReq, binding.target.environment, version)
    const suppressionRecords = await countSuppressionVersionReferences(
      transactionReq,
      binding.target.environment,
      version,
    )
    return { outboxRecords, suppressionRecords }
  })
  const evidence = Object.freeze({
    environment: binding.target.environment,
    version,
    outboxRecords,
    suppressionRecords,
    previewAllowlistEntries,
  })
  if (outboxRecords || suppressionRecords || previewAllowlistEntries)
    throw new DigestKeyRetirementBlockedError(evidence)
  return evidence
}

/**
 * The only supported retirement path. It proves zero live references against the active hosted
 * configuration before allowing the caller to remove the reviewed fingerprint.
 */
export async function retireDigestKey(
  req: PayloadRequest,
  environment: 'preview' | 'production',
  version: string,
  retireConfiguration: (approval: DigestKeyRetirementApproval) => Promise<void> | void,
) {
  if (
    process.env.VERCEL_ENV !== environment ||
    process.env.DEPLOYMENT_ENV !== environment ||
    process.env.CI === 'true' ||
    process.env.NODE_ENV === 'test' ||
    typeof retireConfiguration !== 'function'
  )
    throw new TransactionalEmailError('environment-unavailable')
  const binding = loadHostedLettermintBinding(environment)
  const fingerprint = binding.credentialEvidence.previousDigestKeys.find((entry) => entry.version === version)
  if (!fingerprint) throw new TransactionalEmailError('environment-unavailable')
  const evidence = await requireDigestKeyRetirementSafety(req, binding, version)
  await retireConfiguration(Object.freeze({ environment, version, fingerprint }))
  return evidence
}
