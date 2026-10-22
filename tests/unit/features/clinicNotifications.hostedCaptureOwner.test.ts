import type {
  CollectionAfterOperationHook,
  CollectionBeforeChangeHook,
  CollectionBeforeOperationHook,
  PayloadRequest,
} from 'payload'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ClinicNotificationControls } from '@/collections/ClinicNotificationControls'
import { activateHostedCapture, readHostedCaptureStatus } from '@/features/clinicNotifications/hostedCapture'

vi.mock('payload', async (importOriginal) => {
  const actual = await importOriginal<typeof import('payload')>()
  return {
    ...actual,
    createLocalReq: vi.fn(async (options, payload) => ({
      ...options.req,
      payload,
      context: options.context ?? {},
      user: options.user,
    })),
  }
})

type Control = { id: number; key: string; nonce: string; active: boolean; activatedAt: string | null }

/** Controlled Local API stand-in uses the installed native hook phase names; real ordering remains integration-owned. */
function captureRuntime(options: { cold?: boolean; loseOwner?: boolean; revokeOperator?: boolean } = {}) {
  let control: Control | undefined = options.cold
    ? undefined
    : { id: 7, key: 'notification-center', nonce: 'initial', active: false, activatedAt: null }
  let role = 'support'
  let commits = 0
  const sessions: Record<string, object> = {}
  const payload = {
    db: { sessions },
    logger: { warn: vi.fn() },
    find: vi.fn(async ({ collection }: { collection: string }) => ({
      docs: collection === 'platformStaff' ? (role === 'support' ? [{ id: 11, role }] : []) : control ? [control] : [],
    })),
    create: vi.fn(async (args: { req: PayloadRequest; data: Record<string, unknown> }) =>
      nativeMutation(args, 'create'),
    ),
    update: vi.fn(async (args: { req: PayloadRequest; data: Record<string, unknown> }) => {
      if (args.data.active !== true) return control
      return nativeMutation(args, 'update')
    }),
  }
  async function nativeMutation(
    args: { req: PayloadRequest; data: Record<string, unknown> },
    operation: 'create' | 'update',
  ) {
    const previous = control
    args.req.transactionID = 'native-owner'
    sessions['native-owner'] = {}
    try {
      for (const hook of ClinicNotificationControls.hooks!.beforeOperation!)
        await hook({ args, req: args.req, operation } as Parameters<CollectionBeforeOperationHook>[0])
      for (const hook of ClinicNotificationControls.hooks!.beforeChange!)
        args.data = await hook({
          data: args.data,
          originalDoc: previous ?? {},
          req: args.req,
          operation,
        } as Parameters<CollectionBeforeChangeHook>[0])
      control = { ...args.data, id: 7 } as Control
      if (options.loseOwner) delete sessions['native-owner']
      if (options.revokeOperator) role = 'content-manager'
      let result: unknown = control
      for (const hook of ClinicNotificationControls.hooks!.afterOperation!)
        result = await hook({
          args,
          req: args.req,
          result,
          operation: operation === 'update' ? 'updateByID' : 'create',
        } as Parameters<CollectionAfterOperationHook>[0])
      commits++
      return result
    } catch (error) {
      control = previous
      throw error
    } finally {
      delete sessions['native-owner']
    }
  }
  const req = { user: { id: 11, collection: 'platformStaff' }, payload, context: {} } as unknown as PayloadRequest
  return {
    commits: () => commits,
    activate: async () => {
      const status = await readHostedCaptureStatus(req)
      return activateHostedCapture(req, {
        action: 'activate',
        environment: 'preview',
        runtimeRevision: status.runtimeRevision,
        expectedState: status.expectedState,
      })
    },
    read: () => readHostedCaptureStatus(req),
  }
}

describe('registered hosted capture final native hook dispatch', () => {
  beforeEach(() => {
    vi.stubEnv('DEPLOYMENT_ENVIRONMENT', 'preview')
    vi.stubEnv('VERCEL_ENV', 'preview')
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', 'a'.repeat(40))
  })
  afterEach(() => vi.unstubAllEnvs())

  it('executes the updateByID owner fence and rejects a lost original session before commit', async () => {
    const runtime = captureRuntime({ loseOwner: true })
    await expect(runtime.activate()).rejects.toThrow('active native transaction session')
    expect(runtime.commits()).toBe(0)
    expect(await runtime.read()).toMatchObject({ active: false, activatedAt: null })
  })

  it('executes the updateByID current-operator fence after persistence and before commit', async () => {
    const runtime = captureRuntime({ revokeOperator: true })
    await expect(runtime.activate()).rejects.toMatchObject({ status: 403 })
    expect(runtime.commits()).toBe(0)
  })

  it('retains create final checks and timestamp-preserving active replay', async () => {
    const runtime = captureRuntime({ cold: true })
    const created = await runtime.activate()
    expect(created).toMatchObject({ active: true, outcome: 'activated', activatedAt: expect.any(String) })
    expect(await runtime.activate()).toMatchObject({ outcome: 'already_active', activatedAt: created.activatedAt })
    expect(runtime.commits()).toBe(1)
  })
})
