import type { CollectionBeforeOperationHook } from 'payload'
import { getIncomingUploadFilename } from '@/collections/common/mediaPathHelpers'

const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null

const number = (value: unknown): number | undefined => {
  if (typeof value !== 'number' && (typeof value !== 'string' || value.trim() === '')) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

/** Remove editor confirmations that would otherwise trigger a remote image reupload. */
export const beforeOperationNormalizeImageEdits: CollectionBeforeOperationHook = async ({
  args,
  operation,
  req,
  collection,
}) => {
  if (operation !== 'update') return args
  // Cloud storage has already processed the file. Its nested update only persists metadata.
  // Replace the query object so callers retaining the original query are not mutated.
  if (req.context?.skipCloudStorage === true) {
    req.query = { ...req.query }
    delete req.query.uploadEdits
    return args
  }
  const edits = record(req.query?.uploadEdits)
  if (!edits) return args
  const input = args as unknown as Record<string, unknown>
  if (getIncomingUploadFilename(input) || getIncomingUploadFilename(req as unknown as Record<string, unknown>))
    return args
  if (typeof input.id !== 'string' && typeof input.id !== 'number') return args

  const doc = await req.payload.findByID({
    collection: collection.slug,
    id: input.id,
    depth: 0,
    overrideAccess: false,
    req,
  })
  const saved = doc as unknown as Record<string, unknown>
  const normalized = { ...edits }
  for (const key of ['widthInPixels', 'heightInPixels'] as const) {
    const value = number(edits[key])
    if (value !== undefined) normalized[key] = value
  }
  const crop = record(edits.crop)
  const fullCrop =
    crop &&
    crop.unit === '%' &&
    number(crop.x) === 0 &&
    number(crop.y) === 0 &&
    number(crop.width) === 100 &&
    number(crop.height) === 100
  const sameWidth = number(edits.widthInPixels) === number(saved.width)
  const sameHeight = number(edits.heightInPixels) === number(saved.height)
  // Real crops still need both pixel dimensions, even when one dimension is unchanged.
  if (!edits.crop || (fullCrop && sameWidth && sameHeight)) {
    if (fullCrop) delete normalized.crop
    if (sameWidth) delete normalized.widthInPixels
    if (sameHeight) delete normalized.heightInPixels
  }
  const focal = record(edits.focalPoint)
  if (focal) {
    const x = number(focal.x)
    const y = number(focal.y)
    // Real edits still need the focus for generated sizes, including zero coordinates.
    if (
      x === (number(saved.focalX) ?? 50) &&
      y === (number(saved.focalY) ?? 50) &&
      Object.keys(normalized).every((key) => key === 'focalPoint')
    ) {
      delete normalized.focalPoint
    } else if (x !== undefined && y !== undefined) {
      normalized.focalPoint = { ...focal, x, y }
    }
  }
  req.query = { ...req.query }
  if (Object.keys(normalized).length === 0) delete req.query.uploadEdits
  else req.query.uploadEdits = normalized
  return args
}
