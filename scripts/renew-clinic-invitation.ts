import 'dotenv/config'
import { pathToFileURL } from 'node:url'
import { createLocalReq, getPayload, type PayloadRequest } from 'payload'
import { z } from 'zod'
import { renewExpiredClinicInvitation } from '../src/auth/actions/clinicInvitationRequests'
import {
  resolveTransactionalEmailEnvironment,
  validateTransactionalEmailStartup,
} from '../src/features/transactionalEmail/environment'
import { protectAuthActionProtocolStorage } from '../src/auth/actions/protocol/storage'

const optionsSchema = z
  .object({
    environment: z.enum(['preview', 'production']),
    'staff-id': z.coerce.number().int().positive(),
    'expired-action-id': z.coerce.number().int().positive(),
    'operator-id': z.coerce.number().int().positive(),
    mode: z.enum(['dry-run', 'apply']),
  })
  .strict()

type Runtime = {
  open(operatorId: number): Promise<{ req: PayloadRequest; close(): Promise<void> }>
  write(value: string): void
}

export async function openClinicInvitationOperator(operatorId: number) {
  if (process.env.PAYLOAD_DB_PUSH === 'true') throw new Error('Schema push is unavailable for invitation renewal.')
  const { default: config } = await import('../src/payload.config')
  validateTransactionalEmailStartup()
  const payload = await getPayload({ config, key: 'clinic-invitation-operator', disableOnInit: true })
  try {
    protectAuthActionProtocolStorage(payload)
    const operator = await payload.findByID({
      collection: 'platformStaff',
      id: operatorId,
      depth: 0,
      overrideAccess: true,
    })
    return {
      req: await createLocalReq({ user: { ...operator, collection: 'platformStaff' } }, payload),
      close: () => payload.destroy(),
    }
  } catch (error) {
    await payload.destroy()
    throw error
  }
}

async function defaultRuntime(): Promise<Runtime> {
  return {
    write: (value) => process.stdout.write(value),
    open: openClinicInvitationOperator,
  }
}

async function runClinicInvitationRenewal(argv: string[]) {
  const args = argv.filter((arg) => arg !== '--')
  const values: Record<string, string> = {}
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index]?.replace(/^--/, '')
    const value = args[index + 1]
    if (!key || !args[index]!.startsWith('--') || !value || key in values) throw new Error('Invalid renewal arguments.')
    values[key] = value
  }
  const options = optionsSchema.parse(values)
  if (resolveTransactionalEmailEnvironment() !== options.environment) throw new Error('Renewal environment mismatch.')
  const selected = await defaultRuntime()
  const session = await selected.open(options['operator-id'])
  try {
    const result = await renewExpiredClinicInvitation(session.req, {
      clinicStaffId: options['staff-id'],
      expiredActionId: options['expired-action-id'],
      dryRun: options.mode === 'dry-run',
    })
    selected.write(`${JSON.stringify(result)}\n`)
  } finally {
    await session.close()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runClinicInvitationRenewal(process.argv.slice(2)).catch(() => {
    process.stderr.write('Clinic invitation renewal failed. No credential or recipient details are logged.\n')
    process.exitCode = 1
  })
}
