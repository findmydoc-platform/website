import { describe, expect, it } from 'vitest'
import activationRegistry from '@/features/transactionalEmail/activationRegistry.json'
import { isTransactionalEmailCommandActivationDeclared } from '@/features/transactionalEmail/activationPolicy'
import { commandTypes } from '@/features/transactionalEmail/commands'
import lettermintRegistry from '@/features/transactionalEmail/lettermintRegistry.json'
import targetLocks from '@/features/transactionalEmail/lettermintTargetLocks.json'

const hostedEnvironments = ['preview', 'production'] as const
const expectedWebhookEvents = [
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
type CredentialEvidence = { bindingId: string; sha256: string }
type PreflightCredentials = {
  projectToken: CredentialEvidence
  webhookSecret: CredentialEvidence
  previousWebhookSecret:
    | (CredentialEvidence & {
        overlap: { startsAt: string; validUntil: string }
      })
    | null
  digestKey: CredentialEvidence
  previousDigestKeys: Array<CredentialEvidence & { version: string }>
}

const targetIdentity = ({
  projectId,
  routeId,
  routeSlug,
  teamId,
}: {
  projectId: string
  routeId: string
  routeSlug: string
  teamId: string
}) => ({ projectId, routeId, routeSlug, teamId })

describe('committed transactional email activation', () => {
  it.each([
    'moderation.report-received',
    'moderation.report-decided',
    'moderation.appeal-received',
    'moderation.appeal-decided',
  ] as const)('declares %s only in Preview with the existing preflight', (commandType) => {
    expect(isTransactionalEmailCommandActivationDeclared('preview', commandType, activationRegistry)).toBe(true)
    expect(isTransactionalEmailCommandActivationDeclared('production', commandType, activationRegistry)).toBe(false)
    expect(activationRegistry.records.filter((record) => record.commandType === commandType)).toEqual([
      {
        commandType,
        registryVersion: 'activation-v1',
        preflightVersion: 'preview-preflight-v1',
        environment: 'preview',
      },
    ])
  })

  it('declares conversation notifications separately with the reviewed Production release', () => {
    expect(
      isTransactionalEmailCommandActivationDeclared(
        'preview',
        'conversation.external-message-received',
        activationRegistry,
      ),
    ).toBe(true)
    expect(
      isTransactionalEmailCommandActivationDeclared(
        'production',
        'conversation.external-message-received',
        activationRegistry,
      ),
    ).toBe(true)
    expect(
      activationRegistry.records.filter(({ commandType }) => commandType === 'conversation.external-message-received'),
    ).toEqual([
      {
        commandType: 'conversation.external-message-received',
        registryVersion: 'activation-v1',
        preflightVersion: 'preview-preflight-v1',
        environment: 'preview',
      },
      {
        commandType: 'conversation.external-message-received',
        registryVersion: 'activation-v1',
        preflightVersion: 'production-preflight-v2',
        environment: 'production',
        release: { onePath: 'website-pr-2059' },
      },
    ])
  })

  it.each([
    'missing release',
    'invalid release',
    'reused release',
    'Preview preflight',
    'stale preflight',
    'stale registry',
  ] as const)('rejects a conversation Production declaration with %s', (drift) => {
    const invalid = structuredClone(activationRegistry)
    const record = invalid.records.find(
      ({ environment, commandType }) =>
        environment === 'production' && commandType === 'conversation.external-message-received',
    )!
    if (drift === 'missing release') Reflect.deleteProperty(record, 'release')
    else if (drift === 'invalid release') record.release!.onePath = 'unreviewed-release'
    else if (drift === 'reused release') record.release!.onePath = 'website-pr-2040'
    else if (drift === 'Preview preflight') record.preflightVersion = 'preview-preflight-v1'
    else if (drift === 'stale preflight') record.preflightVersion = 'production-preflight-v1'
    else record.registryVersion = 'activation-v0'

    expect(() =>
      isTransactionalEmailCommandActivationDeclared('production', 'conversation.external-message-received', invalid),
    ).toThrow('environment-unavailable')
  })

  it('removes only the conversation Production declaration during rollback', () => {
    const rolledBack = structuredClone(activationRegistry)
    rolledBack.records = rolledBack.records.filter(
      ({ environment, commandType }) =>
        environment !== 'production' || commandType !== 'conversation.external-message-received',
    )

    for (const environment of hostedEnvironments) {
      for (const commandType of commandTypes) {
        expect(isTransactionalEmailCommandActivationDeclared(environment, commandType, rolledBack)).toBe(
          environment === 'production' && commandType === 'conversation.external-message-received'
            ? false
            : isTransactionalEmailCommandActivationDeclared(environment, commandType, activationRegistry),
        )
      }
    }
  })

  it('rejects Production auth declarations without the expected native-mail suppression identity', () => {
    const incomplete = structuredClone(activationRegistry)
    const production = incomplete.preflights.find(({ environment }) => environment === 'production')!
    Reflect.deleteProperty(production, 'nativeMailSuppression')

    expect(() =>
      isTransactionalEmailCommandActivationDeclared('production', 'auth.email-verification', incomplete),
    ).toThrow('environment-unavailable')
  })

  it.each(['release', 'preflightVersion', 'registryVersion'] as const)(
    'rejects an incomplete Production auth record without %s',
    (field) => {
      const incomplete = structuredClone(activationRegistry)
      const record = incomplete.records.find(
        ({ environment, commandType }) => environment === 'production' && commandType === 'auth.invitation',
      )!
      Reflect.deleteProperty(record, field)
      expect(() => isTransactionalEmailCommandActivationDeclared('production', 'auth.invitation', incomplete)).toThrow(
        'environment-unavailable',
      )
    },
  )

  it.each(['duplicate', 'reused release', 'stale preflight', 'stale registry'] as const)(
    'rejects %s Production auth declarations',
    (drift) => {
      const invalid = structuredClone(activationRegistry)
      const record = invalid.records.find(
        ({ environment, commandType }) => environment === 'production' && commandType === 'auth.invitation',
      )!
      if (drift === 'duplicate') invalid.records.push({ ...record })
      else if (drift === 'reused release') record.release!.onePath = 'website-pr-2040'
      else if (drift === 'stale preflight') record.preflightVersion = 'production-preflight-v1'
      else record.registryVersion = 'activation-v0'
      expect(() => isTransactionalEmailCommandActivationDeclared('production', 'auth.invitation', invalid)).toThrow(
        'environment-unavailable',
      )
    },
  )

  it.each(['instance', 'projectRef', 'opsRevision', 'declarationSha256', 'enabled', 'hookFunction'] as const)(
    'rejects missing expected suppression %s',
    (field) => {
      const incomplete = structuredClone(activationRegistry)
      const production = incomplete.preflights.find(({ environment }) => environment === 'production')!
      Reflect.deleteProperty(production.nativeMailSuppression!, field)
      expect(() =>
        isTransactionalEmailCommandActivationDeclared('production', 'auth.password-recovery', incomplete),
      ).toThrow('environment-unavailable')
    },
  )

  it.each([
    ['instance', 'staging'],
    ['projectRef', 'missing'],
    ['opsRevision', 'main'],
    ['declarationSha256', 'unverified'],
    ['enabled', false],
    ['hookFunction', 'public.send_email'],
  ] as const)('rejects inconsistent expected suppression %s', (field, value) => {
    const invalid = structuredClone(activationRegistry)
    const production = invalid.preflights.find(({ environment }) => environment === 'production')!
    Reflect.set(production.nativeMailSuppression!, field, value)
    expect(() =>
      isTransactionalEmailCommandActivationDeclared('production', 'auth.email-verification', invalid),
    ).toThrow('environment-unavailable')
  })

  it('does not inherit a missing Production auth declaration from Preview', () => {
    const incomplete = structuredClone(activationRegistry)
    incomplete.records = incomplete.records.filter(
      ({ environment, commandType }) => environment !== 'production' || commandType !== 'auth.password-recovery',
    )
    expect(isTransactionalEmailCommandActivationDeclared('production', 'auth.password-recovery', incomplete)).toBe(
      false,
    )
    expect(isTransactionalEmailCommandActivationDeclared('preview', 'auth.password-recovery', incomplete)).toBe(true)
  })

  it('preserves every existing Preview record and the Production clinic registration declaration', () => {
    expect(activationRegistry.records.filter(({ environment }) => environment === 'preview')).toEqual(
      [
        'clinic.registration-received',
        'auth.email-verification',
        'auth.invitation',
        'auth.password-recovery',
        'conversation.external-message-received',
        'moderation.report-received',
        'moderation.report-decided',
        'moderation.appeal-received',
        'moderation.appeal-decided',
      ].map((commandType) => ({
        commandType,
        registryVersion: 'activation-v1',
        preflightVersion: 'preview-preflight-v1',
        environment: 'preview',
      })),
    )
    expect(
      activationRegistry.records.find(
        ({ environment, commandType }) =>
          environment === 'production' && commandType === 'clinic.registration-received',
      ),
    ).toEqual({
      commandType: 'clinic.registration-received',
      registryVersion: 'activation-v1',
      preflightVersion: 'production-preflight-v2',
      environment: 'production',
      release: { onePath: 'website-pr-1943' },
    })
    expect(
      activationRegistry.preflights.find(({ environment }) => environment === 'production')?.nativeMailSuppression,
    ).toEqual({
      instance: 'production',
      projectRef: 'dnrtpjoxtiuqqsqpknwd',
      opsRevision: 'f3deafd54970e4fad48a1e59cc24e39e0b4c8b3f',
      declarationSha256: '34efccda94fcf87f1ad74365a308266c572f92c76424e779b6bc31e70377283b',
      enabled: true,
      hookFunction: 'auth_mail_suppression.send_email_v1',
    })
  })

  it('joins each hosted target, lock, preflight, and credential fingerprint', () => {
    expect(lettermintRegistry.targets.map(({ environment }) => environment)).toEqual(hostedEnvironments)
    expect(targetLocks.targets.map(({ environment }) => environment)).toEqual(hostedEnvironments)
    expect(activationRegistry.preflights.map(({ environment }) => environment)).toEqual(hostedEnvironments)

    for (const environment of hostedEnvironments) {
      const target = lettermintRegistry.targets.find((entry) => entry.environment === environment)!
      const lock = targetLocks.targets.find((entry) => entry.environment === environment)!
      const preflight = activationRegistry.preflights.find((entry) => entry.environment === environment)!
      const credentials = preflight.credentials as PreflightCredentials
      const environmentFingerprints = lettermintRegistry.fingerprints.filter(
        (entry) => entry.environment === environment,
      )
      const fingerprint = (kind: 'digest-key' | 'project-token' | 'webhook-current') =>
        environmentFingerprints.find((entry) => entry.kind === kind)!
      const credentialEvidence = (kind: 'digest-key' | 'project-token' | 'webhook-current') => {
        const entry = fingerprint(kind)
        return { bindingId: entry.bindingId, sha256: entry.sha256 }
      }

      expect(targetIdentity(target)).toEqual(targetIdentity(lock))
      expect(target.activatedTarget).toEqual(targetIdentity(lock))
      expect(preflight.target).toEqual({
        ...targetIdentity(target),
        digestKeyId: target.digestKeyId,
        sender: target.sender,
        webhookId: target.webhookId,
      })
      expect(credentials).toEqual({
        digestKey: credentialEvidence('digest-key'),
        previousDigestKeys: [],
        previousWebhookSecret: null,
        projectToken: credentialEvidence('project-token'),
        webhookSecret: credentialEvidence('webhook-current'),
      })
      for (const entry of environmentFingerprints) {
        expect(targetIdentity(entry)).toEqual(targetIdentity(target))
      }
      expect(
        environmentFingerprints
          .map(({ bindingId, digestKeyId, kind, overlap, sha256, webhookId }) => ({
            bindingId,
            digestKeyId: digestKeyId ?? null,
            kind,
            overlap,
            sha256,
            webhookId,
          }))
          .sort((left, right) => left.bindingId.localeCompare(right.bindingId)),
      ).toEqual(
        [
          {
            ...credentials.projectToken,
            digestKeyId: null,
            kind: 'project-token',
            overlap: null,
            webhookId: null,
          },
          {
            ...credentials.webhookSecret,
            digestKeyId: null,
            kind: 'webhook-current',
            overlap: null,
            webhookId: target.webhookId,
          },
          ...(credentials.previousWebhookSecret
            ? [
                {
                  ...credentials.previousWebhookSecret,
                  digestKeyId: null,
                  kind: 'webhook-previous',
                  webhookId: target.webhookId,
                },
              ]
            : []),
          {
            ...credentials.digestKey,
            digestKeyId: target.digestKeyId,
            kind: 'digest-key',
            overlap: null,
            webhookId: null,
          },
          ...credentials.previousDigestKeys.map(({ bindingId, sha256, version }) => ({
            bindingId,
            digestKeyId: version,
            kind: 'digest-key',
            overlap: null,
            sha256,
            webhookId: null,
          })),
        ].sort((left, right) => left.bindingId.localeCompare(right.bindingId)),
      )
      expect(fingerprint('digest-key').digestKeyId).toBe(target.digestKeyId)
      expect(fingerprint('project-token').webhookId).toBeNull()
      expect(fingerprint('webhook-current').webhookId).toBe(target.webhookId)
      expect(preflight.evidence.sender).toBe(target.senderEvidenceId)
      expect(preflight.tracking).toEqual({ click: false, open: false })
      expect(preflight.webhookEvents).toEqual(expectedWebhookEvents)
    }
  })

  it('declares reviewed commands and preserves clinic registration in both environments', () => {
    const productionCommands = new Set([
      'auth.email-verification',
      'auth.invitation',
      'auth.password-recovery',
      'clinic.registration-received',
      'conversation.external-message-received',
    ])
    const previewCommands = new Set([
      ...productionCommands,
      'moderation.report-received',
      'moderation.report-decided',
      'moderation.appeal-received',
      'moderation.appeal-decided',
    ])

    for (const command of commandTypes) {
      expect(isTransactionalEmailCommandActivationDeclared('preview', command, activationRegistry)).toBe(
        previewCommands.has(command),
      )
      expect(isTransactionalEmailCommandActivationDeclared('production', command, activationRegistry)).toBe(
        productionCommands.has(command),
      )
    }

    expect(activationRegistry.records.find(({ environment }) => environment === 'production')?.release).toEqual({
      onePath: 'website-pr-1943',
    })

    expect(
      activationRegistry.records
        .filter(({ environment }) => environment === 'production')
        .map(({ commandType, release }) => [commandType, release?.onePath]),
    ).toEqual([
      ['clinic.registration-received', 'website-pr-1943'],
      ['auth.email-verification', 'website-pr-2040'],
      ['auth.invitation', 'website-pr-2043'],
      ['auth.password-recovery', 'website-pr-2041'],
      ['conversation.external-message-received', 'website-pr-2059'],
    ])
  })
})
