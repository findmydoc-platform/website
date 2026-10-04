import {
  APIError,
  createLocalReq,
  type CollectionBeforeChangeHook,
  type CollectionBeforeDeleteHook,
  type Payload,
  type PayloadRequest,
} from 'payload'

type Write = { kind: 'append'; key: string; data: unknown } | { kind: 'delete'; id: number }
const brokerKey = Symbol.for('findmydoc.auth-action-protocol.kv-writes.v1')
const existing: unknown = Reflect.get(globalThis, brokerKey)
const writes = (existing ?? new WeakMap<object, Write>()) as WeakMap<object, Write>
if (!existing) Object.defineProperty(globalThis, brokerKey, { value: writes, writable: false, configurable: false })
function protectedKey(key: unknown) {
  return (
    typeof key === 'string' &&
    ['auth-action-protocol:', 'auth-action-password:'].some((prefix) => key.startsWith(prefix))
  )
}
function permission(req: PayloadRequest) {
  const identity: unknown = req.context?.authActionProtocolKV
  return identity && typeof identity === 'object' ? writes.get(identity) : undefined
}
const guardChange: CollectionBeforeChangeHook = ({ data, originalDoc, operation, req }) => {
  if (!protectedKey(data.key) && !protectedKey(originalDoc?.key)) return data
  const grant = permission(req)
  if (
    operation !== 'create' ||
    grant?.kind !== 'append' ||
    data.key !== grant.key ||
    JSON.stringify(data.data) !== JSON.stringify(grant.data)
  )
    throw new APIError('Protocol storage is private.', 403)
  return data
}
const guardDelete: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const doc = await req.payload.findByID({
    collection: 'payload-kv',
    id,
    overrideAccess: true,
    req,
    depth: 0,
    disableErrors: true,
  })
  if (!protectedKey(doc?.key)) return
  const grant = permission(req)
  if (grant?.kind !== 'delete' || grant.id !== id) throw new APIError('Protocol storage is private.', 403)
}

/** Register only namespace guards on the generated native KV collection; its schema and denied CRUD stay unchanged. */
export function protectAuthActionProtocolStorage(payload: Payload) {
  const config = payload.collections['payload-kv']?.config
  if (!config) throw new Error('Auth-action protocol storage unavailable.')
  config.hooks.beforeChange = [...(config.hooks.beforeChange ?? []), guardChange]
  config.hooks.beforeDelete = [...(config.hooks.beforeDelete ?? []), guardDelete]
}

export function bindProtocolStorage(req: PayloadRequest, namespace: string) {
  if (!protectedKey(namespace) || !namespace.endsWith(':')) throw new Error('Auth-action protocol storage unavailable.')
  function scoped() {
    if (req.transactionID !== undefined) throw new Error('Auth-action protocol storage unavailable.')
    return createLocalReq({}, req.payload)
  }
  async function write<Result>(grant: Write, work: (internalReq: PayloadRequest) => Promise<Result>) {
    const internalReq = await scoped()
    const identity = Object.freeze({})
    writes.set(identity, grant)
    internalReq.context = { ...internalReq.context, authActionProtocolKV: identity }
    try {
      return await work(internalReq)
    } finally {
      writes.delete(identity)
    }
  }
  function keyInScope(key: string) {
    if (!key.startsWith(namespace)) throw new Error('Auth-action protocol storage unavailable.')
  }
  return {
    async read(key: string) {
      keyInScope(key)
      const internalReq = await scoped()
      const result = await req.payload.find({
        collection: 'payload-kv',
        req: internalReq,
        overrideAccess: true,
        depth: 0,
        pagination: false,
        limit: 1,
        where: { key: { equals: key } },
      })
      return result.docs[0] ?? null
    },
    async append(key: string, data: Record<string, unknown>) {
      keyInScope(key)
      return write({ kind: 'append', key, data }, (internalReq) =>
        req.payload.create({
          collection: 'payload-kv',
          req: internalReq,
          overrideAccess: true,
          depth: 0,
          data: { key, data },
        }),
      )
    },
    async remove(id: number) {
      const internalReq = await scoped()
      const record = await req.payload.findByID({
        collection: 'payload-kv',
        id,
        req: internalReq,
        overrideAccess: true,
        depth: 0,
        disableErrors: true,
      })
      if (!record) return
      keyInScope(record.key)
      await write({ kind: 'delete', id }, (internalReq) =>
        req.payload.delete({ collection: 'payload-kv', req: internalReq, overrideAccess: true, id }),
      )
    },
    async oldest(limit: number) {
      const internalReq = await scoped()
      const result = await req.payload.find({
        collection: 'payload-kv',
        req: internalReq,
        overrideAccess: true,
        depth: 0,
        pagination: false,
        limit,
        sort: 'id',
        where: { key: { like: namespace } },
      })
      return result.docs.filter((record) => record.key.startsWith(namespace))
    },
  }
}
