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
      const fingerprint = (kind: 'digest-key' | 'project-token' | 'webhook-current') =>
        lettermintRegistry.fingerprints.find((entry) => entry.environment === environment && entry.kind === kind)!
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
      expect(preflight.credentials).toEqual({
        digestKey: credentialEvidence('digest-key'),
        previousDigestKeys: [],
        previousWebhookSecret: null,
        projectToken: credentialEvidence('project-token'),
        webhookSecret: credentialEvidence('webhook-current'),
      })
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
