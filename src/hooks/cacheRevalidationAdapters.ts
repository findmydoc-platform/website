import {
  executeRevalidationPlan,
  planRevalidation,
  type CoreCollectionRevalidationCollection,
  type CoreGlobalRevalidationSlug,
  type PublicDocumentStatus,
  type RevalidationLogger,
} from '@/utilities/cacheRevalidation'

type RevalidatableCollectionDoc = {
  readonly id?: string | number
  readonly slug?: string | null
  readonly _status?: string | null
}

type RevalidatableRedirectDoc = {
  readonly id?: string | number
}

const normalizeStatus = (value: string | null | undefined, label: string): PublicDocumentStatus => {
  if (value === 'draft' || value === 'published') {
    return value
  }

  throw new Error(`Missing required ${label}`)
}

const normalizeId = (value: string | number | undefined, label: string): string | number => {
  if (typeof value === 'number' || (typeof value === 'string' && value.trim())) {
    return value
  }

  throw new Error(`Missing required ${label}`)
}

const normalizeSlug = (value: string | null | undefined, label: string): string => {
  if (typeof value === 'string' && value.trim()) {
    return value
  }

  throw new Error(`Missing required ${label}`)
}

const normalizePreviousStatus = (value: string | null | undefined): PublicDocumentStatus | undefined => {
  if (typeof value === 'undefined' || value === null) {
    return undefined
  }

  return normalizeStatus(value, 'previous status')
}

const normalizePreviousSlug = (
  previousDoc: RevalidatableCollectionDoc | undefined,
  previousStatus: PublicDocumentStatus | undefined,
): string | undefined => {
  if (!previousDoc) return undefined

  if (previousStatus === 'published') {
    return normalizeSlug(previousDoc.slug, 'previous slug')
  }

  if (typeof previousDoc.slug === 'string' && previousDoc.slug.trim()) {
    return previousDoc.slug
  }

  return undefined
}

const resolveChangeSlug = ({
  currentSlug,
  currentStatus,
  previousSlug,
  previousStatus,
}: {
  readonly currentSlug: string | null | undefined
  readonly currentStatus: PublicDocumentStatus
  readonly previousSlug?: string
  readonly previousStatus?: PublicDocumentStatus
}): string | undefined => {
  if (typeof currentSlug === 'string' && currentSlug.trim()) {
    return currentSlug
  }

  if (currentStatus === 'draft' && previousStatus !== 'published') {
    return undefined
  }

  if (currentStatus === 'draft' && previousSlug) {
    return previousSlug
  }

  return normalizeSlug(currentSlug, 'document slug')
}

const resolveCollectionOperation = ({
  slug,
  status,
  previousSlug,
  previousStatus,
}: {
  readonly slug: string
  readonly status: PublicDocumentStatus
  readonly previousSlug?: string
  readonly previousStatus?: PublicDocumentStatus
}) => {
  if (status === 'published' && previousStatus !== 'published') {
    return 'publish'
  }

  if (status !== 'published' && previousStatus === 'published') {
    return 'unpublish'
  }

  if (status === 'published' && previousStatus === 'published' && previousSlug && previousSlug !== slug) {
    return 'slug-change'
  }

  return 'update'
}

const executePlan = (event: Parameters<typeof planRevalidation>[0], logger: RevalidationLogger): void => {
  const plan = planRevalidation(event)
  executeRevalidationPlan(plan, { logger })
}

export const executeCollectionChangeRevalidation = ({
  collection,
  doc,
  logger,
  previousDoc,
}: {
  readonly collection: CoreCollectionRevalidationCollection
  readonly doc: RevalidatableCollectionDoc
  readonly logger: RevalidationLogger
  readonly previousDoc?: RevalidatableCollectionDoc
}): void => {
  const id = normalizeId(doc.id, 'document id')
  const status = normalizeStatus(doc._status, 'document status')
  const previousStatus = normalizePreviousStatus(previousDoc?._status)
  const previousSlug = normalizePreviousSlug(previousDoc, previousStatus)
  const slug = resolveChangeSlug({
    currentSlug: doc.slug,
    currentStatus: status,
    previousSlug,
    previousStatus,
  })

  // Payload autosaves new drafts before a slug exists. They cannot affect public output.
  if (!slug) return

  executePlan(
    {
      kind: 'collection',
      collection,
      operation: resolveCollectionOperation({ slug, status, previousSlug, previousStatus }),
      source: {
        kind: 'payload-hook',
        id: `${collection}:${id}`,
      },
      subject: {
        id,
        slug,
        ...(previousSlug ? { previousSlug } : {}),
        status,
        ...(previousStatus ? { previousStatus } : {}),
      },
    },
    logger,
  )
}

export const executeCollectionDeleteRevalidation = ({
  collection,
  doc,
  logger,
}: {
  readonly collection: CoreCollectionRevalidationCollection
  readonly doc: RevalidatableCollectionDoc
  readonly logger: RevalidationLogger
}): void => {
  const id = normalizeId(doc.id, 'document id')
  const slug = normalizeSlug(doc.slug, 'document slug')
  const status = normalizeStatus(doc._status, 'document status')

  executePlan(
    {
      kind: 'collection',
      collection,
      operation: 'delete',
      source: {
        kind: 'payload-hook',
        id: `${collection}:${id}`,
      },
      subject: {
        id,
        slug,
        status,
        previousStatus: status,
      },
    },
    logger,
  )
}

export const executeGlobalChangeRevalidation = ({
  global,
  logger,
}: {
  readonly global: CoreGlobalRevalidationSlug
  readonly logger: RevalidationLogger
}): void => {
  executePlan(
    {
      kind: 'global',
      global,
      operation: 'global-update',
      source: {
        kind: 'global-hook',
        id: global,
      },
    },
    logger,
  )
}

export const executeRedirectChangeRevalidation = ({
  doc,
  logger,
}: {
  readonly doc: RevalidatableRedirectDoc
  readonly logger: RevalidationLogger
}): void => {
  const id = normalizeId(doc.id, 'redirect id')

  executePlan(
    {
      kind: 'redirects',
      operation: 'update',
      source: {
        kind: 'redirect-hook',
        id: `redirects:${id}`,
      },
      subject: {
        id,
      },
    },
    logger,
  )
}
