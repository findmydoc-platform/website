import { TransactionalEmailError } from './errors'
import {
  createHostedLettermintOutboundBinding,
  resolveHostedLettermintBinding,
  type HostedLettermintOutboundBinding,
} from './hostedConfiguration'
import registry from './lettermintRegistry.json' with { type: 'json' }
import targetLocks from './lettermintTargetLocks.json' with { type: 'json' }
import activationRegistry from './activationRegistry.json' with { type: 'json' }
import {
  hasTransactionalEmailActivationForEnvironment,
  resolveActivationPolicy,
  type ActivationPolicy,
} from './activationPolicy'
import { recipientDigest } from './recipientBinding'

export type EmailEnvironment = 'local' | 'test' | 'ci' | 'preview' | 'production'
type HostedEnvironment = Extract<EmailEnvironment, 'preview' | 'production'>
type LocalEnvironment = Exclude<EmailEnvironment, HostedEnvironment>
type DigestRecipient = (recipient: Parameters<typeof recipientDigest>[0]) => string
type Startup =
  | {
      environment: LocalEnvironment
      configured: true
      digestRecipient: DigestRecipient
      activationPolicy: ActivationPolicy
    }
  | { environment: HostedEnvironment; configured: false }
  | {
      environment: HostedEnvironment
      configured: true
      binding: HostedLettermintOutboundBinding
      digestRecipient: DigestRecipient
      activationPolicy: ActivationPolicy
    }
type TransactionalEmailRuntime =
  | {
      environment: LocalEnvironment
      delivery: 'fake'
      links: 'fake'
      activationPolicy: ActivationPolicy
      digestRecipient: DigestRecipient
    }
  | {
      environment: HostedEnvironment
      delivery: 'lettermint'
      links: 'unavailable'
      activationPolicy: ActivationPolicy
      digestRecipient: DigestRecipient
      binding: HostedLettermintOutboundBinding
    }
type TransactionalEmailAcceptanceRuntime = {
  environment: EmailEnvironment
  digestRecipient: DigestRecipient
}

function classifyEnvironment(env: Record<string, string | undefined>): EmailEnvironment {
  if (env.VERCEL_ENV?.trim() && env.DEPLOYMENT_ENV?.trim() && env.VERCEL_ENV.trim() !== env.DEPLOYMENT_ENV.trim())
    throw new TransactionalEmailError('environment-unavailable')
  const configured = env.VERCEL_ENV?.trim() || env.DEPLOYMENT_ENV?.trim()
  if (configured === 'preview' || configured === 'production') {
    if (env.CI === 'true' || env.NODE_ENV === 'test') throw new TransactionalEmailError('environment-unavailable')
    return configured
  }
  if (Object.keys(env).some((key) => key.startsWith('LETTERMINT_'))) {
    throw new TransactionalEmailError('environment-unavailable')
  }
  if (configured && !['local', 'development', 'test', 'ci'].includes(configured)) {
    throw new TransactionalEmailError('environment-unavailable')
  }
  let environment: EmailEnvironment
  if (env.CI === 'true' || configured === 'ci') environment = 'ci'
  else if (env.NODE_ENV === 'test' || configured === 'test') environment = 'test'
  else if (env.NODE_ENV === 'production' || env.VERCEL === '1') {
    throw new TransactionalEmailError('environment-unavailable')
  } else environment = 'local'
  return environment
}

export function resolveTransactionalEmailEnvironment(env: Record<string, string | undefined> = process.env) {
  return classifyEnvironment(env)
}

function hasEnvironmentEntry(input: unknown, key: 'targets' | 'fingerprints', environment: 'preview' | 'production') {
  if (!input || typeof input !== 'object') return true
  const entries = Reflect.get(input, key)
  if (!Array.isArray(entries)) return true
  return entries.some(
    (entry) => entry !== null && typeof entry === 'object' && Reflect.get(entry, 'environment') === environment,
  )
}

function resolveStartup(
  env: Record<string, string | undefined> = process.env,
  registryInput: unknown = registry,
  lockedTargets: unknown = targetLocks,
  now = Date.now(),
  activationInput: unknown = activationRegistry,
): Startup {
  const environment = resolveTransactionalEmailEnvironment(env)
  if (environment === 'preview' || environment === 'production') {
    const activationDeclared = hasTransactionalEmailActivationForEnvironment(environment, activationInput)
    const configured =
      activationDeclared ||
      Object.keys(env).some((key) => key.startsWith('LETTERMINT_')) ||
      hasEnvironmentEntry(registryInput, 'targets', environment) ||
      hasEnvironmentEntry(registryInput, 'fingerprints', environment) ||
      hasEnvironmentEntry(lockedTargets, 'targets', environment)
    if (!configured) return { environment, configured: false }
    const binding = resolveHostedLettermintBinding(environment, registryInput, env, now, lockedTargets)
    let previewRecipients: unknown
    if (environment === 'preview') {
      try {
        previewRecipients = JSON.parse(env.LETTERMINT_PREVIEW_RECIPIENT_DIGESTS ?? '[]')
      } catch {
        throw new TransactionalEmailError('environment-unavailable')
      }
    }
    const digestRecipient = (recipient: Parameters<typeof recipientDigest>[0]) =>
      recipientDigest(recipient, { version: binding.target.digestKeyId, secret: binding.digestKey })
    return {
      environment,
      configured: true,
      binding: createHostedLettermintOutboundBinding(binding),
      digestRecipient,
      activationPolicy: resolveActivationPolicy(binding, activationInput, previewRecipients),
    }
  }
  return {
    environment,
    configured: true,
    digestRecipient: recipientDigest,
    activationPolicy: Object.freeze({ evaluate: () => null }),
  }
}

export function validateTransactionalEmailStartup() {
  const { environment } = resolveStartup()
  return { environment }
}

export function validateTransactionalEmailStartupForTest(...args: Parameters<typeof resolveStartup>) {
  if (process.env.VITEST !== 'true') throw new TransactionalEmailError('environment-unavailable')
  const { environment } = resolveStartup(...args)
  return { environment }
}

function runtimeFromStartup(startup: Startup): TransactionalEmailRuntime {
  if (!startup.configured) throw new TransactionalEmailError('environment-unavailable')
  if ('binding' in startup) {
    return {
      environment: startup.environment,
      delivery: 'lettermint',
      links: 'unavailable',
      activationPolicy: startup.activationPolicy,
      digestRecipient: startup.digestRecipient,
      binding: startup.binding,
    } as const
  }
  return {
    environment: startup.environment,
    delivery: 'fake',
    links: 'fake',
    activationPolicy: startup.activationPolicy,
    digestRecipient: startup.digestRecipient,
  } as const
}

export function selectTransactionalEmailRuntime(): TransactionalEmailRuntime {
  return runtimeFromStartup(resolveStartup())
}

export function selectTransactionalEmailRuntimeForTest(
  ...args: Parameters<typeof resolveStartup>
): TransactionalEmailRuntime {
  if (process.env.VITEST !== 'true') throw new TransactionalEmailError('environment-unavailable')
  return runtimeFromStartup(resolveStartup(...args))
}

function acceptanceRuntimeFromStartup(startup: Startup): TransactionalEmailAcceptanceRuntime {
  if (!startup.configured) throw new TransactionalEmailError('environment-unavailable')
  return { environment: startup.environment, digestRecipient: startup.digestRecipient } as const
}

export function selectTransactionalEmailAcceptanceRuntime(): TransactionalEmailAcceptanceRuntime {
  return acceptanceRuntimeFromStartup(resolveStartup())
}

export function selectTransactionalEmailAcceptanceRuntimeForTest(
  ...args: Parameters<typeof resolveStartup>
): TransactionalEmailAcceptanceRuntime {
  if (process.env.VITEST !== 'true') throw new TransactionalEmailError('environment-unavailable')
  return acceptanceRuntimeFromStartup(resolveStartup(...args))
}
