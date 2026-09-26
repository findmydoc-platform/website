import { createHash, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import registry from './lettermintRegistry.json' with { type: 'json' }
import targetLocks from './lettermintTargetLocks.json' with { type: 'json' }
import { TransactionalEmailError } from './errors'

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
})
const registrySchema = z.strictObject({
  targets: z.array(targetSchema).length(2),
  fingerprints: z.array(fingerprintSchema).min(6).max(8),
})
const targetLocksSchema = z.strictObject({
  targets: z.array(targetIdentitySchema.extend({ environment: environmentSchema })).length(2),
})

type HostedEnvironment = z.infer<typeof environmentSchema>
type Target = z.infer<typeof targetSchema>
type Fingerprint = z.infer<typeof fingerprintSchema>
export type HostedLettermintBinding = {
  target: Readonly<Target>
  projectToken: string
  webhookSecret: string
  previousWebhookSecret?: string
  digestKey: string
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
  for (const target of targets) {
    for (const kind of ['project-token', 'webhook-current', 'digest-key'] as const) {
      if (fingerprints.filter((entry) => entry.environment === target.environment && entry.kind === kind).length !== 1)
        unavailable()
    }
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
  const previousWebhookSecret = env.LETTERMINT_PREVIOUS_WEBHOOK_SECRET
  const previous = findEntry('webhook-previous')
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
    ['digest-key', digestKey],
    ...(previousWebhookSecret ? ([['webhook-previous', previousWebhookSecret]] as const) : []),
  ] as const) {
    const entry = findEntry(kind)
    if (!entry || !matchingFingerprint(value, entry)) unavailable()
  }
  const binding = { target: Object.freeze(target) }
  Object.defineProperties(binding, {
    projectToken: { value: projectToken },
    webhookSecret: { value: webhookSecret },
    previousWebhookSecret: { value: previousWebhookSecret },
    digestKey: { value: digestKey },
  })
  return Object.freeze(binding) as HostedLettermintBinding
}

export function loadHostedLettermintBinding(
  environment: HostedEnvironment,
  env: Record<string, string | undefined> = process.env,
) {
  return resolveHostedLettermintBinding(environment, registry, env)
}
