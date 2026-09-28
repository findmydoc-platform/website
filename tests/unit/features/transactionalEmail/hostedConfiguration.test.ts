import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  createHostedLettermintOutboundBinding,
  requireVerifiedHostedOutboundBinding,
  resolveHostedLettermintBinding,
} from '@/features/transactionalEmail/hostedConfiguration'
import {
  selectTransactionalEmailAcceptanceRuntimeForTest,
  selectTransactionalEmailRuntimeForTest,
  validateTransactionalEmailStartupForTest,
} from '@/features/transactionalEmail/environment'
import { recipientAddressDigest, recipientDigest } from '@/features/transactionalEmail/recipientBinding'
import { createActivationFixture } from '../../../fixtures/transactionalEmailActivation'
import { webhookNow } from '../../../fixtures/lettermintWebhook'

const fingerprint = (value: string) => createHash('sha256').update(value).digest('hex')
const now = Date.parse('2026-09-25T12:00:00.000Z')
type Environment = 'preview' | 'production'
type TargetFixture = {
  environment: Environment
  teamId: string
  projectId: string
  routeId: string
  routeSlug: string
  webhookId: string
  sender: string
  senderEvidenceId: string
  digestKeyId: string
  activatedTarget: { teamId: string; projectId: string; routeId: string; routeSlug: string } | null
}
type FingerprintFixture = {
  environment: Environment
  kind: string
  bindingId: string
  sha256: string
  teamId: string
  projectId: string
  routeId: string
  routeSlug: string
  webhookId: string | null
  overlap: { startsAt: string; validUntil: string } | null
  digestKeyId?: string | null
}

function fixture() {
  const targets: TargetFixture[] = [
    {
      environment: 'preview',
      teamId: 'team-preview',
      projectId: 'project-preview',
      routeId: 'route-preview',
      routeSlug: 'route-preview-slug',
      webhookId: 'webhook-preview',
      sender: 'preview@example.test',
      senderEvidenceId: 'sender-evidence-preview',
      digestKeyId: 'digest-preview',
      activatedTarget: {
        teamId: 'team-preview',
        projectId: 'project-preview',
        routeId: 'route-preview',
        routeSlug: 'route-preview-slug',
      },
    },
    {
      environment: 'production',
      teamId: 'team-production',
      projectId: 'project-production',
      routeId: 'route-production',
      routeSlug: 'route-production-slug',
      webhookId: 'webhook-production',
      sender: 'production@example.test',
      senderEvidenceId: 'sender-evidence-production',
      digestKeyId: 'digest-production',
      activatedTarget: {
        teamId: 'team-production',
        projectId: 'project-production',
        routeId: 'route-production',
        routeSlug: 'route-production-slug',
      },
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
        routeSlug: target.routeSlug,
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
        routeSlug: target.routeSlug,
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
        routeSlug: target.routeSlug,
        webhookId: null,
        overlap: null,
      },
    ]
  })
  const targetLocks = {
    targets: targets.map(({ environment, teamId, projectId, routeId, routeSlug }) => ({
      environment,
      teamId,
      projectId,
      routeId,
      routeSlug,
    })),
  }
  return { registry: { targets, fingerprints }, targetLocks, secrets }
}

function bind(input = fixture(), environment: Environment = 'preview') {
  return resolveHostedLettermintBinding(environment, input.registry, input.secrets[environment], now, input.targetLocks)
}

describe('hosted Lettermint binding', () => {
  it('requires an explicit secret-minimized outbound projection', () => {
    const binding = bind()
    expect(() => requireVerifiedHostedOutboundBinding(binding)).toThrow('environment-unavailable')

    const outbound = createHostedLettermintOutboundBinding(binding)
    expect(() => requireVerifiedHostedOutboundBinding(outbound)).not.toThrow()
    expect('webhookSecret' in outbound).toBe(false)
    expect('previousWebhookSecret' in outbound).toBe(false)
  })

  it('binds Preview without requiring any Production target or credential evidence', () => {
    const input = fixture()
    input.registry.targets = input.registry.targets.filter(({ environment }) => environment === 'preview')
    input.registry.fingerprints = input.registry.fingerprints.filter(({ environment }) => environment === 'preview')
    input.targetLocks.targets = input.targetLocks.targets.filter(({ environment }) => environment === 'preview')

    expect(bind(input).target.environment).toBe('preview')
    expect(() => bind(input, 'production')).toThrow('environment-unavailable')
  })

  it('keeps an unconfigured Production runtime inactive when only Preview is registered', () => {
    const input = createActivationFixture('preview')
    input.configuration.registry.targets = input.configuration.registry.targets.filter(
      ({ environment }) => environment === 'preview',
    )
    input.configuration.registry.fingerprints = input.configuration.registry.fingerprints.filter(
      ({ environment }) => environment === 'preview',
    )
    input.configuration.locks.targets = input.configuration.locks.targets.filter(
      ({ environment }) => environment === 'preview',
    )
    const productionEnv = {
      NODE_ENV: 'production',
      VERCEL_ENV: 'production',
      DEPLOYMENT_ENV: 'production',
    }

    expect(
      validateTransactionalEmailStartupForTest(
        productionEnv,
        input.configuration.registry,
        input.configuration.locks,
        webhookNow,
        input.registry,
      ),
    ).toEqual({ environment: 'production' })
    expect(() =>
      selectTransactionalEmailRuntimeForTest(
        productionEnv,
        input.configuration.registry,
        input.configuration.locks,
        webhookNow,
        input.registry,
      ),
    ).toThrow('environment-unavailable')
    expect(() =>
      selectTransactionalEmailAcceptanceRuntimeForTest(
        productionEnv,
        input.configuration.registry,
        input.configuration.locks,
        webhookNow,
        input.registry,
      ),
    ).toThrow('environment-unavailable')
  })

  it('keeps unconfigured Production live when the isolated Preview activation is invalid', () => {
    const input = createActivationFixture('preview')
    input.configuration.registry.targets = input.configuration.registry.targets.filter(
      ({ environment }) => environment === 'preview',
    )
    input.configuration.registry.fingerprints = input.configuration.registry.fingerprints.filter(
      ({ environment }) => environment === 'preview',
    )
    input.configuration.locks.targets = input.configuration.locks.targets.filter(
      ({ environment }) => environment === 'preview',
    )
    input.registry.records[0]!.registryVersion = 'invalid-preview-registry-version'

    expect(
      validateTransactionalEmailStartupForTest(
        { NODE_ENV: 'production', VERCEL_ENV: 'production', DEPLOYMENT_ENV: 'production' },
        input.configuration.registry,
        input.configuration.locks,
        webhookNow,
        input.registry,
      ),
    ).toEqual({ environment: 'production' })
  })

  it.each(['preview', 'production'] as const)(
    'binds %s command acceptance and delivery to its own verified target',
    (environment) => {
      const input = createActivationFixture(environment)
      const recipientAddress = 'recipient@example.test'
      const recipientAllowlist = [
        recipientAddressDigest(recipientAddress, {
          version: input.binding.target.digestKeyId,
          secret: input.binding.digestKey,
        }),
      ]
      const env = {
        NODE_ENV: 'production',
        VERCEL_ENV: environment,
        DEPLOYMENT_ENV: environment,
        ...input.configuration.secrets[environment],
        ...(environment === 'preview'
          ? { LETTERMINT_PREVIEW_RECIPIENT_DIGESTS: JSON.stringify(recipientAllowlist) }
          : {}),
      }
      const runtime = selectTransactionalEmailAcceptanceRuntimeForTest(
        env,
        input.configuration.registry,
        input.configuration.locks,
        webhookNow,
        input.registry,
      )
      const recipient = { address: 'recipient@example.test', binding: 'clinic-registration' }

      expect(runtime.environment).toBe(environment)
      expect(runtime.digestRecipient(recipient)).toBe(
        recipientDigest(recipient, {
          version: input.binding.target.digestKeyId,
          secret: input.binding.digestKey,
        }),
      )
      const deliveryRuntime = selectTransactionalEmailRuntimeForTest(
        env,
        input.configuration.registry,
        input.configuration.locks,
        webhookNow,
        input.registry,
      )
      expect(deliveryRuntime.environment).toBe(environment)
      expect(deliveryRuntime.delivery).toBe('lettermint')
      if (deliveryRuntime.delivery !== 'lettermint') throw new Error('Expected hosted delivery runtime')
      expect(deliveryRuntime.links).toBe('unavailable')
      expect(deliveryRuntime.binding.target.environment).toBe(environment)
      expect('webhookSecret' in deliveryRuntime.binding).toBe(false)
      expect('previousWebhookSecret' in deliveryRuntime.binding).toBe(false)
      expect(deliveryRuntime.activationPolicy.evaluate('clinic.registration-received', recipientAddress)).toBeNull()
      expect(deliveryRuntime.activationPolicy.evaluate('auth.invitation', recipientAddress)).toBe('command-not-enabled')
    },
  )

  it('fails hosted acceptance closed when an activated environment lacks verified configuration', () => {
    const input = createActivationFixture('preview')
    const env = {
      NODE_ENV: 'production',
      VERCEL_ENV: 'preview',
      DEPLOYMENT_ENV: 'preview',
      ...input.configuration.secrets.preview,
      LETTERMINT_RECIPIENT_DIGEST_KEY: undefined,
    }

    expect(() =>
      selectTransactionalEmailAcceptanceRuntimeForTest(
        env,
        input.configuration.registry,
        input.configuration.locks,
        webhookNow,
        input.registry,
      ),
    ).toThrow('environment-unavailable')
  })

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

  it('allows the same route slug in separate projects', () => {
    const input = fixture()
    input.registry.targets[1]!.routeSlug = input.registry.targets[0]!.routeSlug
    input.registry.targets[1]!.activatedTarget!.routeSlug = input.registry.targets[0]!.routeSlug
    input.targetLocks.targets[1]!.routeSlug = input.registry.targets[0]!.routeSlug
    input.registry.fingerprints
      .filter((entry) => entry.environment === 'production')
      .forEach((entry) => {
        entry.routeSlug = input.registry.targets[0]!.routeSlug
      })

    expect(() => bind(input, 'production')).not.toThrow()
  })

  it('rejects an activated target change during credential rotation', () => {
    const input = fixture()
    input.registry.targets[0]!.activatedTarget = {
      teamId: 'team-preview',
      projectId: 'project-preview',
      routeId: 'route-preview',
      routeSlug: 'route-preview-slug',
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

  it('binds only the current environment current and explicitly configured previous digest keys', () => {
    const input = fixture()
    const previousVersion = 'digest-preview-previous'
    const previousSecret = 'preview-synthetic-previous-digest-key' // pragma: allowlist secret
    input.secrets.preview.LETTERMINT_PREVIOUS_RECIPIENT_DIGEST_KEYS = JSON.stringify({
      [previousVersion]: previousSecret,
    })
    for (const entry of input.registry.fingerprints) {
      Reflect.set(
        entry,
        'digestKeyId',
        entry.kind === 'digest-key'
          ? input.registry.targets.find(({ environment }) => environment === entry.environment)!.digestKeyId
          : null,
      )
    }
    const current = input.registry.fingerprints.find(
      (entry) => entry.environment === 'preview' && entry.kind === 'digest-key',
    )!
    input.registry.fingerprints.push({
      ...current,
      bindingId: 'digest-preview-previous',
      sha256: fingerprint(previousSecret),
      ...({ digestKeyId: previousVersion } as object),
    })

    const preview = bind(input)
    expect(
      (
        preview as unknown as {
          recipientDigestKeys: readonly { version: string; secret: string }[]
        }
      ).recipientDigestKeys.map(({ version }) => version),
    ).toEqual(['digest-preview', previousVersion])
    expect(JSON.stringify(preview)).not.toContain(previousSecret)

    const production = bind(input, 'production')
    expect(
      (
        production as unknown as {
          recipientDigestKeys: readonly { version: string; secret: string }[]
        }
      ).recipientDigestKeys.map(({ version }) => version),
    ).toEqual(['digest-production'])
  })

  it.each([
    ['malformed JSON', '{'],
    ['an unknown version', JSON.stringify({ 'digest-preview-unknown': 'preview-synthetic-previous-digest-key' })],
    ['the current version', JSON.stringify({ 'digest-preview': 'preview-synthetic-previous-digest-key' })],
  ])('rejects previous digest configuration with %s', (_case, configured) => {
    const input = fixture()
    const current = input.registry.fingerprints.find(
      (entry) => entry.environment === 'preview' && entry.kind === 'digest-key',
    )!
    current.digestKeyId = 'digest-preview'
    input.registry.fingerprints.push({
      ...current,
      bindingId: 'digest-preview-previous',
      digestKeyId: 'digest-preview-previous',
      sha256: fingerprint('preview-synthetic-previous-digest-key'),
    })
    input.secrets.preview.LETTERMINT_PREVIOUS_RECIPIENT_DIGEST_KEYS = configured

    expect(() => bind(input)).toThrow('environment-unavailable')
  })

  it('rejects a missing or unreviewed previous digest secret', () => {
    const input = fixture()
    const current = input.registry.fingerprints.find(
      (entry) => entry.environment === 'preview' && entry.kind === 'digest-key',
    )!
    current.digestKeyId = 'digest-preview'
    input.registry.fingerprints.push({
      ...current,
      bindingId: 'digest-preview-previous',
      digestKeyId: 'digest-preview-previous',
      sha256: fingerprint('preview-synthetic-previous-digest-key'),
    })
    expect(() => bind(input)).toThrow('environment-unavailable')

    input.secrets.preview.LETTERMINT_PREVIOUS_RECIPIENT_DIGEST_KEYS = JSON.stringify({
      'digest-preview-previous': 'preview-synthetic-unreviewed-digest-key',
    })
    expect(() => bind(input)).toThrow('environment-unavailable')
  })

  it('returns an exact content-free error for invalid previous digest configuration', () => {
    const input = fixture()
    const current = input.registry.fingerprints.find(
      (entry) => entry.environment === 'preview' && entry.kind === 'digest-key',
    )!
    current.digestKeyId = 'digest-preview'
    input.registry.fingerprints.push({
      ...current,
      bindingId: 'digest-preview-previous',
      digestKeyId: 'digest-preview-previous',
      sha256: fingerprint('preview-synthetic-previous-digest-key'),
    })
    input.secrets.preview.LETTERMINT_PREVIOUS_RECIPIENT_DIGEST_KEYS = JSON.stringify({
      'digest-preview-previous': 'preview-synthetic-unreviewed-digest-key',
    })

    let failure: unknown
    try {
      bind(input)
    } catch (error) {
      failure = error
    }
    expect(failure).toBeInstanceOf(Error)
    expect(failure).toMatchObject({
      code: 'environment-unavailable',
      message: 'environment-unavailable',
      name: 'TransactionalEmailError',
    })
    expect(JSON.parse(JSON.stringify(failure))).toEqual({
      code: 'environment-unavailable',
      name: 'TransactionalEmailError',
    })
    const visible = `${String(failure)} ${JSON.stringify(failure)}`
    for (const sentinel of [
      'preview-synthetic-unreviewed-digest-key',
      'preview-synthetic-previous-digest-key',
      input.secrets.preview.LETTERMINT_RECIPIENT_DIGEST_KEY!,
      input.registry.targets[0]!.projectId,
      input.registry.targets[0]!.webhookId,
    ])
      expect(visible).not.toContain(sentinel)
  })

  it('rejects digest versions or key fingerprints reused across environments', () => {
    const duplicateVersion = fixture()
    const productionDigest = duplicateVersion.registry.fingerprints.find(
      (entry) => entry.environment === 'production' && entry.kind === 'digest-key',
    )!
    productionDigest.digestKeyId = 'digest-preview'
    expect(() => bind(duplicateVersion, 'production')).toThrow('environment-unavailable')

    const duplicateKey = fixture()
    const previewDigest = duplicateKey.registry.fingerprints.find(
      (entry) => entry.environment === 'preview' && entry.kind === 'digest-key',
    )!
    const copiedProductionDigest = duplicateKey.registry.fingerprints.find(
      (entry) => entry.environment === 'production' && entry.kind === 'digest-key',
    )!
    copiedProductionDigest.sha256 = previewDigest.sha256
    duplicateKey.secrets.production.LETTERMINT_RECIPIENT_DIGEST_KEY =
      duplicateKey.secrets.preview.LETTERMINT_RECIPIENT_DIGEST_KEY
    expect(() => bind(duplicateKey, 'production')).toThrow('environment-unavailable')
  })

  it('keeps local, test, and CI fake-only even with provider-like values', () => {
    for (const environment of ['local', 'test', 'ci']) {
      expect(() =>
        selectTransactionalEmailRuntimeForTest({
          DEPLOYMENT_ENV: environment,
          LETTERMINT_PROJECT_TOKEN: 'lm_synthetic',
        }),
      ).toThrow('environment-unavailable')
    }
  })

  it.each(['preview', 'production'] as const)('rejects development and %s signals together', (hosted) => {
    expect(() => selectTransactionalEmailRuntimeForTest({ VERCEL_ENV: 'development', DEPLOYMENT_ENV: hosted })).toThrow(
      'environment-unavailable',
    )
  })

  it('checks fingerprints at hosted startup independently from command activation', () => {
    const input = fixture()
    const inactiveRegistry = { schemaVersion: 1, version: 'activation-v1', preflights: [], records: [] }
    expect(
      validateTransactionalEmailStartupForTest(
        { VERCEL_ENV: 'preview', DEPLOYMENT_ENV: 'preview', ...input.secrets.preview },
        input.registry,
        input.targetLocks,
        now,
        inactiveRegistry,
      ),
    ).toEqual({ environment: 'preview' })
    input.secrets.preview.LETTERMINT_WEBHOOK_SECRET = 'wrong-synthetic-webhook-secret' // pragma: allowlist secret
    expect(() =>
      validateTransactionalEmailStartupForTest(
        { VERCEL_ENV: 'preview', DEPLOYMENT_ENV: 'preview', ...input.secrets.preview },
        input.registry,
        input.targetLocks,
        now,
        inactiveRegistry,
      ),
    ).toThrow('environment-unavailable')
  })
})
