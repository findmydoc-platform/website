import { beforeEach, describe, expect, it, vi } from 'vitest'
import { revalidatePath, revalidateTag } from 'next/cache'
import type { PayloadRequest } from 'payload'

import {
  revalidateClinicTreatmentChange,
  revalidateMedicalSpecialtyChange,
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
