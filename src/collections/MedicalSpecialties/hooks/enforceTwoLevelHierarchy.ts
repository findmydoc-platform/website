import type { CollectionBeforeChangeHook, PayloadRequest } from 'payload'
import { ValidationError } from 'payload'
import { findInternalByID } from '@/hooks/internalFindByID'
import { MEDICAL_SPECIALTY_PARENT_MESSAGES } from '../parentEligibility'

function relationId(value: unknown): number | string | null {
  if (typeof value === 'number' || typeof value === 'string') {
    return value
  }

  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    if (typeof id === 'number' || typeof id === 'string') {
      return id
    }
  }

  return null
}

const throwParentValidation = ({
  id,
  message,
  req,
}: {
  id?: number | string
  message: string
  req: PayloadRequest
}): never => {
  throw new ValidationError({
    collection: 'medical-specialties',
    errors: [{ label: 'Parent Specialty', message, path: 'parentSpecialty' }],
    id,
    req,
  })
}

export const enforceTwoLevelHierarchy: CollectionBeforeChangeHook = async ({ data, originalDoc, req }) => {
  const hasParentInput = Object.prototype.hasOwnProperty.call(data, 'parentSpecialty')
  if (!hasParentInput) {
    return data
  }

  const parentId = relationId((data as { parentSpecialty?: unknown }).parentSpecialty)
  if (parentId === null) {
    return data
  }

  const currentDocId =
    relationId((data as { id?: unknown }).id) || relationId((originalDoc as { id?: unknown } | undefined)?.id)

  if (currentDocId !== null && String(currentDocId) === String(parentId)) {
    throwParentValidation({ id: currentDocId, message: MEDICAL_SPECIALTY_PARENT_MESSAGES.self, req })
  }

  const parentDoc = await findInternalByID({
    req,
    collection: 'medical-specialties',
    id: parentId,
    depth: 0,
  })

  const grandParentId = relationId((parentDoc as { parentSpecialty?: unknown }).parentSpecialty)
  if (grandParentId !== null) {
    throwParentValidation({
      id: currentDocId ?? undefined,
      message: MEDICAL_SPECIALTY_PARENT_MESSAGES.nested,
      req,
    })
  }

  return data
}
