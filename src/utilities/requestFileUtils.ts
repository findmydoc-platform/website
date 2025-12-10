/**
 * Helpers for extracting file metadata from incoming requests.
 * Keep this small and defensive because request shapes vary between adapters.
 */
export function extractFileSizeFromRequest(req?: unknown): number | undefined {
  if (!req || typeof req !== 'object') return undefined
  const r = req as Record<string, unknown>

  // single-file upload (e.g. multer library req.file)
  if (r.file && typeof r.file === 'object') {
    const file = r.file as Record<string, unknown>
    if (typeof file.size === 'number') {
      return file.size
    }
  }

  // array of files
  if (Array.isArray(r.files) && r.files.length) {
    const first = r.files[0]
    if (first && typeof first === 'object') {
      const f = first as Record<string, unknown>
      if (typeof f.size === 'number') return f.size
    }
    return undefined
  }

  // named file fields (object of arrays or objects)
  if (r.files && typeof r.files === 'object') {
    for (const value of Object.values(r.files)) {
      if (Array.isArray(value) && value.length) {
        const first = value[0]
        if (first && typeof first === 'object') {
          const f = first as Record<string, unknown>
          if (typeof f.size === 'number') return f.size
        }
      }
      if (value && typeof value === 'object') {
        const v = value as Record<string, unknown>
        if (typeof v.size === 'number') return v.size
      }
    }
  }

  return undefined
}
