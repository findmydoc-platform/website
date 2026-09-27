import { createHash, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import registry from './lettermintRegistry.json' with { type: 'json' }
import targetLocks from './lettermintTargetLocks.json' with { type: 'json' }
import { TransactionalEmailError } from './errors'
import { recipientAddressDigest } from './recipientBinding'

const environmentSchema = z.enum(['preview', 'production'])
const identifier = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/)
const targetIdentitySchema = z.strictObject({
  teamId: identifier,
  projectId: identifier,
  routeId: identifier,
})
const targetSchema = targetIdentitySchema.extend({
  environment: environmentSchema,
  webhookId: identifier,
  sender: z.email(),
  senderEvidenceId: identifier,
  digestKeyId: identifier,
  activatedTarget: targetIdentitySchema.nullable(),
})
const fingerprintSchema = targetIdentitySchema.extend({
  environment: environmentSchema,
  kind: z.enum(['project-token', 'webhook-current', 'webhook-previous', 'digest-key']),
  bindingId: identifier,
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  webhookId: identifier.nullable(),
  overlap: z.strictObject({ startsAt: z.iso.datetime(), validUntil: z.iso.datetime() }).nullable(),
  digestKeyId: identifier.nullable().optional(),
})
const registrySchema = z.strictObject({
  targets: z.array(targetSchema).length(2),
  fingerprints: z.array(fingerprintSchema).min(6),
})
const targetLocksSchema = z.strictObject({
  targets: z.array(targetIdentitySchema.extend({ environment: environmentSchema })).length(2),
})

type HostedEnvironment = z.infer<typeof environmentSchema>
type Target = z.infer<typeof targetSchema>
type Fingerprint = z.infer<typeof fingerprintSchema>
type CredentialEvidence = Readonly<Pick<Fingerprint, 'bindingId' | 'sha256'>>
type RecipientDigestKey = Readonly<{ version: string; secret: string }>
const verifiedBindings = new WeakSet<object>()
export type HostedLettermintBinding = {
  target: Readonly<Target>
  credentialEvidence: Readonly<
    Record<'projectToken' | 'webhookSecret' | 'digestKey', CredentialEvidence> & {
      previousWebhookSecret: (CredentialEvidence & { overlap: Readonly<NonNullable<Fingerprint['overlap']>> }) | null
      previousDigestKeys: readonly (CredentialEvidence & { version: string })[]
    }
  >
  projectToken: string
  webhookSecret: string
  previousWebhookSecret?: string
  previousWebhookSecretWindow?: Readonly<{ startsAt: number; validUntil: number }>
  digestKey: string
  recipientDigestKeys: readonly RecipientDigestKey[]
}

function unavailable(): never {
  throw new TransactionalEmailError('environment-unavailable')
}

function sameTarget(left: Pick<Target, 'teamId' | 'projectId' | 'routeId'>, right: typeof left) {
  return left.teamId === right.teamId && left.projectId === right.projectId && left.routeId === right.routeId
}

function matchingFingerprint(secret: string, entry: Fingerprint) {
  const actual = createHash('sha256').update(secret, 'utf8').digest()
  const expected = Buffer.from(entry.sha256, 'hex')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

function secret(value: string | undefined, kind: 'project-token' | 'webhook' | 'digest-key') {
  if (!value || value !== value.trim() || /[\r\n\0]/.test(value)) unavailable()
  if (kind === 'project-token' && !/^lm_[A-Za-z0-9_-]{16,}$/.test(value)) unavailable()
  if (kind !== 'project-token' && (value.length < 16 || value.length > 1024)) unavailable()
  return value
}

function previousDigestSecrets(value: string | undefined) {
  if (value === undefined) return new Map<string, string>()
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    unavailable()
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) unavailable()
  const entries = Object.entries(parsed)
  if (entries.some(([version, value]) => !/^[A-Za-z0-9_-]{1,128}$/.test(version) || typeof value !== 'string'))
    unavailable()
  return new Map(entries.map(([version, value]) => [version, secret(value as string, 'digest-key')]))
}

export function resolveHostedLettermintBinding(
  environment: HostedEnvironment,
  input: unknown,
  env: Record<string, string | undefined>,
  now = Date.now(),
  locks: unknown = targetLocks,
): HostedLettermintBinding {
  const parsed = registrySchema.safeParse(input)
  const parsedLocks = targetLocksSchema.safeParse(locks)
  if (!parsed.success || !parsedLocks.success || !Number.isFinite(now)) unavailable()
  if (
    Object.keys(env).some(
      (key) =>
        key.startsWith('LETTERMINT_') &&
        ![
          'LETTERMINT_PROJECT_TOKEN',
          'LETTERMINT_WEBHOOK_SECRET',
          'LETTERMINT_PREVIOUS_WEBHOOK_SECRET',
          'LETTERMINT_RECIPIENT_DIGEST_KEY',
          'LETTERMINT_PREVIOUS_RECIPIENT_DIGEST_KEYS',
          ...(environment === 'preview' ? ['LETTERMINT_PREVIEW_RECIPIENT_DIGESTS'] : []),
        ].includes(key),
    )
  )
    unavailable()
  const { targets, fingerprints } = parsed.data
  const pinnedTargets = parsedLocks.data.targets
  if (targets[0]!.environment === targets[1]!.environment) unavailable()
  if (pinnedTargets[0]!.environment === pinnedTargets[1]!.environment) unavailable()
  for (const key of ['teamId', 'projectId', 'routeId', 'webhookId', 'senderEvidenceId', 'digestKeyId'] as const) {
    if (targets[0]![key] === targets[1]![key]) unavailable()
  }
  if (
    targets.some((target) => {
      const pinned = pinnedTargets.find((candidate) => candidate.environment === target.environment)
      return (
        !pinned || !target.activatedTarget || !sameTarget(target, target.activatedTarget) || !sameTarget(target, pinned)
      )
    })
  )
    unavailable()
  if (new Set(fingerprints.map((entry) => entry.bindingId)).size !== fingerprints.length) unavailable()
  if (new Set(fingerprints.map((entry) => entry.sha256)).size !== fingerprints.length) unavailable()
  const digestVersions = fingerprints.flatMap((entry) =>
    entry.kind === 'digest-key'
      ? [entry.digestKeyId ?? targets.find(({ environment }) => environment === entry.environment)?.digestKeyId]
      : [],
  )
  if (digestVersions.some((version) => !version) || new Set(digestVersions).size !== digestVersions.length)
    unavailable()
  for (const target of targets) {
    for (const kind of ['project-token', 'webhook-current'] as const) {
      if (fingerprints.filter((entry) => entry.environment === target.environment && entry.kind === kind).length !== 1)
        unavailable()
    }
    const targetDigestKeys = fingerprints.filter(
      (entry) => entry.environment === target.environment && entry.kind === 'digest-key',
    )
    if (
      targetDigestKeys.length < 1 ||
      targetDigestKeys.filter((entry) => (entry.digestKeyId ?? target.digestKeyId) === target.digestKeyId).length !== 1
    )
      unavailable()
    if (
      fingerprints.filter((entry) => entry.environment === target.environment && entry.kind === 'webhook-previous')
        .length > 1
    )
      unavailable()
  }
  for (const entry of fingerprints) {
    const target = targets.find((candidate) => candidate.environment === entry.environment)
    if (!target || !sameTarget(target, entry)) unavailable()
    if (entry.webhookId !== (entry.kind.startsWith('webhook-') ? target.webhookId : null)) unavailable()
    if (entry.kind !== 'digest-key' && entry.digestKeyId != null) unavailable()
    if ((entry.kind === 'webhook-previous') !== Boolean(entry.overlap)) unavailable()
    if (entry.overlap) {
      const start = Date.parse(entry.overlap.startsAt)
      const end = Date.parse(entry.overlap.validUntil)
      if (end <= start || end - start > 600_000) unavailable()
    }
  }

  const target = targets.find((candidate) => candidate.environment === environment)
  if (!target) unavailable()
  const findEntry = (kind: Fingerprint['kind']) =>
    fingerprints.find((entry) => entry.environment === environment && entry.kind === kind)
  const projectToken = secret(env.LETTERMINT_PROJECT_TOKEN, 'project-token')
  const webhookSecret = secret(env.LETTERMINT_WEBHOOK_SECRET, 'webhook')
  const digestKey = secret(env.LETTERMINT_RECIPIENT_DIGEST_KEY, 'digest-key')
  const configuredPreviousDigestKeys = previousDigestSecrets(env.LETTERMINT_PREVIOUS_RECIPIENT_DIGEST_KEYS)
  const previousWebhookSecret = env.LETTERMINT_PREVIOUS_WEBHOOK_SECRET
  const previous = findEntry('webhook-previous')
  const digestEntries = fingerprints
    .filter((entry) => entry.environment === environment && entry.kind === 'digest-key')
    .map((entry) => ({ entry, version: entry.digestKeyId ?? target.digestKeyId }))
  const currentDigestEntry = digestEntries.find(({ version }) => version === target.digestKeyId)
  const previousDigestEntries = digestEntries
    .filter(({ version }) => version !== target.digestKeyId)
    .sort((left, right) => left.version.localeCompare(right.version))
  if (
    !currentDigestEntry ||
    configuredPreviousDigestKeys.has(target.digestKeyId) ||
    configuredPreviousDigestKeys.size !== previousDigestEntries.length ||
    previousDigestEntries.some(({ version }) => !configuredPreviousDigestKeys.has(version))
  )
    unavailable()
  if ((previousWebhookSecret !== undefined) !== Boolean(previous)) unavailable()
  if (previous) {
    if (
      !previous.overlap ||
      now < Date.parse(previous.overlap.startsAt) ||
      now > Date.parse(previous.overlap.validUntil)
    )
      unavailable()
    secret(previousWebhookSecret, 'webhook')
  }
  for (const [kind, value] of [
    ['project-token', projectToken],
    ['webhook-current', webhookSecret],
    ...(previousWebhookSecret ? ([['webhook-previous', previousWebhookSecret]] as const) : []),
  ] as const) {
    const entry = findEntry(kind)
    if (!entry || !matchingFingerprint(value, entry)) unavailable()
  }
  if (!matchingFingerprint(digestKey, currentDigestEntry.entry)) unavailable()
  for (const { entry, version } of previousDigestEntries) {
    if (!matchingFingerprint(configuredPreviousDigestKeys.get(version)!, entry)) unavailable()
  }
  const binding = { target: Object.freeze(target) }
  Object.defineProperties(binding, {
    credentialEvidence: {
      value: Object.freeze({
        projectToken: Object.freeze({
          bindingId: findEntry('project-token')!.bindingId,
          sha256: findEntry('project-token')!.sha256,
        }),
        webhookSecret: Object.freeze({
          bindingId: findEntry('webhook-current')!.bindingId,
          sha256: findEntry('webhook-current')!.sha256,
        }),
        previousWebhookSecret: previous
          ? Object.freeze({
              bindingId: previous.bindingId,
              sha256: previous.sha256,
              overlap: Object.freeze({ ...previous.overlap! }),
            })
          : null,
        digestKey: Object.freeze({
          bindingId: currentDigestEntry.entry.bindingId,
          sha256: currentDigestEntry.entry.sha256,
        }),
        previousDigestKeys: Object.freeze(
          previousDigestEntries.map(({ entry, version }) =>
            Object.freeze({ bindingId: entry.bindingId, sha256: entry.sha256, version }),
          ),
        ),
      }),
    },
    projectToken: { value: projectToken },
    webhookSecret: { value: webhookSecret },
    previousWebhookSecret: { value: previousWebhookSecret },
    previousWebhookSecretWindow: {
      value: previous?.overlap
        ? Object.freeze({
            startsAt: Date.parse(previous.overlap.startsAt),
            validUntil: Date.parse(previous.overlap.validUntil),
          })
        : undefined,
    },
    digestKey: { value: digestKey },
    recipientDigestKeys: {
      value: Object.freeze([
        Object.freeze({ version: target.digestKeyId, secret: digestKey }),
        ...previousDigestEntries.map(({ version }) =>
          Object.freeze({ version, secret: configuredPreviousDigestKeys.get(version)! }),
        ),
      ]),
    },
  })
  verifiedBindings.add(binding)
  return Object.freeze(binding) as HostedLettermintBinding
}

export function requireVerifiedHostedBinding(binding: HostedLettermintBinding) {
  if (!verifiedBindings.has(binding)) unavailable()
}

export function loadHostedLettermintBinding(
  environment: HostedEnvironment,
  env: Record<string, string | undefined> = process.env,
) {
  return resolveHostedLettermintBinding(environment, registry, env)
}

type HostedWebhookBinding = Pick<
  HostedLettermintBinding,
  'webhookSecret' | 'previousWebhookSecret' | 'previousWebhookSecretWindow'
> & {
  recipientDigests(address: string): readonly string[] | null
  target: Readonly<Pick<Target, 'environment' | 'teamId' | 'projectId' | 'routeId' | 'webhookId'>>
}

export function loadHostedLettermintWebhookBinding(environment: HostedEnvironment): HostedWebhookBinding {
  const binding = loadHostedLettermintBinding(environment)
  const { teamId, projectId, routeId, webhookId } = binding.target
  const inbound = { target: Object.freeze({ environment, teamId, projectId, routeId, webhookId }) }
  Object.defineProperties(inbound, {
    recipientDigests: {
      value: (address: string) => {
        const digests = binding.recipientDigestKeys.map((key) => recipientAddressDigest(address, key))
        return digests.some((digest) => digest === null) ? null : Object.freeze(digests as string[])
      },
    },
    webhookSecret: { value: binding.webhookSecret },
    previousWebhookSecret: { value: binding.previousWebhookSecret },
    previousWebhookSecretWindow: { value: binding.previousWebhookSecretWindow },
  })
  return Object.freeze(inbound) as HostedWebhookBinding
}
