import type { CollectionConfig, Payload, PayloadRequest } from 'payload'
import { vi } from 'vitest'
import { RecoveryRequestEvents } from '@/collections/RecoveryRequestEvents'
import { AuthActions } from '@/collections/AuthActions'
import { TransactionalEmailOutbox } from '@/collections/TransactionalEmailOutbox'
import { TransactionalEmailEvents } from '@/collections/TransactionalEmailEvents'
import { protectAuthActionProtocolStorage } from '@/auth/actions/protocol/storage'

type Document = Record<string, unknown>
type Options = {
  collection: string
  req: PayloadRequest
  id?: number
  data?: Document
  where?: Document
  limit?: number
  sort?: string
}
const collections: Record<string, CollectionConfig> = {
  authActions: AuthActions,
  recoveryRequestEvents: RecoveryRequestEvents,
  transactionalEmailOutbox: TransactionalEmailOutbox,
  transactionalEmailEvents: TransactionalEmailEvents,
}

function matches(doc: Document, where: Document): boolean {
  return Object.entries(where).every(([field, predicate]) => {
    if (field === 'and' || field === 'or') {
      const clauses = predicate as Document[]
      return field === 'and'
        ? clauses.every((clause) => matches(doc, clause))
        : clauses.some((clause) => matches(doc, clause))
    }
    const value = field
      .split('.')
      .reduce<unknown>((value, key) => (value && typeof value === 'object' ? Reflect.get(value, key) : undefined), doc)
    return Object.entries(predicate as Document).every(([operator, expected]) => {
      switch (operator) {
        case 'equals':
          return value === expected
        case 'like':
          return typeof value === 'string' && value.includes(String(expected))
        case 'in':
          return (expected as unknown[]).includes(value)
        case 'not_in':
          return !(expected as unknown[]).includes(value)
        case 'exists':
          return expected ? value != null : value == null
        case 'greater_than':
          return value != null && (value as string | number) > (expected as string | number)
        case 'greater_than_equal':
          return value != null && (value as string | number) >= (expected as string | number)
        case 'less_than':
          return value != null && (value as string | number) < (expected as string | number)
        case 'less_than_equal':
          return value != null && (value as string | number) <= (expected as string | number)
        default:
          throw new Error(`Unsupported database predicate: ${operator}`)
      }
    })
  })
}

/** Offline Local API adapter. Production collection hooks still authorize and validate every operation. */
export function createEmailCommandStorage() {
  const collectionConfigs: Record<string, CollectionConfig> = {
    ...collections,
    'payload-kv': { slug: 'payload-kv', fields: [], hooks: {} },
  }
  const rows: Record<string, Map<number, Document>> = Object.fromEntries(
    [...Object.keys(collectionConfigs), 'patients', 'clinicStaff', 'platformStaff'].map((slug) => [slug, new Map()]),
  )
  const sessions: Record<string, object> = {}
  const snapshots = new Map<string, typeof rows>()
  let transaction = 0
  let id = 0
  const db = {
    sessions,
    async beginTransaction() {
      const key = String(++transaction)
      sessions[key] = {}
      snapshots.set(key, structuredClone(rows))
      return key
    },
    async commitTransaction(key: string) {
      delete sessions[key]
      snapshots.delete(key)
    },
    async rollbackTransaction(key: string) {
      const snapshot = snapshots.get(key)
      if (snapshot) for (const slug of Object.keys(rows)) rows[slug] = snapshot[slug]!
      delete sessions[key]
      snapshots.delete(key)
    },
  }
  async function guard(operation: string, options: Options) {
    const collection = collectionConfigs[options.collection]
    for (const hook of collection?.hooks?.beforeOperation ?? [])
      await hook({ operation, collection, args: options, req: options.req } as never)
  }
  async function read(doc: Document, options: Options) {
    let result = structuredClone(doc)
    for (const hook of collectionConfigs[options.collection]?.hooks?.afterRead ?? [])
      result = await hook({ doc: result, req: options.req } as never)
    return result
  }
  async function write(operation: 'create' | 'update', options: Options) {
    await guard(operation, options)
    const originalDoc = options.id ? rows[options.collection]!.get(options.id) : undefined
    let data = structuredClone(options.data!)
    for (const hook of collectionConfigs[options.collection]?.hooks?.beforeChange ?? [])
      data = await hook({ data, originalDoc, operation, req: options.req } as never)
    if (
      operation === 'create' &&
      options.collection === 'payload-kv' &&
      [...rows['payload-kv']!.values()].some((row) => row.key === data.key)
    )
      throw new Error('Unique KV key conflict.')
    const timestamp = new Date().toISOString()
    const doc = {
      ...(options.collection === 'transactionalEmailOutbox' ? { attemptCount: 0 } : {}),
      createdAt: timestamp,
      ...originalDoc,
      ...data,
      id: options.id ?? ++id,
      updatedAt: timestamp,
    }
    rows[options.collection]!.set(doc.id, doc)
    return read(doc, options)
  }
  const payload = {
    collections: Object.fromEntries(Object.entries(collectionConfigs).map(([slug, config]) => [slug, { config }])),
    db,
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    create: vi.fn((options: Options) => write('create', options)),
    update: vi.fn((options: Options) => write('update', options)),
    findByID: vi.fn(async (options: Options) => {
      await guard('read', options)
      const doc = rows[options.collection]!.get(options.id!)
      return doc ? read(doc, options) : null
    }),
    find: vi.fn(async (options: Options) => {
      await guard('read', options)
      const docs = [...rows[options.collection]!.values()].filter((doc) => matches(doc, options.where ?? {}))
      docs.sort((a, b) =>
        options.sort === '-createdAt'
          ? String(b.createdAt).localeCompare(String(a.createdAt))
          : options.sort === '-id'
            ? Number(b.id) - Number(a.id)
            : Number(a.id) - Number(b.id),
      )
      return { docs: await Promise.all(docs.slice(0, options.limit ?? docs.length).map((doc) => read(doc, options))) }
    }),
    delete: vi.fn(async (options: Options) => {
      await guard('delete', options)
      for (const hook of collectionConfigs[options.collection]?.hooks?.beforeDelete ?? [])
        await hook({ id: options.id, req: options.req } as never)
      rows[options.collection]!.delete(options.id!)
    }),
  } as unknown as Payload
  protectAuthActionProtocolStorage(payload)
  return { payload, rows, req: { payload, context: {}, user: null } as PayloadRequest }
}
