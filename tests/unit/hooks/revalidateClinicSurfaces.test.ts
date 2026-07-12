import { beforeEach, describe, expect, it, vi } from 'vitest'
import { revalidatePath, revalidateTag } from 'next/cache'
import type { PayloadRequest } from 'payload'

import { revalidateClinicChange, revalidateClinicDelete } from '@/hooks/revalidateClinicSurfaces'
import { createMockReq } from '../helpers/testHelpers'

type ClinicDoc = {
  id: string | number
  slug: string
  status: 'draft' | 'pending' | 'approved' | 'rejected'
}

const buildReq = (context: Record<string, unknown> = {}): PayloadRequest =>
  createMockReq(null, undefined, {
    context,
  })

const getPathCalls = () => vi.mocked(revalidatePath).mock.calls.map(([path]) => path)
const getTagCalls = () => vi.mocked(revalidateTag).mock.calls.map(([tag]) => tag)

type AfterChangeArgs = Parameters<typeof revalidateClinicChange>[0]
type AfterDeleteArgs = Parameters<typeof revalidateClinicDelete>[0]

const buildAfterChangeArgs = (args: {
  doc: ClinicDoc
  previousDoc?: ClinicDoc
  req: PayloadRequest
}): AfterChangeArgs => ({
  collection: { slug: 'clinics' } as unknown as AfterChangeArgs['collection'],
  context: args.req.context,
  data: {},
  doc: args.doc,
  operation: 'update',
  previousDoc: args.previousDoc,
  req: args.req,
})

const buildAfterDeleteArgs = (args: { doc: ClinicDoc; req: PayloadRequest }): AfterDeleteArgs => ({
  collection: { slug: 'clinics' } as unknown as AfterDeleteArgs['collection'],
  context: args.req.context,
  doc: args.doc,
  id: args.doc.id,
  req: args.req,
})

describe('clinic surface revalidation hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('revalidates approved clinic detail paths and listing tags', () => {
    const req = buildReq()
    const doc: ClinicDoc = { id: 12, slug: 'berlin-health', status: 'approved' }

    const result = revalidateClinicChange(buildAfterChangeArgs({ doc, req })) as ClinicDoc

    expect(result).toBe(doc)
    expect(getPathCalls()).toEqual(['/clinics/berlin-health'])
    expect(getTagCalls()).toEqual([
      'entity:clinics:12',
      'collection:clinics',
      'surface:clinic-detail',
      'surface:clinic-detail:12',
      'surface:listing-comparison',
      'surface:sitemap:pages',
      'slug:clinics:berlin-health',
    ])
  })

  it('revalidates old and new clinic detail paths on approved slug changes', () => {
    const req = buildReq()
    const previousDoc: ClinicDoc = { id: 12, slug: 'old-health', status: 'approved' }
    const doc: ClinicDoc = { id: 12, slug: 'new-health', status: 'approved' }

    revalidateClinicChange(buildAfterChangeArgs({ doc, previousDoc, req }))

    expect(getPathCalls()).toEqual(['/clinics/new-health', '/clinics/old-health'])
    expect(getTagCalls()).toContain('slug:clinics:new-health')
    expect(getTagCalls()).toContain('slug:clinics:old-health')
  })

  it('skips clinic revalidation before planning when disabled or hook-triggered', () => {
    const doc: ClinicDoc = { id: 12, slug: 'skip-health', status: 'approved' }

    revalidateClinicChange(buildAfterChangeArgs({ doc, req: buildReq({ disableRevalidate: true }) }))
    revalidateClinicDelete(buildAfterDeleteArgs({ doc, req: buildReq({ skipHooks: true }) }))

    expect(getPathCalls()).toEqual([])
    expect(getTagCalls()).toEqual([])
  })
})
