import { createHash } from 'node:crypto'
import { createWebhookConfiguration, webhookNow } from './lettermintWebhook'
import { resolveHostedLettermintBinding } from '@/features/transactionalEmail/hostedConfiguration'
import type { CommandType } from '@/features/transactionalEmail/commands'

export function createActivationFixture(
  environment: 'preview' | 'production' = 'preview',
  withPreviousWebhook = false,
  withPreviousDigestKey = false,
  previousDigestVersion?: string,
) {
  const configuration = createWebhookConfiguration()
  const target = configuration.registry.targets.find((entry) => entry.environment === environment)!
  const previousWebhookSecret = withPreviousWebhook
    ? {
        bindingId: `${environment}-webhook-previous`,
        sha256: createHash('sha256').update(`synthetic_${environment}_previous_webhook`).digest('hex'),
        overlap: { startsAt: '2026-09-26T11:59:00.000Z', validUntil: '2026-09-26T12:01:00.000Z' },
      }
    : null
  if (previousWebhookSecret) {
    configuration.secrets[environment].LETTERMINT_PREVIOUS_WEBHOOK_SECRET = `synthetic_${environment}_previous_webhook`
    configuration.registry.fingerprints.push({
      ...target.activatedTarget,
      environment,
      kind: 'webhook-previous',
      webhookId: target.webhookId,
      digestKeyId: null,
      ...previousWebhookSecret,
    })
  }
  const previousDigestKey = withPreviousDigestKey
    ? {
        version: previousDigestVersion ?? target.digestKeyId,
        bindingId: `${environment}-digest-key-previous`,
        secret: configuration.secrets[environment].LETTERMINT_RECIPIENT_DIGEST_KEY!,
      }
    : null
  if (previousDigestKey) {
    target.digestKeyId = `${target.digestKeyId}-current`
    configuration.secrets[environment].LETTERMINT_RECIPIENT_DIGEST_KEY = `synthetic_${environment}_current_digest_key`
    for (const entry of configuration.registry.fingerprints) {
      Reflect.set(
        entry,
        'digestKeyId',
        entry.kind === 'digest-key'
          ? configuration.registry.targets.find(
              ({ environment: targetEnvironment }) => targetEnvironment === entry.environment,
            )!.digestKeyId
          : null,
      )
    }
    const currentDigest = configuration.registry.fingerprints.find(
      (entry) => entry.environment === environment && entry.kind === 'digest-key',
    )!
    currentDigest.bindingId = `${environment}-digest-key-current`
    currentDigest.sha256 = createHash('sha256')
      .update(configuration.secrets[environment].LETTERMINT_RECIPIENT_DIGEST_KEY)
      .digest('hex')
    configuration.secrets[environment].LETTERMINT_PREVIOUS_RECIPIENT_DIGEST_KEYS = JSON.stringify({
      [previousDigestKey.version]: previousDigestKey.secret,
    })
    configuration.registry.fingerprints.push({
      ...currentDigest,
      bindingId: previousDigestKey.bindingId,
      sha256: createHash('sha256').update(previousDigestKey.secret).digest('hex'),
      digestKeyId: previousDigestKey.version,
    })
  }
  const credential = (kind: string) => {
    const { bindingId, sha256 } = configuration.registry.fingerprints.find(
      (entry) => entry.environment === environment && entry.kind === kind,
    )!
    return { bindingId, sha256 }
  }
  const preflight = {
    environment,
    version: `${environment}-preflight-v1`,
    registryVersion: 'activation-v1',
    target: {
      teamId: target.teamId,
      projectId: target.projectId,
      routeId: target.routeId,
      routeSlug: target.routeSlug,
      sender: target.sender,
      webhookId: target.webhookId,
      digestKeyId: target.digestKeyId,
    },
    credentials: {
      projectToken: credential('project-token'),
      webhookSecret: credential('webhook-current'),
      previousWebhookSecret,
      digestKey: credential('digest-key'),
      previousDigestKeys: previousDigestKey
        ? [
            {
              version: previousDigestKey.version,
              bindingId: previousDigestKey.bindingId,
              sha256: createHash('sha256').update(previousDigestKey.secret).digest('hex'),
            },
          ]
        : [],
    },
    tracking: { open: false, click: false },
    webhookEvents: [
      'message.created',
      'message.sent',
      'message.delivered',
      'message.hard_bounced',
      'message.soft_bounced',
      'message.spam_complaint',
      'message.failed',
      'message.suppressed',
      'message.policy_rejected',
    ],
    evidence: {
      team: `${environment}-team-evidence`,
      project: `${environment}-project-evidence`,
      route: `${environment}-route-evidence`,
      sender: target.senderEvidenceId,
      dns: `${environment}-dns-evidence`,
      webhook: `${environment}-signed-webhook-evidence`,
      tracking: `${environment}-tracking-evidence`,
    },
  }
  const record = {
    environment,
    commandType: 'clinic.registration-received' as CommandType,
    registryVersion: 'activation-v1',
    preflightVersion: preflight.version,
    ...(environment === 'production'
      ? {
          approvals: {
            dpa: 'production-dpa',
            subprocessors: 'production-subprocessors',
            retentionDeletion: 'production-retention',
            digestKeyOwnershipRotation: 'production-key-management',
            privacyNotice: 'production-privacy',
            processingPurpose: 'production-purpose',
            compliance: 'production-compliance',
            onePath: 'production-clinic-registration-cutover',
          },
        }
      : {}),
  }
  const binding = resolveHostedLettermintBinding(
    environment,
    configuration.registry,
    configuration.secrets[environment],
    webhookNow,
    configuration.locks,
  )
  return {
    configuration,
    binding,
    preflight,
    record,
    registry: { schemaVersion: 1, version: 'activation-v1', preflights: [preflight], records: [record] },
  }
}
