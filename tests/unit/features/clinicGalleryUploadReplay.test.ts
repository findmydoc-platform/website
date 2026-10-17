import { describe, expect, it, vi } from 'vitest'
import { createRequire } from 'node:module'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import type { Payload, PayloadRequest } from 'payload'
import { readGalleryCreateFailure } from 'payload/gallery-upload-provenance'
import {
  createColdGalleryAuthorizationControl,
  readGalleryNativeProvenance,
} from '@/features/clinicNotifications/coldAuthorizationControl'
import { installClinicGalleryUploadReplay } from '@/features/clinicDashboard/gallery/uploadReplay'

vi.mock('payload', async (load) => ({
  ...(await load<typeof import('payload')>()),
  createLocalReq: async ({ context, req, user }: { context: object; req: object; user?: object }, payload: Payload) =>
    Object.assign(req, { context, payload, user: user ?? null }),
}))

const require = createRequire(import.meta.url)
const payloadDist = path.dirname(require.resolve('payload'))
const adapterRequire = createRequire(require.resolve('@payloadcms/db-postgres'))
const drizzleDist = path.dirname(adapterRequire.resolve('@payloadcms/drizzle'))
const loadNative = async (root: string, name: string) => import(pathToFileURL(path.join(root, name)).href)

async function fixture(
  { rollback = 'confirmed', failCount = 1, borrowed = false, foreignProvenance = false } = {} as {
    rollback?: 'confirmed' | 'missing' | 'rejected'
    failCount?: number
    borrowed?: boolean
    foreignProvenance?: boolean
  },
) {
  const { createOperation } = await loadNative(payloadDist, 'collections/operations/create.js')
  const { handleUpsertError } = await loadNative(drizzleDist, 'upsertRow/handleUpsertError.js')
  const { rollbackTransaction } = await loadNative(drizzleDist, 'transactions/rollbackTransaction.js')
  const { beginTransaction } = await loadNative(drizzleDist, 'transactions/beginTransaction.js')
  let count = 0
  const failures: object[] = []
  const requests: PayloadRequest[] = []
  const sessions: Record<string, { reject: () => Promise<void> }> = {}
  const adapter = {
    sessions,
    fieldConstraints: {},
    initializing: Promise.resolve(),
    payload: { logger: { error() {} } },
    drizzle: {
      transaction: async (work: (transaction: object) => Promise<void>) => {
        await Promise.resolve()
        try {
          await work({})
        } catch (signal) {
          throw rollback === 'rejected' ? new Error('Synthetic rollback uncertainty') : signal
        }
      },
    },
    beginTransaction: () => beginTransaction.call(adapter),
    rollbackTransaction: (...args: unknown[]) => rollbackTransaction.call(adapter, ...args),
  }
  const native = vi.fn(async (options) => {
    if (options.collection !== 'clinicMedia') {
      try {
        handleUpsertError({
          adapter: foreignProvenance ? { ...adapter } : adapter,
          collectionSlug: 'clinicNotificationControls',
          tableName: 'clinic_notification_controls',
          req: options.req,
          error: { code: '23505', detail: 'Key (key)=(synthetic-key) already exists.' },
        })
      } catch (error) {
        failures.push(error as object)
        throw error
      }
    }
    const req = options.req as PayloadRequest
    req.payload = payload
    requests.push(req)
    count++
    if (count > failCount) return { id: 91, clinic: options.data.clinic }
    return createOperation({
      collection: {
        config: {
          slug: 'clinicMedia',
          auth: { disableLocalStrategy: true },
          upload: {},
          hooks: {
            beforeOperation: [
              async () => {
                if (rollback === 'missing') delete sessions[String(await req.transactionID)]
                await createColdGalleryAuthorizationControl(
                  req,
                  'notification-authorization:clinic:42',
                  'synthetic-nonce',
                )
              },
            ],
          },
        },
      },
      data: options.data,
      req,
    })
  })
  const payload = { create: native, db: adapter, config: {}, logger: { error: vi.fn() } } as unknown as Payload
  installClinicGalleryUploadReplay(payload)
  const request = {
    context: { clinicGalleryTargetId: '42' },
    user: { id: 9, collection: 'clinicStaff' },
    ...(borrowed ? { transactionID: 'existing-owner' } : {}),
  } as unknown as PayloadRequest
  const input = {
    collection: 'clinicMedia',
    data: { clinic: 42 },
    req: request,
    file: { data: Buffer.from('synthetic image bytes'), mimetype: 'image/png', name: 'fixture.png', size: 21 },
  } as never
  return { payload, input, native, failures, requests, caller: request }
}

describe('native clinic gallery upload replay boundary', () => {
  it('preserves an unproven unique failure without replaying or changing its classification', async () => {
    const failure = Object.assign(new Error('Synthetic unique failure'), { code: '23505' })
    const create = vi.fn().mockRejectedValue(failure)
    const payload = { create } as unknown as Payload
    installClinicGalleryUploadReplay(payload)
    await expect(
      payload.create({
        collection: 'clinicMedia',
        data: { clinic: 42 },
        context: { galleryReplay: true, rollbackConfirmed: true },
        file: { data: Buffer.from('synthetic'), size: 9, name: 'fixture.png', mimetype: 'image/png' },
      } as never),
    ).rejects.toBe(failure)
    expect(create).toHaveBeenCalledOnce()
  })
  it('replays a positively rolled-back cold initializer in a fresh native request', async () => {
    const f = await fixture()
    await expect(f.payload.create(f.input)).resolves.toMatchObject({ id: 91, clinic: 42 })
    expect(f.requests).toHaveLength(2)
    expect(f.requests[0]).not.toBe(f.requests[1])
    expect(f.caller.transactionID).toBeUndefined()
    const failure = f.failures[0]
    const request = f.requests[0]
    if (!failure || !request) throw new Error('Expected native failure evidence')
    const evidence = readGalleryCreateFailure(failure, request)
    expect(evidence).toMatchObject({ owned: true, phase: 'before-upload' })
    expect(typeof evidence?.transactionID).toBe('string')
    expect(
      evidence?.rollbacks.some(
        (receipt) =>
          readGalleryNativeProvenance(request)?.readRollback(receipt)?.transactionID === evidence.transactionID,
      ),
    ).toBe(true)
  })

  it.each(['missing', 'rejected'] as const)('never replays %s rollback evidence', async (rollback) => {
    const f = await fixture({ rollback })
    const rejected = await f.payload.create(f.input).catch((error) => error)
    expect(rejected).toBe(f.failures[0])
    expect(f.requests).toHaveLength(1)
  })

  it('never starts a fourth native attempt', async () => {
    const f = await fixture({ failCount: 4 })
    const rejected = await f.payload.create(f.input).catch((error) => error)
    expect(rejected).toBe(f.failures[2])
    expect(f.requests).toHaveLength(3)
  })

  it('does not replay a borrowed native owner', async () => {
    const f = await fixture({ borrowed: true })
    const rejected = await f.payload.create(f.input).catch((error) => error)
    expect(rejected).toBe(f.failures[0])
    expect(f.requests).toHaveLength(1)
  })
  it('rejects mapped evidence from a foreign adapter even when its version and field match', async () => {
    const f = await fixture({ foreignProvenance: true })
    const rejected = await f.payload.create(f.input).catch((error) => error)
    expect(rejected).toBe(f.failures[0])
    expect(f.requests).toHaveLength(1)
  })
})
