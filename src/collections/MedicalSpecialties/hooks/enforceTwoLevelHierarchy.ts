import type { CollectionBeforeChangeHook } from 'payload'

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
    throw new Error('A medical specialty cannot be its own parent.')
  }

  const parentDoc = await req.payload.findByID({
    collection: 'medical-specialties',
    id: parentId,
    depth: 0,
    overrideAccess: true,
    req,
  })

  const grandParentId = relationId((parentDoc as { parentSpecialty?: unknown }).parentSpecialty)
  if (grandParentId !== null) {
    throw new Error(
      'Only two hierarchy levels are allowed for medical specialties. Create level 3 entries as treatments.',
    )
  }

  return data
}
