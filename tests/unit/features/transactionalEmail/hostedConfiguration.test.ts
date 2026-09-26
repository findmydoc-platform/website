import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { resolveHostedLettermintBinding } from '@/features/transactionalEmail/hostedConfiguration'
import {
  selectTransactionalEmailRuntime,
  validateTransactionalEmailStartup,
} from '@/features/transactionalEmail/environment'

const fingerprint = (value: string) => createHash('sha256').update(value).digest('hex')
const now = Date.parse('2026-09-25T12:00:00.000Z')
type Environment = 'preview' | 'production'
type TargetFixture = {
  environment: Environment
  teamId: string
  projectId: string
  routeId: string
  webhookId: string
  sender: string
  senderEvidenceId: string
  digestKeyId: string
  activatedTarget: { teamId: string; projectId: string; routeId: string } | null
}
type FingerprintFixture = {
  environment: Environment
  kind: string
  bindingId: string
  sha256: string
  teamId: string
  projectId: string
  routeId: string
  webhookId: string | null
  overlap: { startsAt: string; validUntil: string } | null
}

function fixture() {
  const targets: TargetFixture[] = [
    {
      environment: 'preview',
      teamId: 'team-preview',
      projectId: 'project-preview',
      routeId: 'route-preview',
      webhookId: 'webhook-preview',
      sender: 'preview@example.test',
      senderEvidenceId: 'sender-evidence-preview',
      digestKeyId: 'digest-preview',
      activatedTarget: { teamId: 'team-preview', projectId: 'project-preview', routeId: 'route-preview' },
    },
    {
      environment: 'production',
      teamId: 'team-production',
      projectId: 'project-production',
      routeId: 'route-production',
      webhookId: 'webhook-production',
      sender: 'production@example.test',
      senderEvidenceId: 'sender-evidence-production',
      digestKeyId: 'digest-production',
      activatedTarget: { teamId: 'team-production', projectId: 'project-production', routeId: 'route-production' },
    },
  ]
  const secrets: Record<Environment, Record<string, string | undefined>> = {
    preview: {
      LETTERMINT_PROJECT_TOKEN: 'lm_preview_synthetic_token', // pragma: allowlist secret
      LETTERMINT_WEBHOOK_SECRET: 'preview-synthetic-webhook-secret', // pragma: allowlist secret
      LETTERMINT_RECIPIENT_DIGEST_KEY: 'preview-synthetic-digest-key',
    },
    production: {
      LETTERMINT_PROJECT_TOKEN: 'lm_production_synthetic_token', // pragma: allowlist secret
      LETTERMINT_WEBHOOK_SECRET: 'production-synthetic-webhook-secret', // pragma: allowlist secret
      LETTERMINT_RECIPIENT_DIGEST_KEY: 'production-synthetic-digest-key',
    },
  }
  const fingerprints: FingerprintFixture[] = targets.flatMap((target) => {
    const scoped = secrets[target.environment]
    return [
      {
        environment: target.environment,
        kind: 'project-token',
        bindingId: `token-${target.environment}`,
        sha256: fingerprint(scoped.LETTERMINT_PROJECT_TOKEN!),
        teamId: target.teamId,
        projectId: target.projectId,
        routeId: target.routeId,
        webhookId: null,
        overlap: null,
      },
      {
        environment: target.environment,
        kind: 'webhook-current',
        bindingId: `webhook-${target.environment}`,
        sha256: fingerprint(scoped.LETTERMINT_WEBHOOK_SECRET!),
        teamId: target.teamId,
        projectId: target.projectId,
        routeId: target.routeId,
        webhookId: target.webhookId,
        overlap: null,
      },
      {
        environment: target.environment,
        kind: 'digest-key',
        bindingId: `digest-${target.environment}`,
        sha256: fingerprint(scoped.LETTERMINT_RECIPIENT_DIGEST_KEY!),
        teamId: target.teamId,
        projectId: target.projectId,
        routeId: target.routeId,
        webhookId: null,
        overlap: null,
      },
    ]
  })
  const targetLocks = {
    targets: targets.map(({ environment, teamId, projectId, routeId }) => ({
      environment,
      teamId,
      projectId,
      routeId,
    })),
  }
  return { registry: { targets, fingerprints }, targetLocks, secrets }
}

function bind(input = fixture(), environment: Environment = 'preview') {
  return resolveHostedLettermintBinding(environment, input.registry, input.secrets[environment], now, input.targetLocks)
}

describe('hosted Lettermint binding', () => {
  it('binds each hosted secret only to its reviewed provider target and kind', () => {
    const input = fixture()
    const preview = bind(input, 'preview')
    expect(preview.target.teamId).toBe('team-preview')
    expect(JSON.stringify(preview)).not.toContain(input.secrets.preview.LETTERMINT_PROJECT_TOKEN!)
    expect(bind(input, 'production').target.teamId).toBe('team-production')
  })

  it.each(['targets', 'fingerprints'] as const)('rejects missing %s', (field) => {
    const input = fixture()
    Reflect.deleteProperty(input.registry, field)
    expect(() => bind(input)).toThrow('environment-unavailable')
  })

  it('rejects duplicated and cross-environment fingerprint bindings', () => {
    const input = fixture()
    input.registry.fingerprints.push({ ...input.registry.fingerprints[0]! })
    expect(() => bind(input)).toThrow('environment-unavailable')
    input.registry.fingerprints.pop()
    input.registry.fingerprints[0]!.environment = 'production'
    expect(() => bind(input)).toThrow('environment-unavailable')
  })

  it('rejects duplicate targets, a wrong fingerprint target, and a missing credential kind', () => {
    const duplicated = fixture()
    duplicated.registry.targets[1]!.environment = 'preview'
    expect(() => bind(duplicated)).toThrow('environment-unavailable')

    const moved = fixture()
    moved.registry.fingerprints[0]!.routeId = 'another-route'
    expect(() => bind(moved)).toThrow('environment-unavailable')

    const missing = fixture()
    missing.registry.fingerprints = missing.registry.fingerprints.filter(
      (entry) => entry.kind !== 'digest-key' || entry.environment !== 'preview',
    )
    expect(() => bind(missing)).toThrow('environment-unavailable')
  })

  it('rejects a copied Preview token in Production even when the target metadata is unchanged', () => {
    const input = fixture()
    input.secrets.production.LETTERMINT_PROJECT_TOKEN = input.secrets.preview.LETTERMINT_PROJECT_TOKEN
    expect(() => bind(input, 'production')).toThrow('environment-unavailable')
  })

  it('rejects malformed, absent, or mismatched secrets without exposing their values', () => {
    const input = fixture()
    input.secrets.preview.LETTERMINT_PROJECT_TOKEN = 'wrong-secret'
    expect(() => bind(input)).toThrow('environment-unavailable')
    input.secrets.preview.LETTERMINT_PROJECT_TOKEN = ''
    expect(() => bind(input)).toThrow('environment-unavailable')
    input.secrets.preview.LETTERMINT_PROJECT_TOKEN = 'lm_preview_synthetic_token' // pragma: allowlist secret
    input.registry.fingerprints[0]!.sha256 = 'short'
    expect(() => bind(input)).toThrow('environment-unavailable')
  })

  it('rejects malformed sender and unreviewed hosted secret keys', () => {
    const input = fixture()
    input.registry.targets[0]!.sender = 'not an address'
    expect(() => bind(input)).toThrow('environment-unavailable')
    input.registry.targets[0]!.sender = 'preview@example.test'
    input.secrets.preview.LETTERMINT_UNKNOWN_SECRET = 'synthetic-unreviewed-secret' // pragma: allowlist secret
    expect(() => bind(input)).toThrow('environment-unavailable')
  })

  it.each(['teamId', 'projectId', 'routeId', 'webhookId', 'senderEvidenceId', 'digestKeyId'] as const)(
    'rejects shared Preview and Production %s',
    (field) => {
      const input = fixture()
      input.registry.targets[1]![field] = input.registry.targets[0]![field]
      expect(() => bind(input)).toThrow('environment-unavailable')
    },
  )

  it('rejects an activated target change during credential rotation', () => {
    const input = fixture()
    input.registry.targets[0]!.activatedTarget = {
      teamId: 'team-preview',
      projectId: 'project-preview',
      routeId: 'route-preview',
    }
    input.registry.targets[0]!.routeId = 'new-preview-route'
    expect(() => bind(input)).toThrow('environment-unavailable')
  })

  it('rejects a configured target without its original target pin', () => {
    const input = fixture()
    input.registry.targets[0]!.activatedTarget = null
    expect(() => bind(input)).toThrow('environment-unavailable')
  })

  it('rejects a joint target and pin rewrite against a separately reviewed target lock', () => {
    const input = fixture()
    input.registry.targets[0]!.routeId = 'new-preview-route'
    input.registry.targets[0]!.activatedTarget!.routeId = 'new-preview-route'
    input.registry.fingerprints
      .filter((entry) => entry.environment === 'preview')
      .forEach((entry) => {
        entry.routeId = 'new-preview-route'
      })
    expect(() => bind(input)).toThrow('environment-unavailable')
  })

  it('accepts only one previous webhook secret within a ten-minute reviewed overlap', () => {
    const input = fixture()
    input.secrets.preview.LETTERMINT_PREVIOUS_WEBHOOK_SECRET = 'previous-preview-secret' // pragma: allowlist secret
    input.registry.fingerprints.push({
      ...input.registry.fingerprints[1]!,
      kind: 'webhook-previous',
      bindingId: 'previous-preview',
      sha256: fingerprint('previous-preview-secret'),
      overlap: { startsAt: '2026-09-25T11:55:00.000Z', validUntil: '2026-09-25T12:05:00.000Z' },
    })
    expect(bind(input).previousWebhookSecret).toBe('previous-preview-secret')
    input.registry.fingerprints.at(-1)!.overlap!.validUntil = '2026-09-25T12:06:00.000Z'
    expect(() => bind(input)).toThrow('environment-unavailable')
    input.registry.fingerprints.at(-1)!.overlap!.validUntil = '2026-09-25T12:05:00.000Z'
    expect(() =>
      resolveHostedLettermintBinding(
        'preview',
        input.registry,
        input.secrets.preview,
        Date.parse('2026-09-25T12:05:01.000Z'),
        input.targetLocks,
      ),
    ).toThrow('environment-unavailable')
    input.secrets.preview.LETTERMINT_PREVIOUS_WEBHOOK_SECRET = ''
    expect(() => bind(input)).toThrow('environment-unavailable')
  })

  it('keeps local, test, and CI fake-only even with provider-like values', () => {
    for (const environment of ['local', 'test', 'ci']) {
      expect(() =>
        selectTransactionalEmailRuntime({ DEPLOYMENT_ENV: environment, LETTERMINT_PROJECT_TOKEN: 'lm_synthetic' }),
      ).toThrow('environment-unavailable')
    }
  })

  it.each(['preview', 'production'] as const)('rejects development and %s signals together', (hosted) => {
    expect(() => selectTransactionalEmailRuntime({ VERCEL_ENV: 'development', DEPLOYMENT_ENV: hosted })).toThrow(
      'environment-unavailable',
    )
  })

  it('checks fingerprints at startup while leaving the mail adapter unavailable', () => {
    const input = fixture()
    expect(
      validateTransactionalEmailStartup(
        { VERCEL_ENV: 'preview', DEPLOYMENT_ENV: 'preview', ...input.secrets.preview },
        input.registry,
        input.targetLocks,
        now,
      ),
    ).toEqual({ environment: 'preview' })
    input.secrets.preview.LETTERMINT_WEBHOOK_SECRET = 'wrong-synthetic-webhook-secret' // pragma: allowlist secret
    expect(() =>
      validateTransactionalEmailStartup(
        { VERCEL_ENV: 'preview', DEPLOYMENT_ENV: 'preview', ...input.secrets.preview },
        input.registry,
        input.targetLocks,
        now,
      ),
    ).toThrow('environment-unavailable')
  })
})
