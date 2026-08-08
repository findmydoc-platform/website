import { beforeEach, describe, expect, it, vi } from 'vitest'
import { revalidatePath, revalidateTag } from 'next/cache'
import type { PayloadRequest } from 'payload'

import {
  revalidateClinicTreatmentChange,
  revalidateMedicalSpecialtyChange,
  revalidateReviewResponseChange,
  revalidateReviewChange,
} from '@/hooks/revalidateClinicSurfaces'
import { createMockReq } from '../helpers/testHelpers'

const buildReq = (context: Record<string, unknown> = {}): PayloadRequest => {
  const req = createMockReq(null, undefined, {
    context,
  })
  type FindByIDResult = Awaited<ReturnType<typeof req.payload.findByID>>
  const approvedClinic = (id: number, slug: string): FindByIDResult =>
    ({ id, slug, status: 'approved' }) as unknown as FindByIDResult

  vi.mocked(req.payload.findByID).mockImplementation(async ({ collection, id }) => {
    if (collection === 'clinics' && id === 12) {
      return approvedClinic(12, 'berlin-health')
    }
    if (collection === 'clinics' && id === 13) {
      return approvedClinic(13, 'munich-care')
    }

    throw new Error(`Unexpected ${collection} lookup for ${id}`)
  })

  return req
}

const getPathCalls = () => vi.mocked(revalidatePath).mock.calls.map(([path]) => path)
const getTagCalls = () => vi.mocked(revalidateTag).mock.calls.map(([tag]) => tag)

type ClinicTreatmentChangeArgs = Parameters<typeof revalidateClinicTreatmentChange>[0]
type ReviewResponseChangeArgs = Parameters<typeof revalidateReviewResponseChange>[0]
type ReviewChangeArgs = Parameters<typeof revalidateReviewChange>[0]
type MedicalSpecialtyChangeArgs = Parameters<typeof revalidateMedicalSpecialtyChange>[0]

describe('clinic related collection revalidation hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('revalidates exact current and previous clinic paths for clinic treatment relation changes', async () => {
    const req = buildReq()
    const doc = { id: 200, clinic: 12 }
    const previousDoc = { id: 200, clinic: 13 }

    await revalidateClinicTreatmentChange({
      collection: { slug: 'clinictreatments' } as unknown as ClinicTreatmentChangeArgs['collection'],
      context: req.context,
      data: {},
      doc,
      operation: 'update',
      previousDoc,
      req,
    } as ClinicTreatmentChangeArgs)

    expect(getPathCalls()).toEqual(['/clinics/berlin-health', '/clinics/munich-care'])
    expect(getTagCalls()).toEqual([
      'entity:clinictreatments:200',
      'collection:clinictreatments',
      'surface:clinic-detail',
      'surface:clinic-detail:12',
      'surface:clinic-detail:13',
      'slug:clinics:berlin-health',
      'slug:clinics:munich-care',
      'surface:listing-comparison',
      'surface:sitemap:pages',
    ])
  })

  it('revalidates the owning clinic and listing when a clinic treatment activation changes', async () => {
    const req = buildReq()

    await revalidateClinicTreatmentChange({
      collection: { slug: 'clinictreatments' } as unknown as ClinicTreatmentChangeArgs['collection'],
      context: req.context,
      data: { active: true },
      doc: { id: 201, active: true, clinic: 12 },
      operation: 'update',
      previousDoc: { id: 201, active: false, clinic: 12 },
      req,
    } as ClinicTreatmentChangeArgs)

    expect(getPathCalls()).toEqual(['/clinics/berlin-health'])
    expect(getTagCalls()).toEqual(
      expect.arrayContaining([
        'entity:clinictreatments:201',
        'collection:clinictreatments',
        'surface:clinic-detail:12',
        'surface:listing-comparison',
      ]),
    )
  })

  it('skips duplicate review revalidation for hook-triggered average updates before relation reads', async () => {
    const req = buildReq({ skipHooks: true })

    await revalidateReviewChange({
      collection: { slug: 'reviews' } as unknown as ReviewChangeArgs['collection'],
      context: req.context,
      data: {},
      doc: { id: 300, clinic: 12, status: 'approved' },
      operation: 'update',
      previousDoc: undefined,
      req,
    } as ReviewChangeArgs)

    expect(req.payload.findByID).not.toHaveBeenCalled()
    expect(getPathCalls()).toEqual([])
    expect(getTagCalls()).toEqual([])
  })

  it.each([
    {
      label: 'public measure',
      doc: { publicMeasure: 'placeholder', withdrawalState: 'active' },
      previous: { publicMeasure: 'none', withdrawalState: 'active' },
    },
    {
      label: 'author withdrawal',
      doc: { publicMeasure: 'none', withdrawalState: 'withdrawn' },
      previous: { publicMeasure: 'none', withdrawalState: 'active' },
    },
  ])('revalidates existing clinic and listing tags when $label changes public output', async ({ doc, previous }) => {
    const req = buildReq()
    const publicFields = {
      id: 302,
      clinic: 12,
      status: 'approved',
      reviewDate: '2026-08-08T10:00:00.000Z',
      starRating: 5,
      comment: 'Visible review text',
      publicAuthorName: 'Maya K.',
    }

    await revalidateReviewChange({
      collection: { slug: 'reviews' } as unknown as ReviewChangeArgs['collection'],
      context: req.context,
      data: {},
      doc: { ...publicFields, ...doc },
      operation: 'update',
      previousDoc: { ...publicFields, ...previous },
      req,
    } as ReviewChangeArgs)

    expect(getPathCalls()).toEqual(['/clinics/berlin-health'])
    expect(getTagCalls()).toEqual(
      expect.arrayContaining([
        'entity:reviews:302',
        'collection:reviews',
        'surface:clinic-detail:12',
        'surface:listing-comparison',
        'surface:sitemap:pages',
      ]),
    )
  })

  it('does not revalidate public caches for internal moderation-reason-only changes', async () => {
    const req = buildReq()
    const publicFields = {
      id: 303,
      clinic: 12,
      status: 'approved',
      publicMeasure: 'context',
      publicNotice: 'Visible factual context.',
      withdrawalState: 'active',
      reviewDate: '2026-08-08T10:00:00.000Z',
      starRating: 5,
      comment: 'Visible review text',
    }

    await revalidateReviewChange({
      collection: { slug: 'reviews' } as unknown as ReviewChangeArgs['collection'],
      context: req.context,
      data: {},
      doc: { ...publicFields, moderationReason: 'New internal reason' },
      operation: 'update',
      previousDoc: { ...publicFields, moderationReason: 'Old internal reason' },
      req,
    } as ReviewChangeArgs)

    expect(req.payload.findByID).not.toHaveBeenCalled()
    expect(getPathCalls()).toEqual([])
    expect(getTagCalls()).toEqual([])
  })

  it.each([
    { field: 'doctor', current: 42, previous: 41 },
    { field: 'treatment', current: 52, previous: 51 },
  ])(
    'revalidates public caches when a visible review changes its $field relation',
    async ({ field, current, previous }) => {
      const req = buildReq()
      const publicFields = {
        id: 305,
        clinic: 12,
        doctor: 41,
        treatment: 51,
        status: 'approved',
        publicMeasure: 'none',
        withdrawalState: 'active',
        reviewDate: '2026-08-08T10:00:00.000Z',
        starRating: 5,
        comment: 'Visible review text',
      }

      await revalidateReviewChange({
        collection: { slug: 'reviews' } as unknown as ReviewChangeArgs['collection'],
        context: req.context,
        data: {},
        doc: { ...publicFields, [field]: current },
        operation: 'update',
        previousDoc: { ...publicFields, [field]: previous },
        req,
      } as ReviewChangeArgs)

      expect(getPathCalls()).toEqual(['/clinics/berlin-health'])
      expect(getTagCalls()).toEqual(
        expect.arrayContaining([
          'entity:reviews:305',
          'collection:reviews',
          'surface:clinic-detail:12',
          'surface:listing-comparison',
        ]),
      )
    },
  )

  it.each([
    {
      label: 'soft-deleted',
      currentDeletedAt: '2026-08-08T11:00:00.000Z',
      previousDeletedAt: undefined,
    },
    {
      label: 'restored',
      currentDeletedAt: undefined,
      previousDeletedAt: '2026-08-08T11:00:00.000Z',
    },
  ])('revalidates public caches when a review is $label', async ({ currentDeletedAt, previousDeletedAt }) => {
    const req = buildReq()
    const publicFields = {
      id: 304,
      clinic: 12,
      status: 'approved',
      publicMeasure: 'none',
      withdrawalState: 'active',
      reviewDate: '2026-08-08T10:00:00.000Z',
      starRating: 5,
      comment: 'Visible review text',
    }

    await revalidateReviewChange({
      collection: { slug: 'reviews' } as unknown as ReviewChangeArgs['collection'],
      context: req.context,
      data: {},
      doc: { ...publicFields, deletedAt: currentDeletedAt },
      operation: 'update',
      previousDoc: { ...publicFields, deletedAt: previousDeletedAt },
      req,
    } as ReviewChangeArgs)

    expect(getPathCalls()).toEqual(['/clinics/berlin-health'])
    expect(getTagCalls()).toEqual(
      expect.arrayContaining(['entity:reviews:304', 'collection:reviews', 'surface:clinic-detail:12']),
    )
  })

  it('keeps pending and rejected response revisions private when the public response is unchanged', async () => {
    const req = buildReq()
    const publishedResponse = {
      approvedAt: '2026-07-29T10:00:00.000Z',
      body: 'Thank you for sharing your experience with our clinic.',
      isBlocked: false,
    }

    await revalidateReviewResponseChange({
      collection: { slug: 'reviewResponses' } as unknown as ReviewResponseChangeArgs['collection'],
      context: req.context,
      data: {},
      doc: {
        id: 400,
        clinic: 12,
        moderationStatus: 'rejected',
        publishedResponse,
      },
      operation: 'update',
      previousDoc: {
        id: 400,
        clinic: 12,
        moderationStatus: 'pending',
        publishedResponse,
      },
      req,
    } as ReviewResponseChangeArgs)

    expect(req.payload.findByID).not.toHaveBeenCalled()
    expect(getPathCalls()).toEqual([])
    expect(getTagCalls()).toEqual([])
  })

  it('revalidates only clinic detail when a response enters the public projection', async () => {
    const req = buildReq()

    await revalidateReviewResponseChange({
      collection: { slug: 'reviewResponses' } as unknown as ReviewResponseChangeArgs['collection'],
      context: req.context,
      data: {},
      doc: {
        id: 401,
        clinic: 12,
        publishedResponse: {
          approvedAt: '2026-07-29T10:00:00.000Z',
          body: 'Thank you for sharing your experience with our clinic.',
          isBlocked: false,
        },
      },
      operation: 'update',
      previousDoc: {
        id: 401,
        clinic: 12,
      },
      req,
    } as ReviewResponseChangeArgs)

    expect(getPathCalls()).toEqual(['/clinics/berlin-health'])
    expect(getTagCalls()).toEqual([
      'entity:reviewResponses:401',
      'collection:reviewResponses',
      'surface:clinic-detail',
      'surface:clinic-detail:12',
      'slug:clinics:berlin-health',
    ])
    expect(getTagCalls()).not.toContain('surface:listing-comparison')
    expect(getTagCalls()).not.toContain('surface:sitemap:pages')
  })

  it('uses broad listing, landing, and sitemap tags for medical specialty changes without clinic paths', async () => {
    const req = buildReq()

    revalidateMedicalSpecialtyChange({
      collection: { slug: 'medical-specialties' } as unknown as MedicalSpecialtyChangeArgs['collection'],
      context: req.context,
      data: {},
      doc: { id: 77 },
      operation: 'update',
      previousDoc: undefined,
      req,
    } as MedicalSpecialtyChangeArgs)

    expect(getPathCalls()).toEqual(['/', '/partners/clinics'])
    expect(getPathCalls().some((path) => path.startsWith('/clinics/'))).toBe(false)
    expect(getTagCalls()).toEqual([
      'entity:medical-specialties:77',
      'collection:medical-specialties',
      'surface:listing-comparison',
      'surface:sitemap:pages',
      'surface:home',
      'surface:partners-clinics',
    ])
  })
})
