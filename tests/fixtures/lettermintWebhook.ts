import { createHash } from 'node:crypto'

export const webhookNow = Date.parse('2026-09-26T12:00:00.000Z')
export const webhookEnvironment = 'preview' as const

export function createWebhookConfiguration() {
  const environments = ['preview', 'production'] as const
  const credentials = (environment: (typeof environments)[number]): Record<string, string> => ({
    LETTERMINT_PROJECT_TOKEN: `lm_synthetic_${environment}_token`,
    LETTERMINT_WEBHOOK_SECRET: `whsec_synthetic_${environment}_current`, // pragma: allowlist secret
    LETTERMINT_RECIPIENT_DIGEST_KEY: `synthetic_${environment}_digest_key`,
  })
  const secrets = { preview: credentials('preview'), production: credentials('production') }
  const targets = environments.map((environment) => ({
    environment,
    teamId: `team-${environment}`,
    projectId: `project-${environment}`,
    routeId: `route-${environment}`,
    webhookId: `webhook-${environment}`,
    sender: `${environment}@example.test`,
    senderEvidenceId: `sender-${environment}`,
    digestKeyId: `digest-${environment}`,
    activatedTarget: {
      teamId: `team-${environment}`,
      projectId: `project-${environment}`,
      routeId: `route-${environment}`,
    },
  }))
  const fingerprints = targets.flatMap((target) =>
    [
      ['project-token', 'LETTERMINT_PROJECT_TOKEN'],
      ['webhook-current', 'LETTERMINT_WEBHOOK_SECRET'],
      ['digest-key', 'LETTERMINT_RECIPIENT_DIGEST_KEY'],
    ].map(([kind, variable]) => ({
      ...target.activatedTarget,
      environment: target.environment,
      kind,
      bindingId: `${target.environment}-${kind}`,
      sha256: createHash('sha256').update(secrets[target.environment][variable!]!).digest('hex'),
      webhookId: kind === 'webhook-current' ? target.webhookId : null,
      overlap: null as { startsAt: string; validUntil: string } | null,
    })),
  )
  return {
    secrets,
    registry: { targets, fingerprints },
    locks: { targets: targets.map(({ environment, activatedTarget }) => ({ environment, ...activatedTarget })) },
  }
}

export const webhookConfiguration = createWebhookConfiguration()

export function webhookTestEvent(environment = 'preview') {
  return {
    id: 'test-7f9c8e2a-1b3d-4f6e-b7d2-5c9f3a7e8b0c',
    event: 'webhook.test',
    timestamp: new Date(webhookNow).toISOString(),
    context: {
      scope: 'route',
      team_id: `team-${environment}`,
      project_id: `project-${environment}`,
      route_id: `route-${environment}`,
    },
    data: { webhook_id: `webhook-${environment}`, message: 'Synthetic provider connectivity test' },
  }
}
