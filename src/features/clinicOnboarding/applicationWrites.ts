import {
  createLocalReq,
  type CollectionAfterChangeHook,
  type CollectionBeforeChangeHook,
  type CollectionBeforeOperationHook,
  type RequiredDataFromCollectionSlug,
  type PayloadRequest,
} from 'payload'
import { requireNotificationTransaction } from '@/collections/clinicNotifications/common'
import type { ClinicApplication } from '@/payload-types'

type ApplicationData = Partial<Omit<ClinicApplication, 'id' | 'createdAt' | 'updatedAt'>>
type Command = {
  prepare: (
    req: PayloadRequest,
    skipWrite: (application: ClinicApplication) => never,
  ) => Promise<{
    data?: ApplicationData
    workflowData?: ApplicationData
  }>
  finish?: (req: PayloadRequest, application: ClinicApplication) => Promise<ClinicApplication>
}

type ActiveCommand = Omit<Command, 'prepare'> & {
  prepare: (req: PayloadRequest) => ReturnType<Command['prepare']>
  operation: 'create' | 'update'
  id?: number
  transaction?: string | number
  workflowData?: ApplicationData
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
  requireNotificationTransaction(req, transactionID)
  command.workflowData = workflowData
  Object.assign(args.data, data)
}

export const applyStagedApplicationWorkflowData: CollectionBeforeChangeHook<ClinicApplication> = ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  const command = commands.get(req)
  if (
    !command ||
    command.transaction === undefined ||
    command.operation !== operation ||
    command.id !== originalDoc?.id
  )
    return data
  return { ...data, ...command.workflowData }
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
  requireNotificationTransaction(req, command.transaction)
  const result = command.finish ? await command.finish(req, doc) : doc
  requireNotificationTransaction(req, command.transaction)
  return result
}
