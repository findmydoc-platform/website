import type { FieldAccess, Where } from 'payload'

export const PUBLIC_REVIEW_MEASURES = ['none', 'context', 'redaction', 'placeholder'] as const
export const REVIEW_MEASURES = [...PUBLIC_REVIEW_MEASURES, 'removed'] as const

export type ReviewPublicMeasure = (typeof REVIEW_MEASURES)[number]
export type ReviewWithdrawalState = 'active' | 'withdrawn'

export const REVIEW_REDACTION_NOTICE =
  'Parts of this review were removed to protect legal rights or personal data. The remaining text is unchanged.'
export const REVIEW_PLACEHOLDER_NOTICE = 'This review was moderated. Its written content is not publicly available.'

type ReviewProjectionRecord = {
  id?: unknown
  status?: unknown
  deletedAt?: unknown
  clinic?: unknown
  doctor?: unknown
  treatment?: unknown
  reviewDate?: unknown
  starRating?: unknown
  comment?: unknown
  publicAuthorName?: unknown
  publicMeasure?: unknown
  publicComment?: unknown
  publicNotice?: unknown
  withdrawalState?: unknown
}

export type PublicReviewTextProjection =
  | {
      kind: 'text'
      text: string
      notice?: string
    }
  | {
      kind: 'placeholder'
      notice: string
    }

const normalizeText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

const relationId = (value: unknown): string | number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.length > 0) return value
  if (value && typeof value === 'object' && 'id' in value) {
    return relationId((value as { id?: unknown }).id)
  }
  return null
}

export const getReviewPublicMeasure = (review: ReviewProjectionRecord): ReviewPublicMeasure => {
  const measure = review.publicMeasure
  return REVIEW_MEASURES.includes(measure as ReviewPublicMeasure) ? (measure as ReviewPublicMeasure) : 'none'
}

export const getReviewWithdrawalState = (review: ReviewProjectionRecord): ReviewWithdrawalState =>
  review.withdrawalState === 'withdrawn' ? 'withdrawn' : 'active'

export const isReviewPubliclyVisible = (review: ReviewProjectionRecord): boolean =>
  review.status === 'approved' &&
  !normalizeText(review.deletedAt) &&
  getReviewWithdrawalState(review) === 'active' &&
  getReviewPublicMeasure(review) !== 'removed'

export const isReviewPubliclyCounted = isReviewPubliclyVisible

export const isReviewResponsePubliclyVisible = (review: ReviewProjectionRecord): boolean => {
  if (!isReviewPubliclyVisible(review)) return false
  return isVisibleReviewResponsePubliclyReadable(review)
}

export const isVisibleReviewResponsePubliclyReadable = (review: ReviewProjectionRecord): boolean => {
  const measure = getReviewPublicMeasure(review)
  return measure === 'none' || measure === 'context' || measure === 'redaction'
}

export const isRawReviewCommentPubliclyReadable = (review: ReviewProjectionRecord): boolean => {
  if (!isReviewPubliclyVisible(review)) return false
  const measure = getReviewPublicMeasure(review)
  return measure === 'none' || measure === 'context'
}

/** Use only after the caller has enforced `buildPublicReviewWhere`. */
export const projectVisiblePublicReviewText = (review: ReviewProjectionRecord): PublicReviewTextProjection | null => {
  const measure = getReviewPublicMeasure(review)
  if (measure === 'removed') return null
  if (measure === 'placeholder') {
    return { kind: 'placeholder', notice: REVIEW_PLACEHOLDER_NOTICE }
  }

  const text = normalizeText(measure === 'redaction' ? review.publicComment : review.comment)
  if (!text) return null

  if (measure === 'context') {
    const notice = normalizeText(review.publicNotice)
    return notice ? { kind: 'text', text, notice } : { kind: 'text', text }
  }

  if (measure === 'redaction') {
    return { kind: 'text', text, notice: REVIEW_REDACTION_NOTICE }
  }

  return { kind: 'text', text }
}

export const projectPublicReviewText = (review: ReviewProjectionRecord): PublicReviewTextProjection | null =>
  isReviewPubliclyVisible(review) ? projectVisiblePublicReviewText(review) : null

export const buildPublicReviewWhere = (...additionalConditions: Where[]): Where => ({
  and: [
    { status: { equals: 'approved' } },
    { deletedAt: { exists: false } },
    { withdrawalState: { equals: 'active' } },
    { publicMeasure: { in: [...PUBLIC_REVIEW_MEASURES] } },
    ...additionalConditions,
  ],
})

export const buildPublicReviewResponseParentConditions = (prefix = 'review'): Where[] => [
  { [`${prefix}.status`]: { equals: 'approved' } },
  { [`${prefix}.deletedAt`]: { exists: false } },
  { [`${prefix}.withdrawalState`]: { equals: 'active' } },
  { [`${prefix}.publicMeasure`]: { in: ['none', 'context', 'redaction'] } },
]

const readAccessRecord = (args: {
  data?: Partial<ReviewProjectionRecord>
  doc?: ReviewProjectionRecord
  siblingData?: Partial<ReviewProjectionRecord>
}): ReviewProjectionRecord => ({
  ...(args.doc ?? {}),
  ...(args.data ?? {}),
  ...(args.siblingData ?? {}),
})

export const publicReviewProjectionFieldReadAccess: FieldAccess = () => true

export const clinicReviewAuditFieldReadAccess: FieldAccess = ({ req }) =>
  Boolean(req.user && (req.user.collection === 'platformStaff' || req.user.collection === 'clinicStaff'))

export const rawReviewCommentFieldReadAccess: FieldAccess = (args) => {
  if (args.req.user?.collection === 'platformStaff') return true
  return isRawReviewCommentPubliclyReadable(readAccessRecord(args))
}

export type ReviewPublicCacheProjection = {
  visible: boolean
  clinicId: string | number | null
  doctorId: string | number | null
  treatmentId: string | number | null
  kind: 'hidden' | PublicReviewTextProjection['kind']
  text: string | null
  notice: string | null
  reviewDate: string | null
  starRating: number | null
  publicAuthorName: string | null
  responseVisible: boolean
}

export const createReviewPublicCacheProjection = (
  review: ReviewProjectionRecord | null | undefined,
): ReviewPublicCacheProjection => {
  if (!review || !isReviewPubliclyVisible(review)) {
    return {
      visible: false,
      clinicId: relationId(review?.clinic),
      doctorId: null,
      treatmentId: null,
      kind: 'hidden',
      text: null,
      notice: null,
      reviewDate: null,
      starRating: null,
      publicAuthorName: null,
      responseVisible: false,
    }
  }

  const textProjection = projectPublicReviewText(review)
  return {
    visible: true,
    clinicId: relationId(review.clinic),
    doctorId: relationId(review.doctor),
    treatmentId: relationId(review.treatment),
    kind: textProjection?.kind ?? 'hidden',
    text: textProjection?.kind === 'text' ? textProjection.text : null,
    notice: textProjection?.notice ?? null,
    reviewDate: normalizeText(review.reviewDate) || null,
    starRating: typeof review.starRating === 'number' && Number.isFinite(review.starRating) ? review.starRating : null,
    publicAuthorName: normalizeText(review.publicAuthorName) || null,
    responseVisible: isReviewResponsePubliclyVisible(review),
  }
}

export const hasSameReviewPublicCacheProjection = (
  current: ReviewProjectionRecord | null | undefined,
  previous: ReviewProjectionRecord | null | undefined,
): boolean =>
  JSON.stringify(createReviewPublicCacheProjection(current)) ===
  JSON.stringify(createReviewPublicCacheProjection(previous))
