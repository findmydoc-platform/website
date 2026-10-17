import type { PayloadRequest } from 'payload'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  ClinicTreatmentServiceError,
  createClinicTreatment,
  readClinicTreatmentSnapshot,
  updateClinicTreatment,
} from '@/features/clinicDashboard/treatments/service'
import { canonicalizeDescriptionText } from '@/features/clinicDashboard/profile/richText'

const transactions = vi.hoisted(() => ({
  begin: vi.fn(async () => 'tx-1'),
  commit: vi.fn(async () => undefined),
  rollback: vi.fn(async () => undefined),
}))

const cache = vi.hoisted(() => ({ dispatch: vi.fn(async () => undefined) }))

vi.mock('@/hooks/revalidateClinicSurfaces', () => ({
  dispatchClinicTreatmentChangeRevalidation: cache.dispatch,
}))

const treatment = {
  description: null,
  id: 8,
  name: 'Treatment',
}
const offering = {
  active: false,
  clinic: 7,
  id: 9,
  price: 100,
  treatment,
  updatedAt: '2026-08-13T10:00:00.000Z',
}

const request = (overrides: Record<string, unknown> = {}) =>
  ({
    payload: {
      create: vi.fn(async () => offering),
      db: {
        sessions: { 'tx-1': {}, 'tx-2': {} },
        beginTransaction: transactions.begin,
        commitTransaction: transactions.commit,
        rollbackTransaction: transactions.rollback,
      },
      find: vi.fn(async () => ({ docs: [offering] })),
      findByID: vi.fn(async () => treatment),
      update: vi.fn(async () => ({
        docs: [{ ...offering, active: true, updatedAt: '2026-08-13T10:01:00.000Z' }],
      })),
      ...overrides,
    },
  }) as unknown as PayloadRequest

describe('Clinic Dashboard treatment service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    transactions.begin.mockResolvedValue('tx-1')
    transactions.commit.mockResolvedValue(undefined)
  })

  it('always creates new clinic treatments inactive for the server-derived clinic', async () => {
    const req = request()

    await createClinicTreatment(req, 7, { priceEUR: 100, treatmentId: '8' })

    expect(req.payload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'clinictreatments',
        data: { active: false, clinic: 7, price: 100, treatment: 8 },
      }),
    )
  })

  it('owns one native creation transaction and publishes invalidation only after commit', async () => {
    const req = request()
    req.payload.create = vi.fn(async ({ req: borrowed }: { req: PayloadRequest }) => {
      expect(borrowed.transactionID).toBeInstanceOf(Promise)
      expect(await borrowed.transactionID).toBe('tx-1')
      return offering
    }) as unknown as typeof req.payload.create
    await createClinicTreatment(req, 7, { priceEUR: 100, treatmentId: '8' })
    expect(transactions.begin).toHaveBeenCalledOnce()
    expect(transactions.commit).toHaveBeenCalledOnce()
    expect(cache.dispatch).toHaveBeenCalledAfter(transactions.commit)
    expect(req.transactionID).toBeUndefined()
  })

  it('does not retry an unknown creation serialization outcome', async () => {
    const error = Object.assign(new Error('Synthetic creation abort'), { code: '40001' })
    const req = request({ create: vi.fn().mockRejectedValue(error) })
    await expect(createClinicTreatment(req, 7, { priceEUR: 100, treatmentId: '8' })).rejects.toBe(error)
    expect(transactions.begin).toHaveBeenCalledOnce()
    expect(transactions.rollback).toHaveBeenCalledOnce()
    expect(transactions.commit).not.toHaveBeenCalled()
    expect(cache.dispatch).not.toHaveBeenCalled()
  })

  it('never commits or invalidates after a nested writer loses the active native owner', async () => {
    const req = request()
    req.payload.update = vi.fn(async () => {
      delete req.payload.db.sessions!['tx-1']
      return { docs: [{ ...offering, price: 120 }] }
    }) as unknown as typeof req.payload.update
    await expect(
      updateClinicTreatment(req, 7, {
        offeringId: '9',
        expectedRevision: offering.updatedAt,
        priceEUR: 120,
        active: false,
      }),
    ).rejects.toThrow(/active native transaction/)
    expect(transactions.commit).not.toHaveBeenCalled()
    expect(transactions.rollback).toHaveBeenCalledOnce()
    expect(cache.dispatch).not.toHaveBeenCalled()
  })

  it('returns complete paginated snapshots with full treatment descriptions', async () => {
    const describedTreatment = {
      ...treatment,
      description: canonicalizeDescriptionText('Complete description'),
    }
    const secondTreatment = { ...treatment, id: 10, name: 'Second treatment' }
    const find = vi.fn(async ({ collection, page }: { collection: string; page: number }) => {
      if (collection === 'clinictreatments') {
        return { docs: [{ ...offering, treatment: treatment.id }], hasNextPage: false, nextPage: null }
      }
      if (page === 1) {
        return { docs: [describedTreatment], hasNextPage: true, nextPage: 2 }
      }
      return { docs: [secondTreatment], hasNextPage: false, nextPage: null }
    })
    const req = request({ find })

    const snapshot = await readClinicTreatmentSnapshot(req, 7)

    expect(snapshot.catalogue).toEqual([
      { descriptionText: 'Complete description', id: '8', name: 'Treatment' },
      { descriptionText: '', id: '10', name: 'Second treatment' },
    ])
    expect(snapshot.offerings[0]?.treatment.descriptionText).toBe('Complete description')
    expect(find).toHaveBeenCalledWith(expect.objectContaining({ collection: 'treatments', page: 2 }))
  })

  it('does not update an offering outside the server-derived clinic', async () => {
    const update = vi.fn()
    const req = request({ find: vi.fn(async () => ({ docs: [] })), update })

    await expect(
      updateClinicTreatment(req, 7, {
        active: true,
        expectedRevision: offering.updatedAt,
        offeringId: '99',
        priceEUR: 120,
      }),
    ).rejects.toEqual(expect.objectContaining<Partial<ClinicTreatmentServiceError>>({ kind: 'not-found' }))
    expect(update).not.toHaveBeenCalled()
    expect(transactions.rollback).toHaveBeenCalledOnce()
  })

  it('updates only the expected clinic-scoped revision and rejects stale writes', async () => {
    const req = request()

    await updateClinicTreatment(req, 7, {
      active: true,
      expectedRevision: offering.updatedAt,
      offeringId: '9',
      priceEUR: 120,
    })

    expect(req.payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        context: { disableRevalidate: true },
        data: { active: true, price: 120 },
        where: {
          and: [{ id: { equals: 9 } }, { clinic: { equals: 7 } }, { updatedAt: { equals: offering.updatedAt } }],
        },
      }),
    )
    expect(transactions.begin).toHaveBeenCalledWith({
      accessMode: 'read write',
      isolationLevel: 'serializable',
    })
    expect(transactions.commit).toHaveBeenCalledOnce()
    expect(cache.dispatch).toHaveBeenCalledAfter(transactions.commit)
    expect(cache.dispatch).toHaveBeenCalledWith({
      doc: expect.objectContaining({ active: true }),
      previousDoc: offering,
      req,
    })

    const stale = request({ find: vi.fn(async () => ({ docs: [{ ...offering, updatedAt: 'later' }] })) })
    await expect(
      updateClinicTreatment(stale, 7, {
        active: true,
        expectedRevision: offering.updatedAt,
        offeringId: '9',
        priceEUR: 120,
      }),
    ).rejects.toEqual(expect.objectContaining<Partial<ClinicTreatmentServiceError>>({ kind: 'conflict' }))
    expect(stale.payload.update).not.toHaveBeenCalled()
    expect(cache.dispatch).toHaveBeenCalledOnce()
  })

  it('retries serialization failures and turns a newly stale revision into a conflict', async () => {
    const changed = { ...offering, updatedAt: '2026-08-13T10:01:00.000Z' }
    const find = vi
      .fn()
      .mockResolvedValueOnce({ docs: [offering] })
      .mockResolvedValueOnce({ docs: [changed] })
    const req = request({ find })
    transactions.begin.mockResolvedValueOnce('tx-1').mockResolvedValueOnce('tx-2')
    transactions.commit.mockRejectedValueOnce(Object.assign(new Error('serialization failure'), { code: '40001' }))

    await expect(
      updateClinicTreatment(req, 7, {
        active: true,
        expectedRevision: offering.updatedAt,
        offeringId: '9',
        priceEUR: 120,
      }),
    ).rejects.toEqual(expect.objectContaining<Partial<ClinicTreatmentServiceError>>({ kind: 'conflict' }))

    expect(transactions.begin).toHaveBeenCalledTimes(2)
    expect(transactions.rollback).toHaveBeenCalledTimes(2)
    expect(req.payload.update).toHaveBeenCalledOnce()
    expect(cache.dispatch).not.toHaveBeenCalled()
  })
})
