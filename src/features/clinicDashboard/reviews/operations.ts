import { APIError, type PayloadRequest, type Where } from 'payload'
import { z } from 'zod'
import type { ReviewAppeal, ReviewResponse } from '@/payload-types'
import { projectClinicReviewDetail, readClinicReviewDetail } from './service'
import { clinicReviewDetailIdSchema } from './contracts'

const listQuery = z
  .object({
    depth: z.literal('1').default('1'),
    limit: z.enum(['10', '100']).default('10'),
    page: z.coerce.number().int().positive().max(10_000).default(1),
    sort: z.literal('-reviewDate').default('-reviewDate'),
    'where[reviewDate][greater_than_equal]': z.iso.datetime({ offset: true }).optional(),
    'where[starRating][equals]': z.enum(['1', '2', '3', '4', '5']).optional(),
    'where[treatment][equals]': clinicReviewDetailIdSchema.optional(),
    'where[withdrawalState][equals]': z.enum(['active', 'withdrawn']).optional(),
    'where[publicMeasure][not_equals]': z.literal('removed').optional(),
    'where[publicMeasure][equals]': z.literal('removed').optional(),
    'where[publicMeasure][in]': z.literal('context,redaction,placeholder,removed').optional(),
  })
  .strict()
const workflowQuery = z
  .object({
    depth: z.literal('0'),
    limit: z.coerce.number().int().min(1).max(100),
    pagination: z.literal('false'),
    'where[review][in]': z.string().min(1).max(13_000),
  })
  .strict()
const versionsQuery = z
  .object({
    depth: z.literal('0'),
    limit: z.literal('1000'),
    pagination: z.literal('false'),
    sort: z.literal('-createdAt'),
    'where[version.review][equals]': clinicReviewDetailIdSchema,
  })
  .strict()
export const reviewResponseCreateInput = z
  .object({
    review: z.union([clinicReviewDetailIdSchema, z.number().int().positive()]),
    pendingResponse: z.object({ body: z.string().trim().min(10).max(2000) }).strict(),
  })
  .strict()
export const reviewResponseUpdateInput = reviewResponseCreateInput.omit({ review: true })
export const reviewAppealCreateInput = z
  .object({
    review: z.union([clinicReviewDetailIdSchema, z.number().int().positive()]),
    reason: z.enum(['incorrect_clinic', 'inappropriate_content', 'privacy_concern', 'other']),
    details: z.string().trim().min(10).max(2000),
  })
  .strict()

type WorkflowCollection = 'reviewResponses' | 'reviewAppeals'
const unavailable = () => new APIError('Review source is unavailable.', 404)
const invalid = () => new APIError('Invalid review request.', 400)
function query(req: PayloadRequest): Record<string, string> {
  const entries = [...new URL(req.url ?? 'http://localhost:3000').searchParams.entries()]
  if (new Set(entries.map(([key]) => key)).size !== entries.length) throw invalid()
  return Object.fromEntries(entries)
}
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value)
  if (!parsed.success) throw invalid()
  return parsed.data
}
function relation(value: unknown): string | null {
  if (typeof value === 'number' || typeof value === 'string') return String(value)
  return value && typeof value === 'object' && 'id' in value ? relation(value.id) : null
}
export function projectReviewWorkflow(collection: WorkflowCollection, doc: ReviewResponse | ReviewAppeal) {
  const review = relation(doc.review)
  if (!review) throw new Error('Review workflow source is missing.')
  if (collection === 'reviewResponses') {
    const response = doc as ReviewResponse
    return {
      id: String(response.id),
      review,
      moderationStatus: response.moderationStatus,
      moderatedAt: response.moderatedAt ?? null,
      pendingResponse: response.pendingResponse ?? null,
      publishedResponse: response.publishedResponse ?? null,
    }
  }
  const appeal = doc as ReviewAppeal
  return {
    id: String(appeal.id),
    review,
    createdAt: appeal.createdAt,
    status: appeal.status,
    reason: appeal.reason,
    details: appeal.details,
    decisionReason: appeal.decisionReason ?? null,
    decidedAt: appeal.decidedAt ?? null,
  }
}
export async function readClinicReviewPage(req: PayloadRequest, clinicId: string) {
  const input = parse(listQuery, query(req))
  const conditions: Where[] = [{ clinic: { equals: Number(clinicId) } }, { status: { equals: 'approved' } }]
  const terms = [
    ['where[reviewDate][greater_than_equal]', 'reviewDate', 'greater_than_equal'],
    ['where[starRating][equals]', 'starRating', 'equals'],
    ['where[treatment][equals]', 'treatment', 'equals'],
    ['where[withdrawalState][equals]', 'withdrawalState', 'equals'],
    ['where[publicMeasure][not_equals]', 'publicMeasure', 'not_equals'],
    ['where[publicMeasure][equals]', 'publicMeasure', 'equals'],
    ['where[publicMeasure][in]', 'publicMeasure', 'in'],
  ] as const
  for (const [key, field, operator] of terms) {
    const value = input[key]
    if (value !== undefined) conditions.push({ [field]: { [operator]: operator === 'in' ? value.split(',') : value } })
  }
  const result = await req.payload.find({
    collection: 'reviews',
    overrideAccess: false,
    req,
    depth: 1,
    limit: Number(input.limit),
    page: input.page,
    sort: input.sort,
    where: { and: conditions },
  })
  const docs = result.docs.map((review) => {
    if (relation(review.clinic) !== clinicId) throw unavailable()
    const projected = projectClinicReviewDetail(review)
    if (!projected) throw unavailable()
    return projected
  })
  return { docs, limit: result.limit, page: result.page, totalDocs: result.totalDocs, totalPages: result.totalPages }
}
export async function readClinicReviewWorkflows(req: PayloadRequest, clinicId: string, collection: WorkflowCollection) {
  const input = parse(workflowQuery, query(req))
  const ids = input['where[review][in]'].split(',')
  if (
    ids.length > 100 ||
    ids.some((id) => !clinicReviewDetailIdSchema.safeParse(id).success) ||
    new Set(ids).size !== ids.length
  )
    throw invalid()
  const reviews = await req.payload.find({
    collection: 'reviews',
    overrideAccess: false,
    req,
    depth: 0,
    pagination: false,
    limit: ids.length,
    where: { and: [{ id: { in: ids } }, { clinic: { equals: Number(clinicId) } }, { status: { equals: 'approved' } }] },
  })
  if (reviews.docs.length !== ids.length || reviews.docs.some((review) => relation(review.clinic) !== clinicId))
    throw unavailable()
  const result = await req.payload.find({
    collection,
    overrideAccess: false,
    req,
    depth: 0,
    pagination: false,
    limit: input.limit,
    where: { and: [{ review: { in: ids } }, { clinic: { equals: Number(clinicId) } }] },
  })
  return {
    docs: result.docs.map((doc) => {
      if (relation(doc.clinic) !== clinicId || !ids.includes(relation(doc.review) ?? '')) throw unavailable()
      return projectReviewWorkflow(collection, doc)
    }),
  }
}
export async function readClinicReviewWorkflowVersions(
  req: PayloadRequest,
  clinicId: string,
  collection: WorkflowCollection,
) {
  const input = parse(versionsQuery, query(req))
  const reviewId = input['where[version.review][equals]']
  if (!(await readClinicReviewDetail(req, reviewId, clinicId))) throw unavailable()
  const result = await req.payload.findVersions({
    collection,
    overrideAccess: false,
    req,
    depth: 0,
    limit: 1000,
    pagination: false,
    sort: '-createdAt',
    where: { and: [{ 'version.review': { equals: reviewId } }, { 'version.clinic': { equals: Number(clinicId) } }] },
  })
  return {
    docs: result.docs.map((doc) => {
      const version = doc.version
      if (relation(version.clinic) !== clinicId || relation(version.review) !== reviewId) throw unavailable()
      if (collection === 'reviewResponses') {
        const response = version as ReviewResponse
        return {
          id: String(doc.id),
          createdAt: doc.createdAt,
          version: {
            lastAction: response.lastAction,
            lastActorType: response.lastActorType,
            moderationStatus: response.moderationStatus,
            pendingResponse: response.pendingResponse ?? null,
            publishedResponse: response.publishedResponse ?? null,
          },
        }
      }
      const appeal = version as ReviewAppeal
      return {
        id: String(doc.id),
        createdAt: doc.createdAt,
        version: {
          lastAction: appeal.lastAction,
          lastActorType: appeal.lastActorType,
          status: appeal.status,
          decidedAt: appeal.decidedAt ?? null,
          decisionReason: appeal.decisionReason ?? null,
        },
      }
    }),
  }
}
export async function createClinicReviewWorkflow(
  req: PayloadRequest,
  clinicId: string,
  collection: WorkflowCollection,
  body: unknown,
) {
  const input =
    collection === 'reviewResponses' ? parse(reviewResponseCreateInput, body) : parse(reviewAppealCreateInput, body)
  if (!(await readClinicReviewDetail(req, String(input.review), clinicId))) throw unavailable()
  const doc = await req.payload.create({ collection, overrideAccess: false, req, depth: 0, data: input as never })
  if (relation(doc.clinic) !== clinicId || relation(doc.review) !== String(input.review)) throw unavailable()
  return { doc: projectReviewWorkflow(collection, doc) }
}
export async function updateClinicReviewResponse(
  req: PayloadRequest,
  clinicId: string,
  workflowId: string,
  body: unknown,
) {
  const input = parse(reviewResponseUpdateInput, body)
  const current = await req.payload.find({
    collection: 'reviewResponses',
    overrideAccess: false,
    req,
    depth: 0,
    pagination: false,
    limit: 1,
    where: { and: [{ id: { equals: workflowId } }, { clinic: { equals: Number(clinicId) } }] },
  })
  const response = current.docs[0]
  if (
    !response ||
    relation(response.clinic) !== clinicId ||
    !(await readClinicReviewDetail(req, relation(response.review) ?? '', clinicId))
  )
    throw unavailable()
  const doc = await req.payload.update({
    collection: 'reviewResponses',
    id: response.id,
    overrideAccess: false,
    req,
    depth: 0,
    data: input,
  })
  if (relation(doc.clinic) !== clinicId || relation(doc.review) !== relation(response.review)) throw unavailable()
  return { doc: projectReviewWorkflow('reviewResponses', doc) }
}
