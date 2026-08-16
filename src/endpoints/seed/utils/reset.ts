import fs from 'node:fs'
import path from 'node:path'
import type { CollectionSlug, Payload, PayloadRequest, Where } from 'payload'
import { resolveSeedRuntimeEnv } from './runtime'
import { resolveSeedRuntimePolicy } from '@/features/runtimePolicy'
import { baselinePlan, demoPlan } from './plan'
import { loadSeedFile, loadSeedGlobals, type SeedKind, type SeedRecord } from './load-json'

const demoResetOrder: CollectionSlug[] = [
  'reviewAppeals',
  'reviewResponses',
  'reviews',
  'patientClinicInquiries',
  'favoriteclinics',
  'doctortreatments',
  'doctorspecialties',
  'clinictreatments',
  'clinicProfileDrafts',
  'clinicMedia',
  'doctorMedia',
  'doctors',
  'clinics',
  'posts',
  'userProfileMedia',
  'platformContentMedia',
]

const baselineResetOrder: CollectionSlug[] = [
  'treatments',
  'categories',
  'tags',
  'accreditation',
  'medical-specialties',
  'cities',
  'countries',
]

const protectedPrincipalCollections = ['platformStaff', 'clinicStaff', 'patients'] as const
type ProtectedPrincipalCollection = (typeof protectedPrincipalCollections)[number]

type ProtectedRelationSpec = {
  collection: ProtectedPrincipalCollection
  field: 'clinic' | 'country' | 'profileImage'
  kinds: readonly SeedKind[]
  relationTo: CollectionSlug
}

const protectedRelationSpecs: ProtectedRelationSpec[] = [
  {
    collection: 'platformStaff',
    field: 'profileImage',
    kinds: ['baseline', 'demo'],
    relationTo: 'userProfileMedia',
  },
  {
    collection: 'clinicStaff',
    field: 'profileImage',
    kinds: ['baseline', 'demo'],
    relationTo: 'userProfileMedia',
  },
  { collection: 'clinicStaff', field: 'clinic', kinds: ['baseline', 'demo'], relationTo: 'clinics' },
  { collection: 'patients', field: 'profileImage', kinds: ['baseline', 'demo'], relationTo: 'userProfileMedia' },
  { collection: 'patients', field: 'country', kinds: ['baseline'], relationTo: 'countries' },
]

const seedResetContext = {
  disableRevalidate: true,
  seedReset: true,
  skipClinicStaffAuthSync: true,
}

type ResetCollectionsOptions = {
  onPrepared?: (result: ResetCollectionsResult) => Promise<void> | void
  req?: Partial<PayloadRequest>
}

type ResetCollectionsResult = {
  affectedPostSlugs: string[]
}

type SeedInputMap = Map<string, SeedRecord[]>

type PlannedUserUpdate = {
  collection: ProtectedPrincipalCollection
  data: Record<string, null>
  id: number | string
}

const allDocumentsWhere: Where = {
  id: {
    exists: true,
  },
}

const buildResetRequest = (payload: Payload, req: Partial<PayloadRequest> | undefined): Partial<PayloadRequest> => ({
  ...(req ?? {}),
  payload,
  context: {
    ...((req?.context as Record<string, unknown> | undefined) ?? {}),
    ...seedResetContext,
  },
})

const collectPostSlugsBeforeReset = async (payload: Payload): Promise<string[]> => {
  const posts = await payload.find({
    collection: 'posts',
    depth: 0,
    overrideAccess: true,
    pagination: false,
    select: {
      slug: true,
    },
    trash: true,
  })

  return [
    ...new Set(
      posts.docs
        .map((post) => post.slug)
        .filter((slug): slug is string => typeof slug === 'string' && slug.trim().length > 0)
        .map((slug) => slug.trim()),
    ),
  ].sort()
}

const assertProtectedRelationIsNullable = (payload: Payload, spec: ProtectedRelationSpec): void => {
  const collection = payload.config.collections.find((candidate) => candidate.slug === spec.collection)
  if (!collection) {
    throw new Error(`Seed reset preflight failed: collection ${spec.collection} is not configured`)
  }

  const field = collection.fields.find((candidate) => {
    return 'name' in candidate && candidate.name === spec.field
  }) as undefined | { relationTo?: unknown; required?: unknown; type?: unknown }

  if (!field || (field.type !== 'relationship' && field.type !== 'upload')) {
    throw new Error(`Seed reset preflight failed: ${spec.collection}.${spec.field} is not a relation`)
  }

  const relationTargets = Array.isArray(field.relationTo) ? field.relationTo : [field.relationTo]
  if (!relationTargets.includes(spec.relationTo)) {
    throw new Error(
      `Seed reset preflight failed: ${spec.collection}.${spec.field} does not reference ${spec.relationTo}`,
    )
  }

  if (field.required === true) {
    throw new Error(`Seed reset preflight failed: ${spec.collection}.${spec.field} cannot be cleared safely`)
  }
}

const preflightSeedInputs = async (kind: SeedKind): Promise<SeedInputMap> => {
  const plan = kind === 'baseline' ? baselinePlan : demoPlan
  const inputs: SeedInputMap = new Map()

  if (kind === 'baseline') {
    await loadSeedGlobals()
  }

  for (const step of plan) {
    if (step.kind !== 'collection' || inputs.has(step.fileName)) continue

    const records = await loadSeedFile(kind, step.fileName)
    for (const record of records) {
      if (typeof record.filePath !== 'string' || record.filePath.trim().length === 0) continue

      const assetPath = path.isAbsolute(record.filePath)
        ? record.filePath
        : path.resolve(process.cwd(), record.filePath)

      if (!fs.existsSync(assetPath) || !fs.statSync(assetPath).isFile()) {
        throw new Error(`Seed reset preflight failed: asset not found for ${kind}/${step.fileName}:${record.stableId}`)
      }
    }

    inputs.set(step.fileName, records)
  }

  return inputs
}

const planProtectedUserRelationCleanup = async (payload: Payload, kind: SeedKind): Promise<PlannedUserUpdate[]> => {
  const updates = new Map<string, PlannedUserUpdate>()

  for (const spec of protectedRelationSpecs) {
    if (!spec.kinds.includes(kind)) continue

    assertProtectedRelationIsNullable(payload, spec)

    const result = await payload.find({
      collection: spec.collection,
      depth: 0,
      overrideAccess: true,
      pagination: false,
      where: {
        [spec.field]: {
          exists: true,
        },
      },
    })

    for (const doc of result.docs) {
      if (typeof doc.id !== 'string' && typeof doc.id !== 'number') {
        throw new Error(`Seed reset preflight failed: ${spec.collection}.${spec.field} has an invalid document id`)
      }

      const key = `${spec.collection}:${String(doc.id)}`
      const current = updates.get(key) ?? {
        collection: spec.collection,
        data: {},
        id: doc.id,
      }
      current.data[spec.field] = null
      updates.set(key, current)
    }
  }

  return [...updates.values()]
}

const clearProtectedUserRelations = async (
  payload: Payload,
  updates: PlannedUserUpdate[],
  req: Partial<PayloadRequest>,
): Promise<void> => {
  for (const update of updates) {
    payload.logger.info(`Clearing resettable relations on preserved ${update.collection}:${String(update.id)}`)
    await payload.update({
      collection: update.collection,
      id: update.id,
      data: update.data,
      depth: 0,
      overrideAccess: true,
      context: req.context,
      req,
    })
  }
}

const buildResetWhere = (collection: CollectionSlug, kind: SeedKind, inputs: SeedInputMap): Where => {
  if (collection !== 'platformContentMedia' || kind === 'baseline') {
    return allDocumentsWhere
  }

  const stableIds = (inputs.get('platformContentMedia') ?? []).map((record) => record.stableId)
  if (stableIds.length === 0) {
    throw new Error('Seed reset preflight failed: demo platform content media ids are unavailable')
  }

  return {
    stableId: {
      in: stableIds,
    },
  }
}

const deleteCollection = async (
  payload: Payload,
  collection: CollectionSlug,
  where: Where,
  req: Partial<PayloadRequest>,
): Promise<void> => {
  const result = await payload.delete({
    collection,
    where,
    // Payload bulk deletes run document lifecycle work in parallel. A shared transaction
    // would make those operations compete for the same PostgreSQL client.
    disableTransaction: true,
    depth: 0,
    overrideAccess: true,
    trash: true,
    context: req.context,
    req,
  })

  if (result.errors.length > 0) {
    const messages = result.errors.map((error) => `${String(error.id)}: ${error.message}`).join('; ')
    throw new Error(`Seed reset failed while deleting ${collection}: ${messages}`)
  }
}

export async function resetCollections(
  payload: Payload,
  kind: SeedKind,
  options: ResetCollectionsOptions = {},
): Promise<ResetCollectionsResult> {
  const runtimeEnv = resolveSeedRuntimeEnv(undefined, process.env)
  const policy = resolveSeedRuntimePolicy(runtimeEnv)

  if (kind === 'demo' && !policy.allowDemo) {
    throw new Error('Demo reset is disabled in production runtime')
  }

  if (kind === 'baseline' && !policy.allowBaseline) {
    throw new Error('Baseline reset is disabled in this runtime')
  }

  if (!policy.allowReset) {
    throw new Error('Seed reset is disabled in this runtime')
  }

  const resetOrder = kind === 'demo' ? demoResetOrder : [...demoResetOrder, ...baselineResetOrder]
  const protectedCollectionsInReset = resetOrder.filter((collection) =>
    protectedPrincipalCollections.includes(collection as ProtectedPrincipalCollection),
  )
  if (protectedCollectionsInReset.length > 0) {
    throw new Error(`Seed reset preflight failed: protected principal collection scheduled for deletion`)
  }

  const inputs = await preflightSeedInputs(kind)
  const plannedUserUpdates = await planProtectedUserRelationCleanup(payload, kind)
  const affectedPostSlugs = await collectPostSlugsBeforeReset(payload)
  const req = buildResetRequest(payload, options.req)
  const result = { affectedPostSlugs }

  await options.onPrepared?.(result)

  await clearProtectedUserRelations(payload, plannedUserUpdates, req)

  for (const collection of resetOrder) {
    payload.logger.info(`Resetting ${collection} (${kind})`)
    await deleteCollection(payload, collection, buildResetWhere(collection, kind, inputs), req)
  }

  return result
}
