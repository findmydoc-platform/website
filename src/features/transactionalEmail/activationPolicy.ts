import { z } from 'zod'
import { commandTypes, type CommandType } from './commands'
import { requireVerifiedHostedBinding, type HostedLettermintBinding } from './hostedConfiguration'
import { TransactionalEmailError } from './errors'
import { recipientAddressDigest } from './recipientBinding'

const reference = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/)
const environment = z.enum(['preview', 'production'])
const fingerprint = z.strictObject({ bindingId: reference, sha256: z.string().regex(/^[a-f0-9]{64}$/) })
const webhookEvents = [
  'message.created',
  'message.sent',
  'message.delivered',
  'message.hard_bounced',
  'message.soft_bounced',
  'message.spam_complaint',
  'message.failed',
  'message.suppressed',
  'message.policy_rejected',
] as const
const preflightSchema = z.strictObject({
  environment,
  version: reference,
  registryVersion: reference,
  target: z.strictObject({
    teamId: reference,
    projectId: reference,
    routeId: reference,
    sender: z.email(),
    webhookId: reference,
    digestKeyId: reference,
  }),
  credentials: z.strictObject({
    projectToken: fingerprint,
    webhookSecret: fingerprint,
    previousWebhookSecret: fingerprint
      .extend({
        overlap: z.strictObject({ startsAt: z.iso.datetime(), validUntil: z.iso.datetime() }),
      })
      .nullable(),
    digestKey: fingerprint,
    previousDigestKeys: z.array(fingerprint.extend({ version: reference })),
  }),
  tracking: z.strictObject({ open: z.literal(false), click: z.literal(false) }),
  webhookEvents: z.array(z.enum(webhookEvents)).length(webhookEvents.length),
  evidence: z.strictObject({
    team: reference,
    project: reference,
    route: reference,
    sender: reference,
    dns: reference,
    webhook: reference,
    tracking: reference,
  }),
})
const recordFields = {
  commandType: z.enum(commandTypes),
  registryVersion: reference,
  preflightVersion: reference,
}
const registrySchema = z.strictObject({
  schemaVersion: z.literal(1),
  version: reference,
  preflights: z.array(preflightSchema).max(2),
  records: z
    .array(
      z.discriminatedUnion('environment', [
        z.strictObject({ ...recordFields, environment: z.literal('preview') }),
        z.strictObject({
          ...recordFields,
          environment: z.literal('production'),
          approvals: z.strictObject({
            dpa: reference,
            subprocessors: reference,
            retentionDeletion: reference,
            digestKeyOwnershipRotation: reference,
            privacyNotice: reference,
            processingPurpose: reference,
            compliance: reference,
            onePath: reference,
          }),
        }),
      ]),
    )
    .max(commandTypes.length * 2),
})

function unavailable(): never {
  throw new TransactionalEmailError('environment-unavailable')
}

export type ActivationSuppression = 'command-not-enabled' | 'preview-recipient-not-allowed'
export type ActivationPolicy = {
  evaluate(command: CommandType, address: string): ActivationSuppression | null
}
const policies = new WeakSet<object>()
const policyBindings = new WeakMap<object, HostedLettermintBinding>()

export function requireActivationPolicy(policy: ActivationPolicy, binding?: HostedLettermintBinding) {
  if (!policies.has(policy)) unavailable()
  if (binding && policyBindings.get(policy) !== binding) unavailable()
}

export function resolveActivationPolicy(
  binding: HostedLettermintBinding,
  input: unknown,
  previewAllowlist?: unknown,
): ActivationPolicy {
  if (typeof window !== 'undefined') unavailable()
  requireVerifiedHostedBinding(binding)
  if (binding.target.environment === 'production' && previewAllowlist !== undefined) unavailable()
  const supportedDigestVersions = new Set(binding.recipientDigestKeys.map(({ version }) => version))
  const allowlist = z
    .array(z.string().regex(/^[A-Za-z0-9_-]{1,128}:[a-f0-9]{64}$/))
    .safeParse(previewAllowlist === undefined ? [] : previewAllowlist)
  if (
    !allowlist.success ||
    new Set(allowlist.data).size !== allowlist.data.length ||
    allowlist.data.some((digest) => !supportedDigestVersions.has(digest.slice(0, digest.indexOf(':'))))
  )
    unavailable()
  const parsed = registrySchema.safeParse(input)
  if (!parsed.success) unavailable()
  const registry = parsed.data
  const { preflights, records } = registry
  if (
    new Set(preflights.map((entry) => entry.environment)).size !== preflights.length ||
    new Set(preflights.map((entry) => entry.version)).size !== preflights.length ||
    new Set(records.map((entry) => `${entry.environment}:${entry.commandType}`)).size !== records.length
  )
    unavailable()
  const cutovers = records.flatMap((entry) => (entry.environment === 'production' ? [entry.approvals.onePath] : []))
  if (new Set(cutovers).size !== cutovers.length) unavailable()
  for (const preflight of preflights) {
    if (
      preflight.registryVersion !== registry.version ||
      new Set(preflight.webhookEvents).size !== webhookEvents.length
    )
      unavailable()
    if (preflight.environment !== binding.target.environment) continue
    for (const key of Object.keys(preflight.target) as (keyof typeof preflight.target)[]) {
      if (preflight.target[key] !== binding.target[key]) unavailable()
    }
    if (preflight.evidence.sender !== binding.target.senderEvidenceId) unavailable()
    for (const kind of ['projectToken', 'webhookSecret', 'digestKey'] as const) {
      if (
        preflight.credentials[kind].bindingId !== binding.credentialEvidence[kind].bindingId ||
        preflight.credentials[kind].sha256 !== binding.credentialEvidence[kind].sha256
      )
        unavailable()
    }
    if (
      new Set(preflight.credentials.previousDigestKeys.map(({ version }) => version)).size !==
        preflight.credentials.previousDigestKeys.length ||
      preflight.credentials.previousDigestKeys.length !== binding.credentialEvidence.previousDigestKeys.length ||
      preflight.credentials.previousDigestKeys.some((key) => {
        const verified = binding.credentialEvidence.previousDigestKeys.find(({ version }) => version === key.version)
        return !verified || verified.bindingId !== key.bindingId || verified.sha256 !== key.sha256
      })
    )
      unavailable()
    const previous = preflight.credentials.previousWebhookSecret
    const verifiedPrevious = binding.credentialEvidence.previousWebhookSecret
    if ((previous === null) !== (verifiedPrevious === null)) unavailable()
    if (
      previous &&
      verifiedPrevious &&
      (previous.bindingId !== verifiedPrevious.bindingId ||
        previous.sha256 !== verifiedPrevious.sha256 ||
        previous.overlap.startsAt !== verifiedPrevious.overlap.startsAt ||
        previous.overlap.validUntil !== verifiedPrevious.overlap.validUntil)
    )
      unavailable()
  }
  if (preflights.length === 2) {
    const [first, second] = preflights
    for (const key of ['teamId', 'projectId', 'routeId', 'webhookId', 'digestKeyId'] as const) {
      if (first!.target[key] === second!.target[key]) unavailable()
    }
    const firstReferences = new Set(Object.values(first!.evidence))
    if (Object.values(second!.evidence).some((value) => firstReferences.has(value))) unavailable()
    const firstCredentials = new Set(
      [
        first!.credentials.projectToken,
        first!.credentials.webhookSecret,
        first!.credentials.previousWebhookSecret,
        first!.credentials.digestKey,
        ...first!.credentials.previousDigestKeys,
      ].flatMap((value) => (value ? [value.bindingId, value.sha256] : [])),
    )
    if (
      [
        second!.credentials.projectToken,
        second!.credentials.webhookSecret,
        second!.credentials.previousWebhookSecret,
        second!.credentials.digestKey,
        ...second!.credentials.previousDigestKeys,
      ].some((value) => value && (firstCredentials.has(value.bindingId) || firstCredentials.has(value.sha256)))
    )
      unavailable()
  }
  for (const record of records) {
    if (
      record.registryVersion !== registry.version ||
      !preflights.some(
        (preflight) => preflight.environment === record.environment && preflight.version === record.preflightVersion,
      )
    )
      unavailable()
  }
  const enabled = new Set(
    records.filter((record) => record.environment === binding.target.environment).map((record) => record.commandType),
  )
  const recipients = new Set(allowlist.data)
  const policy: ActivationPolicy = Object.freeze({
    evaluate(command: CommandType, address: string) {
      if (!enabled.has(command)) return 'command-not-enabled'
      if (binding.target.environment === 'preview') {
        const allowed = binding.recipientDigestKeys.some((key) => {
          const digest = recipientAddressDigest(address, key)
          return digest !== null && recipients.has(digest)
        })
        if (!allowed) return 'preview-recipient-not-allowed'
      }
      return null
    },
  })
  policies.add(policy)
  policyBindings.set(policy, binding)
  return policy
}
