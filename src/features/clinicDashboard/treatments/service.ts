import type { PayloadRequest } from 'payload'

import { richTextToPlainText } from '@/features/clinicDashboard/profile/richText'
import { dispatchClinicTreatmentChangeRevalidation } from '@/hooks/revalidateClinicSurfaces'
import type { Clinictreatment, Treatment } from '@/payload-types'
import type {
  ClinicTreatmentCreateInput,
  ClinicTreatmentMasterDTO,
  ClinicTreatmentOfferingDTO,
  ClinicTreatmentSnapshotDTO,
  ClinicTreatmentUpdateInput,
} from './contracts'

export type ClinicTreatmentServiceErrorKind = 'conflict' | 'invalid-input' | 'not-found' | 'unavailable'

export class ClinicTreatmentServiceError extends Error {
  constructor(
    readonly kind: ClinicTreatmentServiceErrorKind,
    message: string,
  ) {
    super(message)
    this.name = 'ClinicTreatmentServiceError'
  }
}

type RelationId = number | string

const relationId = (value: unknown): RelationId | null => {
  if (typeof value === 'number' && Number.isSafeInteger(value)) return value
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (value && typeof value === 'object' && 'id' in value) return relationId((value as { id?: unknown }).id)
  return null
}

const payloadId = (value: string): RelationId => {
  if (!/^[1-9]\d*$/u.test(value)) return value
  const numeric = Number(value)
  return Number.isSafeInteger(numeric) ? numeric : value
}

const numericClinicId = (clinicId: RelationId): number => {
  const numeric = typeof clinicId === 'number' ? clinicId : Number(clinicId)
  if (!Number.isSafeInteger(numeric) || numeric <= 0) {
    throw new ClinicTreatmentServiceError('unavailable', 'The assigned clinic identity is invalid.')
  }
  return numeric
}

const duplicateConstraint = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false
  const record = error as { code?: unknown; cause?: { code?: unknown }; message?: unknown }
  return (
    record.code === '23505' ||
    record.cause?.code === '23505' ||
    (typeof record.message === 'string' && /duplicate|unique/iu.test(record.message))
  )
}

const masterDTO = (treatment: Treatment): ClinicTreatmentMasterDTO => ({
  descriptionText: richTextToPlainText(treatment.description),
  id: String(treatment.id),
  name: treatment.name.trim(),
})

const offeringDTO = (offering: Clinictreatment, clinicId: RelationId): ClinicTreatmentOfferingDTO => {
  if (String(relationId(offering.clinic)) !== String(clinicId) || typeof offering.treatment !== 'object') {
    throw new ClinicTreatmentServiceError('unavailable', 'Clinic treatment relationships are unavailable.')
  }

  return {
    active: offering.active,
    id: String(offering.id),
    priceEUR: offering.price,
    revision: offering.updatedAt,
    treatment: masterDTO(offering.treatment),
  }
}

const MAX_TRANSACTION_ATTEMPTS = 3

const isSerializationFailure = (error: unknown): boolean => {
  const visited = new Set<unknown>()
  let current = error

  while (current !== null && typeof current !== 'undefined' && !visited.has(current)) {
    visited.add(current)
    if (typeof current !== 'object' && typeof current !== 'function') return false
    const record = current as Record<string, unknown>
    if (record.code === '40001' || record.sqlState === '40001' || record.sqlstate === '40001') return true
    current = record.cause
  }

  return false
}

const runSerializableTransaction = async <Result>(
  req: PayloadRequest,
  command: () => Promise<Result>,
): Promise<Result> => {
  if (typeof req.transactionID !== 'undefined') {
    throw new ClinicTreatmentServiceError('unavailable', 'Treatment updates cannot join another transaction.')
  }

  for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    let transactionID: null | number | string = null

    try {
      transactionID = await req.payload.db.beginTransaction({
        accessMode: 'read write',
        isolationLevel: 'serializable',
      })
      if (transactionID === null) {
        throw new ClinicTreatmentServiceError('unavailable', 'A database transaction could not be started.')
      }

      req.transactionID = transactionID
      const result = await command()
      await req.payload.db.commitTransaction(transactionID)
      return result
    } catch (error: unknown) {
      if (transactionID !== null) await req.payload.db.rollbackTransaction(transactionID)
      if (isSerializationFailure(error)) {
        if (attempt < MAX_TRANSACTION_ATTEMPTS) continue
        throw new ClinicTreatmentServiceError('conflict', 'The clinic treatment changed.')
      }
      throw error
    } finally {
      if (transactionID !== null && req.transactionID === transactionID) delete req.transactionID
    }
  }

  throw new ClinicTreatmentServiceError('conflict', 'The clinic treatment changed.')
}

export const readClinicTreatmentSnapshot = async (
  req: PayloadRequest,
  clinicId: RelationId,
): Promise<ClinicTreatmentSnapshotDTO> => {
  const [offerings, catalogue] = await Promise.all([
    req.payload.find({
      collection: 'clinictreatments',
      depth: 1,
      limit: 1_000,
      overrideAccess: true,
      pagination: false,
      req,
      where: { clinic: { equals: clinicId } },
    }),
    req.payload.find({
      collection: 'treatments',
      depth: 0,
      limit: 1_000,
      overrideAccess: true,
      pagination: false,
      req,
      sort: 'name',
    }),
  ])

  return {
    catalogue: catalogue.docs.map(masterDTO),
    offerings: offerings.docs.map((offering) => offeringDTO(offering, clinicId)),
  }
}

export const createClinicTreatment = async (
  req: PayloadRequest,
  clinicId: RelationId,
  input: ClinicTreatmentCreateInput,
): Promise<ClinicTreatmentOfferingDTO> => {
  try {
    const treatment = await req.payload.findByID({
      collection: 'treatments',
      depth: 0,
      id: payloadId(input.treatmentId),
      overrideAccess: true,
      req,
    })
    if (!treatment.name.trim()) {
      throw new ClinicTreatmentServiceError('invalid-input', 'The selected treatment is unavailable.')
    }

    const offering = await req.payload.create({
      collection: 'clinictreatments',
      data: {
        active: false,
        clinic: numericClinicId(clinicId),
        price: input.priceEUR,
        treatment: treatment.id,
      },
      depth: 1,
      overrideAccess: true,
      req,
    })
    return offeringDTO(offering, clinicId)
  } catch (error: unknown) {
    if (error instanceof ClinicTreatmentServiceError) throw error
    if (duplicateConstraint(error)) {
      throw new ClinicTreatmentServiceError('conflict', 'The clinic already offers this treatment.')
    }
    if (error && typeof error === 'object' && 'status' in error && error.status === 404) {
      throw new ClinicTreatmentServiceError('invalid-input', 'The selected treatment is unavailable.')
    }
    throw error
  }
}

export const updateClinicTreatment = async (
  req: PayloadRequest,
  clinicId: RelationId,
  input: ClinicTreatmentUpdateInput,
): Promise<ClinicTreatmentOfferingDTO> => {
  const result = await runSerializableTransaction(req, async () => {
    const existing = await req.payload.find({
      collection: 'clinictreatments',
      depth: 0,
      limit: 1,
      overrideAccess: true,
      pagination: false,
      req,
      where: {
        and: [{ id: { equals: payloadId(input.offeringId) } }, { clinic: { equals: clinicId } }],
      },
    })
    const current = existing.docs[0]
    if (!current) throw new ClinicTreatmentServiceError('not-found', 'The clinic treatment does not exist.')
    if (current.updatedAt !== input.expectedRevision) {
      throw new ClinicTreatmentServiceError('conflict', 'The clinic treatment changed.')
    }

    const result = await req.payload.update({
      collection: 'clinictreatments',
      context: { disableRevalidate: true },
      data: { active: input.active, price: input.priceEUR },
      depth: 1,
      overrideAccess: true,
      req,
      where: {
        and: [
          { id: { equals: current.id } },
          { clinic: { equals: clinicId } },
          { updatedAt: { equals: input.expectedRevision } },
        ],
      },
    })
    const updated = result.docs[0]
    if (!updated || result.docs.length !== 1) {
      throw new ClinicTreatmentServiceError('conflict', 'The clinic treatment changed.')
    }

    return { current, updated }
  })

  await dispatchClinicTreatmentChangeRevalidation({
    doc: result.updated,
    previousDoc: result.current,
    req,
  })

  return offeringDTO(result.updated, clinicId)
}
