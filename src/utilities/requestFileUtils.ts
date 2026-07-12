export type RequestFile = Record<string, unknown>

export function extractFileFromRequest(req?: unknown): RequestFile | undefined {
  if (!req || typeof req !== 'object') return undefined
  const r = req as Record<string, unknown>

  // single-file upload (e.g. multer library req.file)
  if (r.file && typeof r.file === 'object') {
    return r.file as RequestFile
  }

  // array of files
  if (Array.isArray(r.files) && r.files.length) {
    const first = r.files[0]
    if (first && typeof first === 'object') {
      return first as RequestFile
    }
    return undefined
  }

  // named file fields (object of arrays or objects)
  if (r.files && typeof r.files === 'object') {
    for (const value of Object.values(r.files)) {
      if (Array.isArray(value) && value.length) {
        const first = value[0]
        if (first && typeof first === 'object') {
          return first as RequestFile
        }
      }
      if (value && typeof value === 'object') {
        return value as RequestFile
      }
    }
  }

  return undefined
}

/**
 * Helpers for extracting file metadata from incoming requests.
 * Keep these small and defensive because request shapes vary between adapters.
 */
export function extractFileSizeFromRequest(req?: unknown): number | undefined {
  const file = extractFileFromRequest(req)
  return typeof file?.size === 'number' ? file.size : undefined
}

export function extractFileMimeTypeFromRequest(req?: unknown): string | undefined {
  const file = extractFileFromRequest(req)
  const mimeType = file?.mimetype ?? file?.mimeType ?? file?.type
  return typeof mimeType === 'string' && mimeType.length > 0 ? mimeType : undefined
}
