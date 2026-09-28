import { z } from 'zod'
import type { TransactionalEmailOutbox } from '@/payload-types'
import { commandTypes } from './commands'
import { TransactionalEmailError } from './errors'
import { requireVerifiedHostedOutboundBinding, type HostedLettermintOutboundBinding } from './hostedConfiguration'
import { recipientAddressDigest } from './recipientBinding'

const identifier = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/)
const requestSchema = z.strictObject({
  from: z.email(),
  to: z.tuple([z.email()]),
  subject: z.string().min(1).max(998),
  html: z.string().min(3),
  text: z.string().min(3),
  route: identifier,
  settings: z.strictObject({ track_opens: z.literal(false), track_clicks: z.literal(false) }),
  metadata: z.strictObject({
    operation_id: identifier,
    command_type: z.enum(commandTypes),
    environment: z.enum(['preview', 'production']),
  }),
})
export const providerBindingFields = ['providerTeamId', 'providerProjectId', 'providerRouteId'] as const
export type PreparedProviderRequest = Readonly<{
  body: string
  teamId: string
  projectId: string
  routeId: string
  routeSlug: string
}>

export function validateProviderPreparation(record: TransactionalEmailOutbox) {
  if (
    record.providerRecipientDigest != null &&
    !/^[A-Za-z0-9_-]{1,128}:[a-f0-9]{64}$/.test(record.providerRecipientDigest)
  )
    throw new TransactionalEmailError('access-denied')
  if (!providerBindingFields.some((field) => record[field] != null) && record.preparedProviderRequest == null) {
    if (record.providerRecipientDigest != null) throw new TransactionalEmailError('access-denied')
    return
  }
  if (providerBindingFields.some((field) => !identifier.safeParse(record[field]).success))
    throw new TransactionalEmailError('access-denied')
  if (record.preparedProviderRequest == null) {
    if (record.scrubbedAt) return
    throw new TransactionalEmailError('access-denied')
  }
  let body: z.infer<typeof requestSchema>
  try {
    body = requestSchema.parse(JSON.parse(record.preparedProviderRequest))
  } catch {
    throw new TransactionalEmailError('access-denied')
  }
  if (
    JSON.stringify(body) !== record.preparedProviderRequest ||
    body.to[0] !== record.recipientAddress ||
    body.subject !== record.preparedSubject ||
    body.html !== record.preparedHtml ||
    body.text !== record.preparedText ||
    body.metadata.operation_id !== String(record.id) ||
    body.metadata.command_type !== record.commandType ||
    (!['local', 'test', 'ci'].includes(record.runtimeEnvironment) &&
      body.metadata.environment !== record.runtimeEnvironment)
  )
    throw new TransactionalEmailError('access-denied')
}

export function prepareProviderRequest(record: TransactionalEmailOutbox, binding: HostedLettermintOutboundBinding) {
  requireVerifiedHostedOutboundBinding(binding)
  const { target } = binding
  if (providerBindingFields.some((field) => record[field] != null)) {
    if (
      record.providerTeamId !== target.teamId ||
      record.providerProjectId !== target.projectId ||
      record.providerRouteId !== target.routeId ||
      record.providerRecipientDigest !==
        recipientAddressDigest(record.recipientAddress!, { version: target.digestKeyId, secret: binding.digestKey }) ||
      !record.preparedProviderRequest ||
      requestRoute(record.preparedProviderRequest) !== target.routeSlug
    )
      throw new TransactionalEmailError('environment-unavailable')
    validateProviderPreparation(record)
    if (JSON.parse(record.preparedProviderRequest).metadata.environment !== target.environment)
      throw new TransactionalEmailError('environment-unavailable')
    return {}
  }
  if (record.preparedProviderRequest || record.attemptCount || record.state !== 'prepared')
    throw new TransactionalEmailError('access-denied')
  const prepared = {
    providerRecipientDigest: recipientAddressDigest(record.recipientAddress!, {
      version: target.digestKeyId,
      secret: binding.digestKey,
    }),
    preparedProviderRequest: JSON.stringify({
      from: target.sender,
      to: [record.recipientAddress],
      subject: record.preparedSubject,
      html: record.preparedHtml,
      text: record.preparedText,
      route: target.routeSlug,
      settings: { track_opens: false, track_clicks: false },
      metadata: { operation_id: String(record.id), command_type: record.commandType, environment: target.environment },
    }),
    providerTeamId: target.teamId,
    providerProjectId: target.projectId,
    providerRouteId: target.routeId,
  }
  validateProviderPreparation({ ...record, ...prepared })
  return prepared
}

export function storedProviderRequest(record: TransactionalEmailOutbox): PreparedProviderRequest | undefined {
  if (!record.preparedProviderRequest) return undefined
  return Object.freeze({
    body: record.preparedProviderRequest,
    teamId: record.providerTeamId!,
    projectId: record.providerProjectId!,
    routeId: record.providerRouteId!,
    routeSlug: requestRoute(record.preparedProviderRequest),
  })
}

function requestRoute(body: string): string {
  try {
    return requestSchema.parse(JSON.parse(body)).route
  } catch {
    throw new TransactionalEmailError('access-denied')
  }
}
