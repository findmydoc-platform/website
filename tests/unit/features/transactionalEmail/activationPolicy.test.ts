import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { resolveHostedLettermintBinding } from '@/features/transactionalEmail/hostedConfiguration'
import {
  hasTransactionalEmailActivationForEnvironment,
  isTransactionalEmailCommandActivationDeclared,
  resolveActivationPolicy,
} from '@/features/transactionalEmail/activationPolicy'
import { createWebhookConfiguration, webhookNow } from '../../../fixtures/lettermintWebhook'
import { createActivationFixture } from '../../../fixtures/transactionalEmailActivation'
import { validateTransactionalEmailStartupForTest } from '@/features/transactionalEmail/environment'
import { commandTypes } from '@/features/transactionalEmail/commands'
import committedRegistry from '@/features/transactionalEmail/activationRegistry.json'
import { recipientAddressDigest } from '@/features/transactionalEmail/recipientBinding'

const previewDigest = 'digest-preview:b6b9397238db67fdbabcf8b26ff25b27694d3c9e4ae7ce14ddc692cc7bea29cf'

describe('transactional email activation policy', () => {
  it('activates only the committed clinic-registration command in Preview and Production', () => {
    for (const environment of ['preview', 'production'] as const) {
      expect(
        isTransactionalEmailCommandActivationDeclared(environment, 'clinic.registration-received', committedRegistry),
      ).toBe(true)
      for (const command of commandTypes.filter((entry) => entry !== 'clinic.registration-received'))
        expect(isTransactionalEmailCommandActivationDeclared(environment, command, committedRegistry)).toBe(false)
    }
  })

  it('declares command acceptance only in the environment named by valid activation evidence', () => {
    const fixture = createActivationFixture('preview')

    expect(
      isTransactionalEmailCommandActivationDeclared('preview', 'clinic.registration-received', fixture.registry),
    ).toBe(true)
    expect(
      isTransactionalEmailCommandActivationDeclared('production', 'clinic.registration-received', fixture.registry),
    ).toBe(false)
  })

  it('fails closed when the activation registry is malformed before checking declarations', () => {
    expect(() =>
      isTransactionalEmailCommandActivationDeclared('preview', 'clinic.registration-received', {
        ...committedRegistry,
        records: [{ environment: 'preview', commandType: 'clinic.registration-received' }],
      }),
    ).toThrow('environment-unavailable')
  })

  it('does not parse an invalid Preview activation when Production has no activation entries', () => {
    const fixture = createActivationFixture('preview')
    fixture.registry.records[0]!.registryVersion = 'invalid-preview-registry-version'

    expect(hasTransactionalEmailActivationForEnvironment('production', fixture.registry)).toBe(false)
    expect(() =>
      isTransactionalEmailCommandActivationDeclared('production', 'clinic.registration-received', fixture.registry),
    ).toThrow('environment-unavailable')
  })

  it('keeps every command disabled without reviewed activation records', () => {
    const inactiveRegistry = { schemaVersion: 1, version: 'activation-v1', preflights: [], records: [] }
    for (const environment of ['preview', 'production'] as const) {
      const { binding } = createActivationFixture(environment)
      const policy = resolveActivationPolicy(binding, inactiveRegistry)
      for (const command of commandTypes)
        expect(policy.evaluate(command, 'recipient@example.test')).toBe('command-not-enabled')
    }
  })
  it('suppresses an unregistered command after validating its hosted credentials', () => {
    const input = createWebhookConfiguration()
    const binding = resolveHostedLettermintBinding(
      'preview',
      input.registry,
      input.secrets.preview,
      webhookNow,
      input.locks,
    )
    const policy = resolveActivationPolicy(binding, {
      schemaVersion: 1,
      version: 'activation-v1',
      preflights: [],
      records: [],
    })
    expect(policy.evaluate('clinic.registration-received', 'recipient@example.test')).toBe('command-not-enabled')
  })

  it('enables one Production command only with environment-bound preflight and one-path release evidence', () => {
    const { binding, registry } = createActivationFixture('production')
    const policy = resolveActivationPolicy(binding, registry)
    expect(policy.evaluate('clinic.registration-received', 'recipient@example.test')).toBeNull()
    expect(policy.evaluate('auth.password-recovery', 'recipient@example.test')).toBe('command-not-enabled')
  })

  it('requires a Preview recipient digest even after the command is enabled', () => {
    const { binding, registry } = createActivationFixture()
    expect(
      resolveActivationPolicy(binding, registry).evaluate('clinic.registration-received', 'recipient@example.test'),
    ).toBe('preview-recipient-not-allowed')
  })

  it('invalidates preflight evidence when a previous webhook secret is added', () => {
    const fixture = createActivationFixture('production')
    const rotated = createActivationFixture('production', true)
    expect(() => resolveActivationPolicy(rotated.binding, fixture.registry)).toThrow('environment-unavailable')
  })

  it.each(['removal', 'bindingId', 'sha256', 'startsAt', 'validUntil'] as const)(
    'invalidates old preflight evidence after previous webhook %s changes',
    (change) => {
      const fixture = createActivationFixture('production', true)
      expect(
        resolveActivationPolicy(fixture.binding, fixture.registry).evaluate(
          'clinic.registration-received',
          'recipient@example.test',
        ),
      ).toBeNull()
      const { configuration } = fixture
      const previous = configuration.registry.fingerprints.find(
        (entry) => entry.environment === 'production' && entry.kind === 'webhook-previous',
      )!
      if (change === 'removal') {
        configuration.registry.fingerprints = configuration.registry.fingerprints.filter((entry) => entry !== previous)
        delete configuration.secrets.production.LETTERMINT_PREVIOUS_WEBHOOK_SECRET
      } else if (change === 'bindingId') previous.bindingId = 'production-rotated-previous'
      else if (change === 'sha256') {
        const secret = 'synthetic_production_different_previous_webhook'
        configuration.secrets.production.LETTERMINT_PREVIOUS_WEBHOOK_SECRET = secret
        previous.sha256 = createHash('sha256').update(secret).digest('hex')
      } else {
        previous.overlap = {
          ...previous.overlap!,
          [change]: change === 'startsAt' ? '2026-09-26T11:58:00.000Z' : '2026-09-26T12:02:00.000Z',
        }
      }
      const changedBinding = resolveHostedLettermintBinding(
        'production',
        configuration.registry,
        configuration.secrets.production,
        webhookNow,
        configuration.locks,
      )
      expect(() => resolveActivationPolicy(changedBinding, fixture.registry)).toThrow('environment-unavailable')
    },
  )

  it('requires explicit absence of a previous webhook secret in the preflight', () => {
    const fixture = createActivationFixture('production')
    Reflect.deleteProperty(fixture.preflight.credentials, 'previousWebhookSecret')
    expect(() => resolveActivationPolicy(fixture.binding, fixture.registry)).toThrow('environment-unavailable')
  })

  it('requires explicit previous digest-key evidence in every preflight', () => {
    const fixture = createActivationFixture('production')
    Reflect.deleteProperty(fixture.preflight.credentials, 'previousDigestKeys')
    expect(() => resolveActivationPolicy(fixture.binding, fixture.registry)).toThrow('environment-unavailable')
  })

  it('allows only the normalized address covered by a versioned Preview HMAC', () => {
    const { binding, registry } = createActivationFixture()
    const policy = resolveActivationPolicy(binding, registry, [
      'digest-preview:b6b9397238db67fdbabcf8b26ff25b27694d3c9e4ae7ce14ddc692cc7bea29cf',
    ])
    expect(policy.evaluate('clinic.registration-received', '  Recipient@EXAMPLE.test  ')).toBeNull()
    expect(policy.evaluate('clinic.registration-received', 'recipient+extra@example.test')).toBe(
      'preview-recipient-not-allowed',
    )
    expect(policy.evaluate('auth.invitation', 'recipient@example.test')).toBe('command-not-enabled')
  })

  it('accepts a Preview allowlist entry under an explicitly supported previous digest key', () => {
    const { binding, registry } = createActivationFixture('preview', false, true)
    const previous = (
      binding as typeof binding & { recipientDigestKeys: readonly { version: string; secret: string }[] }
    ).recipientDigestKeys[1]!
    const allowed = recipientAddressDigest('recipient@example.test', previous)!
    const policy = resolveActivationPolicy(binding, registry, [allowed])

    expect(policy.evaluate('clinic.registration-received', '  Recipient@EXAMPLE.test  ')).toBeNull()
    expect(policy.evaluate('clinic.registration-received', 'other@example.test')).toBe('preview-recipient-not-allowed')
  })

  it('requires every configured previous digest-key fingerprint exactly once in preflight evidence', () => {
    const fixture = createActivationFixture('production', false, true)
    const secondVersion = 'digest-production-older'
    const secondSecret = 'synthetic_production_older_digest_key' // pragma: allowlist secret
    const configured = JSON.parse(
      fixture.configuration.secrets.production.LETTERMINT_PREVIOUS_RECIPIENT_DIGEST_KEYS!,
    ) as Record<string, string>
    configured[secondVersion] = secondSecret
    fixture.configuration.secrets.production.LETTERMINT_PREVIOUS_RECIPIENT_DIGEST_KEYS = JSON.stringify(configured)
    const current = fixture.configuration.registry.fingerprints.find(
      (entry) =>
        entry.environment === 'production' && entry.kind === 'digest-key' && entry.digestKeyId?.endsWith('current'),
    )!
    const secondEvidence = {
      version: secondVersion,
      bindingId: 'production-digest-key-older',
      sha256: createHash('sha256').update(secondSecret).digest('hex'),
    }
    fixture.configuration.registry.fingerprints.push({
      ...current,
      bindingId: secondEvidence.bindingId,
      sha256: secondEvidence.sha256,
      digestKeyId: secondVersion,
    })
    const binding = resolveHostedLettermintBinding(
      'production',
      fixture.configuration.registry,
      fixture.configuration.secrets.production,
      webhookNow,
      fixture.configuration.locks,
    )
    fixture.preflight.credentials.previousDigestKeys.push(secondEvidence)
    expect(
      resolveActivationPolicy(binding, fixture.registry).evaluate(
        'clinic.registration-received',
        'recipient@example.test',
      ),
    ).toBeNull()

    fixture.preflight.credentials.previousDigestKeys[1] = {
      ...fixture.preflight.credentials.previousDigestKeys[0]!,
    }
    expect(() => resolveActivationPolicy(binding, fixture.registry)).toThrow('environment-unavailable')
  })

  it('fails hosted startup without one-path release evidence after the credential check', () => {
    const fixture = createActivationFixture('production')
    Reflect.deleteProperty(fixture.record.release!, 'onePath')
    expect(() =>
      validateTransactionalEmailStartupForTest(
        { VERCEL_ENV: 'production', ...fixture.configuration.secrets.production },
        fixture.configuration.registry,
        fixture.configuration.locks,
        webhookNow,
        fixture.registry,
      ),
    ).toThrow('environment-unavailable')
  })

  it('rejects a Production release reference that is not bound to a Website pull request', () => {
    const fixture = createActivationFixture('production')
    fixture.record.release!.onePath = 'production-clinic-registration-cutover'

    expect(() => resolveActivationPolicy(fixture.binding, fixture.registry)).toThrow('environment-unavailable')
  })

  it.each(['team', 'project', 'route', 'sender', 'dns', 'webhook', 'tracking'] as const)(
    'rejects missing %s preflight evidence',
    (field) => {
      const fixture = createActivationFixture()
      Reflect.deleteProperty(fixture.preflight.evidence, field)
      expect(() => resolveActivationPolicy(fixture.binding, fixture.registry)).toThrow('environment-unavailable')
    },
  )

  it('rejects a Production activation with legacy approval fields instead of one-path release evidence', () => {
    const fixture = createActivationFixture('production')
    Reflect.deleteProperty(fixture.record, 'release')
    Reflect.set(fixture.record, 'approvals', {
      dpa: 'production-dpa',
      subprocessors: 'production-subprocessors',
      retentionDeletion: 'production-retention',
      digestKeyOwnershipRotation: 'production-key-management',
      privacyNotice: 'production-privacy',
      processingPurpose: 'production-purpose',
      compliance: 'production-compliance',
      onePath: 'website-pr-9999',
    })

    expect(() => resolveActivationPolicy(fixture.binding, fixture.registry)).toThrow('environment-unavailable')
  })

  it.each(['teamId', 'projectId', 'routeId', 'routeSlug', 'webhookId', 'digestKeyId', 'sender'] as const)(
    'rejects preflight evidence for a different %s',
    (field) => {
      const fixture = createActivationFixture()
      fixture.preflight.target[field] = field === 'sender' ? 'changed@example.test' : 'different-target'
      expect(() => resolveActivationPolicy(fixture.binding, fixture.registry)).toThrow('environment-unavailable')
    },
  )

  it.each(['projectToken', 'webhookSecret', 'digestKey'] as const)(
    'binds the complete %s fingerprint, including rotation',
    (kind) => {
      const fixture = createActivationFixture()
      fixture.preflight.credentials[kind].sha256 = 'a'.repeat(64)
      expect(() => resolveActivationPolicy(fixture.binding, fixture.registry)).toThrow('environment-unavailable')
      fixture.preflight.credentials[kind].sha256 = fixture.binding.credentialEvidence[kind].sha256
      fixture.preflight.credentials[kind].bindingId = 'wrong-entry'
      expect(() => resolveActivationPolicy(fixture.binding, fixture.registry)).toThrow('environment-unavailable')
    },
  )

  it.each([
    [
      'schema version',
      (f) => {
        f.registry.schemaVersion = 2
      },
    ],
    [
      'registry version',
      (f) => {
        f.registry.version = 'activation-v2'
      },
    ],
    [
      'record version',
      (f) => {
        f.record.registryVersion = 'activation-v0'
      },
    ],
    [
      'preflight version',
      (f) => {
        f.record.preflightVersion = 'stale-preflight'
      },
    ],
    [
      'preflight registry version',
      (f) => {
        f.preflight.registryVersion = 'activation-v0'
      },
    ],
    [
      'duplicate command',
      (f) => {
        f.registry.records.push({ ...f.record })
      },
    ],
    [
      'duplicate preflight',
      (f) => {
        f.registry.preflights.push({ ...f.preflight })
      },
    ],
    [
      'unknown command',
      (f) => {
        Reflect.set(f.record, 'commandType', 'send-anything')
      },
    ],
    [
      'unknown environment',
      (f) => {
        Reflect.set(f.record, 'environment', 'local')
      },
    ],
    [
      'extra record override',
      (f) => {
        Reflect.set(f.record, 'allowlist', ['*'])
      },
    ],
    [
      'URL evidence',
      (f) => {
        f.preflight.evidence.dns = 'https://example.test/private-approval'
      },
    ],
    [
      'empty evidence',
      (f) => {
        f.preflight.evidence.dns = ''
      },
    ],
    [
      'sender readiness',
      (f) => {
        f.preflight.evidence.sender = 'other-sender-evidence'
      },
    ],
    [
      'open tracking',
      (f) => {
        f.preflight.tracking.open = true
      },
    ],
    [
      'click tracking',
      (f) => {
        f.preflight.tracking.click = true
      },
    ],
    [
      'webhook subscription',
      (f) => {
        f.preflight.webhookEvents[0] = 'message.opened'
      },
    ],
    [
      'duplicate webhook event',
      (f) => {
        f.preflight.webhookEvents[0] = 'message.sent'
      },
    ],
  ] satisfies [string, (fixture: ReturnType<typeof createActivationFixture>) => void][])(
    'fails closed for %s drift',
    (_, change) => {
      const fixture = createActivationFixture()
      change(fixture)
      expect(() => resolveActivationPolicy(fixture.binding, fixture.registry)).toThrow('environment-unavailable')
    },
  )

  it.each([[], undefined])('allows nobody with an empty or absent Preview allowlist: %j', (allowlist) => {
    const { binding, registry } = createActivationFixture()
    expect(
      resolveActivationPolicy(binding, registry, allowlist).evaluate(
        'clinic.registration-received',
        'recipient@example.test',
      ),
    ).toBe('preview-recipient-not-allowed')
  })

  it.each(
    [
      ['*'],
      ['recipient@example.test'],
      ['@example.test'],
      ['digest-preview:short'],
      [previewDigest, previewDigest],
      [previewDigest.replace('digest-preview', 'retired-key')],
      { digests: [previewDigest] },
    ].map((allowlist) => ({ allowlist })),
  )('rejects malformed or unsupported recipient allowlists: $allowlist', ({ allowlist }) => {
    const { binding, registry } = createActivationFixture()
    expect(() => resolveActivationPolicy(binding, registry, allowlist)).toThrow('environment-unavailable')
  })

  it.each([
    'invalid',
    'Recipient <recipient@example.test>',
    'recipient@ example.test',
    'recipient@example.test\nBcc:other@example.test',
  ])('suppresses invalid address presentations: %s', (address) => {
    const { binding, registry } = createActivationFixture()
    expect(
      resolveActivationPolicy(binding, registry, [previewDigest]).evaluate('clinic.registration-received', address),
    ).toBe('preview-recipient-not-allowed')
  })

  it.each(commandTypes)('activates only %s in its own environment', (commandType) => {
    for (const environment of ['preview', 'production'] as const) {
      const { binding, registry, record } = createActivationFixture(environment)
      record.commandType = commandType
      const policy = resolveActivationPolicy(binding, registry, environment === 'preview' ? [previewDigest] : undefined)
      for (const candidate of commandTypes) {
        expect(policy.evaluate(candidate, 'recipient@example.test')).toBe(
          candidate === commandType ? null : 'command-not-enabled',
        )
      }
    }
  })

  it('does not inherit Preview activation or accept its allowlist in Production', () => {
    const preview = createActivationFixture()
    const production = createActivationFixture('production')
    expect(
      resolveActivationPolicy(production.binding, preview.registry).evaluate(
        'clinic.registration-received',
        'recipient@example.test',
      ),
    ).toBe('command-not-enabled')
    expect(() => resolveActivationPolicy(production.binding, production.registry, [previewDigest])).toThrow(
      'environment-unavailable',
    )
    expect(() =>
      validateTransactionalEmailStartupForTest(
        {
          VERCEL_ENV: 'production',
          ...production.configuration.secrets.production,
          LETTERMINT_PREVIEW_RECIPIENT_DIGESTS: '[]',
        },
        production.configuration.registry,
        production.configuration.locks,
        webhookNow,
        production.registry,
      ),
    ).toThrow('environment-unavailable')
  })

  it('rejects cross-environment preflight and evidence reuse', () => {
    const preview = createActivationFixture()
    const production = createActivationFixture('production')
    production.registry.preflights.push(preview.preflight)
    production.preflight.evidence.dns = preview.preflight.evidence.dns
    expect(() => resolveActivationPolicy(production.binding, production.registry)).toThrow('environment-unavailable')
    production.preflight.evidence.dns = 'production-dns'
    production.record.preflightVersion = preview.preflight.version
    expect(() => resolveActivationPolicy(production.binding, production.registry)).toThrow('environment-unavailable')
  })

  it('rejects a copied command-specific one-path approval', () => {
    const fixture = createActivationFixture('production')
    fixture.registry.records.push({ ...fixture.record, commandType: 'auth.invitation' })
    expect(() => resolveActivationPolicy(fixture.binding, fixture.registry)).toThrow('environment-unavailable')
  })

  it('requires an independently verified binding and snapshots reviewed configuration', () => {
    const fixture = createActivationFixture('production')
    expect(() => resolveActivationPolicy({ ...fixture.binding }, fixture.registry)).toThrow('environment-unavailable')
    const policy = resolveActivationPolicy(fixture.binding, fixture.registry)
    fixture.record.commandType = 'auth.invitation'
    expect(policy.evaluate('auth.invitation', 'recipient@example.test')).toBe('command-not-enabled')
  })

  it('rejects browser execution even when presented with a previously verified binding', () => {
    const fixture = createActivationFixture()
    vi.stubGlobal('window', {})
    try {
      expect(() => resolveActivationPolicy(fixture.binding, fixture.registry)).toThrow('environment-unavailable')
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('rejects a malformed null allowlist', () => {
    const fixture = createActivationFixture()
    expect(() => resolveActivationPolicy(fixture.binding, fixture.registry, null)).toThrow('environment-unavailable')
  })

  it.each(['null', '{broken', '["recipient@example.test"]'])(
    'rejects malformed central Preview configuration: %s',
    (value) => {
      const fixture = createActivationFixture()
      expect(() =>
        validateTransactionalEmailStartupForTest(
          {
            VERCEL_ENV: 'preview',
            ...fixture.configuration.secrets.preview,
            LETTERMINT_PREVIEW_RECIPIENT_DIGESTS: value,
          },
          fixture.configuration.registry,
          fixture.configuration.locks,
          webhookNow,
          fixture.registry,
        ),
      ).toThrow('environment-unavailable')
    },
  )
})
