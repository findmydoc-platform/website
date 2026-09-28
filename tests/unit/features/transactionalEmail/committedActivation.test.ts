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

  it('activates only the clinic registration receipt in each hosted environment', () => {
    for (const environment of hostedEnvironments) {
      for (const command of commandTypes) {
        expect(isTransactionalEmailCommandActivationDeclared(environment, command, activationRegistry)).toBe(
          command === 'clinic.registration-received',
        )
      }
    }

    expect(activationRegistry.records.find(({ environment }) => environment === 'production')?.release).toEqual({
      onePath: 'website-pr-1943',
    })
  })
})
