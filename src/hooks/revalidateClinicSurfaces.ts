import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, PayloadRequest } from 'payload'

import {
  executeRevalidationPlan,
  planRevalidation,
  type ClinicSurfacePublicStatus,
  type ClinicSurfaceRevalidationCollection,
  type RevalidationLogger,
} from '@/utilities/cacheRevalidation'

type RelationId = string | number

type RevalidatableDoc = {
  readonly id?: RelationId
  readonly slug?: string | null
  readonly status?: string | null
  readonly clinic?: unknown
  readonly doctor?: unknown
}

type ClinicIdentity = {
  readonly id: RelationId
  readonly slug: string
}

const isClinicIdentity = (value: ClinicIdentity | null): value is ClinicIdentity => value !== null

const isRevalidationDisabled = (req: PayloadRequest): boolean =>
  Boolean(req.context.disableRevalidate || req.context.skipHooks)

const normalizeId = (value: unknown, label: string): RelationId => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) return value

  throw new Error(`Missing required ${label}`)
}

const normalizeOptionalId = (value: unknown): RelationId | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) return value

  return null
}

const normalizeSlug = (value: unknown, label: string): string => {
  if (typeof value === 'string' && value.trim()) return value

  throw new Error(`Missing required ${label}`)
}

const normalizeOptionalStatus = (value: unknown): ClinicSurfacePublicStatus | undefined =>
  typeof value === 'string' && value.trim() ? (value as ClinicSurfacePublicStatus) : undefined

const extractRelationId = (value: unknown): RelationId | null => {
  const directId = normalizeOptionalId(value)
  if (directId !== null) return directId

  if (value && typeof value === 'object' && 'id' in value) {
    return normalizeOptionalId((value as { id?: unknown }).id)
  }

  return null
}

const extractClinicIdentityFromRelation = (value: unknown): ClinicIdentity | null => {
  if (!value || typeof value !== 'object') return null

  const record = value as { id?: unknown; slug?: unknown; status?: unknown; deletedAt?: unknown }
  const id = normalizeOptionalId(record.id)
  const slug = typeof record.slug === 'string' ? record.slug.trim() : ''

  if (id === null || !slug || record.status !== 'approved' || record.deletedAt) {
    return null
  }

  return { id, slug }
}

const resolveClinicIdentity = async (req: PayloadRequest, value: unknown): Promise<ClinicIdentity | null> => {
  const embedded = extractClinicIdentityFromRelation(value)
  if (embedded) return embedded

  const id = extractRelationId(value)
  if (id === null) return null

  try {
    const clinic = (await req.payload.findByID({
      collection: 'clinics',
      id,
      depth: 0,
      overrideAccess: true,
      req,
      select: {
        id: true,
        slug: true,
        status: true,
        deletedAt: true,
      },
    })) as { id?: unknown; slug?: unknown; status?: unknown; deletedAt?: unknown } | null

    return extractClinicIdentityFromRelation(clinic)
  } catch {
    return null
  }
}

const resolveDoctorClinicIdentity = async (req: PayloadRequest, value: unknown): Promise<ClinicIdentity | null> => {
  if (value && typeof value === 'object' && 'clinic' in value) {
    const identity = await resolveClinicIdentity(req, (value as { clinic?: unknown }).clinic)
    if (identity) return identity
  }

  const doctorId = extractRelationId(value)
  if (doctorId === null) return null

  try {
    const doctor = (await req.payload.findByID({
      collection: 'doctors',
      id: doctorId,
      depth: 0,
      overrideAccess: true,
      req,
      select: {
        clinic: true,
      },
    })) as { clinic?: unknown } | null

    return resolveClinicIdentity(req, doctor?.clinic)
  } catch {
    return null
  }
}

const uniqueIdentities = (identities: readonly ClinicIdentity[]): ClinicIdentity[] => {
  const byId = new Map<string, ClinicIdentity>()

  for (const identity of identities) {
    byId.set(String(identity.id), identity)
  }

  return [...byId.values()]
}

const executePlan = (event: Parameters<typeof planRevalidation>[0], logger: RevalidationLogger): void => {
  const plan = planRevalidation(event)
  executeRevalidationPlan(plan, { logger })
}

const resolveClinicOperation = ({
  previousSlug,
  previousStatus,
  slug,
  status,
}: {
  readonly previousSlug?: string
  readonly previousStatus?: ClinicSurfacePublicStatus
  readonly slug: string
  readonly status: ClinicSurfacePublicStatus
}) => {
  if (status === 'approved' && previousStatus !== 'approved') return 'publish'
  if (status !== 'approved' && previousStatus === 'approved') return 'unpublish'
  if (status === 'approved' && previousStatus === 'approved' && previousSlug && previousSlug !== slug) {
    return 'slug-change'
  }

  return 'update'
}

export const revalidateClinicChange: CollectionAfterChangeHook = ({ doc, previousDoc, req }) => {
  if (isRevalidationDisabled(req)) return doc

  const current = doc as RevalidatableDoc
  const previous = previousDoc as RevalidatableDoc | undefined
  const id = normalizeId(current.id, 'clinic id')
  const slug = normalizeSlug(current.slug, 'clinic slug')
  const status = normalizeOptionalStatus(current.status)
  const previousStatus = normalizeOptionalStatus(previous?.status)
  const previousSlug = typeof previous?.slug === 'string' && previous.slug.trim() ? previous.slug : undefined

  if (!status) {
    throw new Error('Missing required clinic status')
  }

  executePlan(
    {
      kind: 'clinic-surface',
      collection: 'clinics',
      operation: resolveClinicOperation({ slug, status, previousSlug, previousStatus }),
      source: { kind: 'payload-hook', id: `clinics:${id}` },
      subject: {
        id,
        slug,
        ...(previousSlug ? { previousSlug } : {}),
        status,
        ...(previousStatus ? { previousStatus } : {}),
      },
    },
    req.payload.logger,
  )

  return doc
}

export const revalidateClinicDelete: CollectionAfterDeleteHook = ({ doc, req }) => {
  if (isRevalidationDisabled(req)) return doc

  const current = doc as RevalidatableDoc
  const id = normalizeId(current.id, 'clinic id')
  const slug = normalizeSlug(current.slug, 'clinic slug')
  const status = normalizeOptionalStatus(current.status)

  if (!status) {
    throw new Error('Missing required clinic status')
  }

  executePlan(
    {
      kind: 'clinic-surface',
      collection: 'clinics',
      operation: 'delete',
      source: { kind: 'payload-hook', id: `clinics:${id}` },
      subject: {
        id,
        slug,
        status,
        previousStatus: status,
      },
    },
    req.payload.logger,
  )

  return doc
}

const revalidateRelatedClinicSurface = async ({
  collection,
  currentClinics,
  doc,
  operation,
  previousClinics = [],
  req,
  status,
  previousStatus,
}: {
  readonly collection: ClinicSurfaceRevalidationCollection
  readonly currentClinics: readonly ClinicIdentity[]
  readonly doc: RevalidatableDoc
  readonly operation: 'delete' | 'related-update'
  readonly previousClinics?: readonly ClinicIdentity[]
  readonly req: PayloadRequest
  readonly status?: ClinicSurfacePublicStatus
  readonly previousStatus?: ClinicSurfacePublicStatus
}): Promise<RevalidatableDoc> => {
  if (isRevalidationDisabled(req)) return doc

  const id = normalizeId(doc.id, `${collection} id`)
  const current = uniqueIdentities(currentClinics)
  const previous = uniqueIdentities(previousClinics)

  executePlan(
    {
      kind: 'clinic-surface',
      collection,
      operation,
      source: { kind: 'payload-hook', id: `${collection}:${id}` },
      subject: {
        id,
        ...(status ? { status } : {}),
        ...(previousStatus ? { previousStatus } : {}),
        ...(current.length > 0 ? { clinicIds: current.map((clinic) => clinic.id) } : {}),
        ...(current.length > 0 ? { clinicSlugs: current.map((clinic) => clinic.slug) } : {}),
        ...(previous.length > 0 ? { previousClinicIds: previous.map((clinic) => clinic.id) } : {}),
        ...(previous.length > 0 ? { previousClinicSlugs: previous.map((clinic) => clinic.slug) } : {}),
      },
    },
    req.payload.logger,
  )

  return doc
}

export const revalidateClinicTreatmentChange: CollectionAfterChangeHook = async ({ doc, previousDoc, req }) => {
  if (isRevalidationDisabled(req)) return doc

  const current = doc as RevalidatableDoc
  const previous = previousDoc as RevalidatableDoc | undefined

  return revalidateRelatedClinicSurface({
    collection: 'clinictreatments',
    currentClinics: [await resolveClinicIdentity(req, current.clinic)].filter(isClinicIdentity),
    previousClinics: [await resolveClinicIdentity(req, previous?.clinic)].filter(isClinicIdentity),
    doc: current,
    operation: 'related-update',
    req,
  })
}

export const revalidateClinicTreatmentDelete: CollectionAfterDeleteHook = async ({ doc, req }) => {
  if (isRevalidationDisabled(req)) return doc

  return revalidateRelatedClinicSurface({
    collection: 'clinictreatments',
    currentClinics: [await resolveClinicIdentity(req, (doc as RevalidatableDoc).clinic)].filter(isClinicIdentity),
    doc: doc as RevalidatableDoc,
    operation: 'delete',
    req,
  })
}

export const revalidateDoctorChange: CollectionAfterChangeHook = async ({ doc, previousDoc, req }) => {
  if (isRevalidationDisabled(req)) return doc

  const current = doc as RevalidatableDoc
  const previous = previousDoc as RevalidatableDoc | undefined

  return revalidateRelatedClinicSurface({
    collection: 'doctors',
    currentClinics: [await resolveClinicIdentity(req, current.clinic)].filter(isClinicIdentity),
    previousClinics: [await resolveClinicIdentity(req, previous?.clinic)].filter(isClinicIdentity),
    doc: current,
    operation: 'related-update',
    req,
  })
}

export const revalidateDoctorDelete: CollectionAfterDeleteHook = async ({ doc, req }) => {
  if (isRevalidationDisabled(req)) return doc

  return revalidateRelatedClinicSurface({
    collection: 'doctors',
    currentClinics: [await resolveClinicIdentity(req, (doc as RevalidatableDoc).clinic)].filter(isClinicIdentity),
    doc: doc as RevalidatableDoc,
    operation: 'delete',
    req,
  })
}

export const revalidateDoctorSpecialtyChange: CollectionAfterChangeHook = async ({ doc, previousDoc, req }) => {
  if (isRevalidationDisabled(req)) return doc

  const current = doc as RevalidatableDoc
  const previous = previousDoc as RevalidatableDoc | undefined

  return revalidateRelatedClinicSurface({
    collection: 'doctorspecialties',
    currentClinics: [await resolveDoctorClinicIdentity(req, current.doctor)].filter(isClinicIdentity),
    previousClinics: [await resolveDoctorClinicIdentity(req, previous?.doctor)].filter(isClinicIdentity),
    doc: current,
    operation: 'related-update',
    req,
  })
}

export const revalidateDoctorSpecialtyDelete: CollectionAfterDeleteHook = async ({ doc, req }) => {
  if (isRevalidationDisabled(req)) return doc

  return revalidateRelatedClinicSurface({
    collection: 'doctorspecialties',
    currentClinics: [await resolveDoctorClinicIdentity(req, (doc as RevalidatableDoc).doctor)].filter(isClinicIdentity),
    doc: doc as RevalidatableDoc,
    operation: 'delete',
    req,
  })
}

export const revalidateReviewChange: CollectionAfterChangeHook = async ({ doc, previousDoc, req }) => {
  if (isRevalidationDisabled(req)) return doc

  const current = doc as RevalidatableDoc
  const previous = previousDoc as RevalidatableDoc | undefined

  return revalidateRelatedClinicSurface({
    collection: 'reviews',
    currentClinics: [await resolveClinicIdentity(req, current.clinic)].filter(isClinicIdentity),
    previousClinics: [await resolveClinicIdentity(req, previous?.clinic)].filter(isClinicIdentity),
    doc: current,
    operation: 'related-update',
    req,
    status: normalizeOptionalStatus(current.status),
    previousStatus: normalizeOptionalStatus(previous?.status),
  })
}

export const revalidateReviewDelete: CollectionAfterDeleteHook = async ({ doc, req }) => {
  if (isRevalidationDisabled(req)) return doc

  const current = doc as RevalidatableDoc

  return revalidateRelatedClinicSurface({
    collection: 'reviews',
    currentClinics: [await resolveClinicIdentity(req, current.clinic)].filter(isClinicIdentity),
    doc: current,
    operation: 'delete',
    req,
    status: normalizeOptionalStatus(current.status),
    previousStatus: normalizeOptionalStatus(current.status),
  })
}

const buildBroadCollectionHook =
  (collection: ClinicSurfaceRevalidationCollection): CollectionAfterChangeHook =>
  ({ doc, req }) => {
    if (isRevalidationDisabled(req)) return doc

    const id = normalizeId((doc as RevalidatableDoc).id, `${collection} id`)

    executePlan(
      {
        kind: 'clinic-surface',
        collection,
        operation: 'related-update',
        source: { kind: 'payload-hook', id: `${collection}:${id}` },
        subject: { id },
      },
      req.payload.logger,
    )

    return doc
  }

const buildBroadCollectionDeleteHook =
  (collection: ClinicSurfaceRevalidationCollection): CollectionAfterDeleteHook =>
  ({ doc, req }) => {
    if (isRevalidationDisabled(req)) return doc

    const id = normalizeId((doc as RevalidatableDoc).id, `${collection} id`)

    executePlan(
      {
        kind: 'clinic-surface',
        collection,
        operation: 'delete',
        source: { kind: 'payload-hook', id: `${collection}:${id}` },
        subject: { id },
      },
      req.payload.logger,
    )

    return doc
  }

export const revalidateTreatmentChange = buildBroadCollectionHook('treatments')
export const revalidateTreatmentDelete = buildBroadCollectionDeleteHook('treatments')
export const revalidateMedicalSpecialtyChange = buildBroadCollectionHook('medical-specialties')
export const revalidateMedicalSpecialtyDelete = buildBroadCollectionDeleteHook('medical-specialties')
export const revalidateCityChange = buildBroadCollectionHook('cities')
export const revalidateCityDelete = buildBroadCollectionDeleteHook('cities')
export const revalidateAccreditationChange = buildBroadCollectionHook('accreditation')
export const revalidateAccreditationDelete = buildBroadCollectionDeleteHook('accreditation')
