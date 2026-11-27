import {
  APIError,
  createLocalReq,
  type CollectionAfterChangeHook,
  type CollectionBeforeOperationHook,
  type RequiredDataFromCollectionSlug,
  type PayloadRequest,
} from 'payload'
import { platformClinicTrustAccess } from '@/access/fieldAccess'
import { requireNotificationTransaction } from '@/collections/clinicNotifications/common'
import type { ClinicApplication } from '@/payload-types'

type WorkflowData = Partial<Pick<ClinicApplication, 'linkedRecords' | 'provisioningStatus' | 'provisioningErrorCode'>>
type ApplicationData = Partial<
  Omit<
    ClinicApplication,
    keyof WorkflowData | 'mcpOnboardingRequestKey' | 'mcpOnboardingStaffMode' | 'id' | 'createdAt' | 'updatedAt'
  >
>
type Command = {
  prepare: (
    req: PayloadRequest,
    skipWrite: (application: ClinicApplication) => never,
  ) => Promise<{
    data?: ApplicationData
    workflowData?: WorkflowData
  }>
  finish?: (req: PayloadRequest, application: ClinicApplication) => Promise<ClinicApplication>
}

type ActiveCommand = Omit<Command, 'prepare'> & {
  prepare: (req: PayloadRequest) => ReturnType<Command['prepare']>
  operation: 'create' | 'update'
  id?: number
  transaction?: string | number
  workflowData?: WorkflowData
  finished?: boolean
}

const commands = new WeakMap<PayloadRequest, ActiveCommand>()

export function isStagedApplicationCommand(req: PayloadRequest, applicationId: number): boolean {
  const command = commands.get(req)
  return command?.operation === 'update' && command.id === applicationId && command.transaction !== undefined
}

export async function writeStagedApplication(
  req: PayloadRequest,
  id: number | undefined,
  command: Command,
): Promise<ClinicApplication> {
  if (req.transactionID !== undefined) throw new Error('A staged application command must own its native operation.')

  const nativeReq = await createLocalReq(
    { user: req.user ?? undefined, req: { payloadAPI: req.payloadAPI, headers: req.headers } },
    req.payload,
  )
  const skipped = new Error('No staged application write required.')
  let unchanged: ClinicApplication | undefined
  commands.set(nativeReq, {
    ...command,
    id,
    operation: id === undefined ? 'create' : 'update',
    prepare: (hookReq) =>
      command.prepare(hookReq, (application) => {
        unchanged = application
        throw skipped
      }),
  })
  try {
    const write = { collection: 'clinicApplications' as const, depth: 0, overrideAccess: false, req: nativeReq }
    // The beforeOperation hook resolves and supplies the contact under the native transaction.
    return id === undefined
      ? await req.payload.create({ ...write, data: {} as RequiredDataFromCollectionSlug<'clinicApplications'> })
      : await req.payload.update({ ...write, id, data: {} })
  } catch (error) {
    if (error === skipped && unchanged) return unchanged
    throw error
  } finally {
    commands.delete(nativeReq)
  }
}

export const prepareStagedApplicationWrite: CollectionBeforeOperationHook<'clinicApplications'> = async ({
  operation,
  args,
  req,
}) => {
  const command = commands.get(req)
  if (!command || command.operation !== operation || command.transaction !== undefined || !('data' in args)) return
  if (operation === 'update' && (!('id' in args) || args.id !== command.id)) return

  const transactionID = await req.transactionID
  requireNotificationTransaction(req, transactionID)
  command.transaction = transactionID
  const { data, workflowData } = await command.prepare(req)
  await assertNativeApplicationTransaction(req, transactionID)
  command.workflowData = workflowData
  Object.assign(args.data, data)
}

async function assertNativeApplicationTransaction(req: PayloadRequest, owner: string | number | undefined) {
  requireNotificationTransaction(req, owner)
  if ((await req.transactionID) !== owner) throw new Error('The staged application lost its native transaction.')
}

export const finishStagedApplicationWrite: CollectionAfterChangeHook<ClinicApplication> = async ({
  doc,
  operation,
  req,
}) => {
  const command = commands.get(req)
  if (
    !command ||
    command.operation !== operation ||
    (operation === 'update' && command.id !== doc.id) ||
    command.finished
  )
    return doc

  command.finished = true
  await assertNativeApplicationTransaction(req, command.transaction)
  const saved = command.workflowData
    ? await req.payload.update({
        collection: 'clinicApplications',
        id: doc.id,
        data: command.workflowData,
        depth: 0,
        overrideAccess: true,
        req,
      })
    : doc
  const result = command.finish ? await command.finish(req, saved) : saved
  if (!(await platformClinicTrustAccess({ req }))) {
    throw new APIError('Clinic onboarding requires current clinic management access.', 403, undefined, true)
  }
  await assertNativeApplicationTransaction(req, command.transaction)
  return result
}
