/**
 * Helpers for extracting file metadata from incoming requests.
 * Keep this small and defensive because request shapes vary between adapters.
 */
export function extractFileSizeFromRequest(req?: any): number | undefined {
  if (!req || typeof req !== 'object') return undefined

  // single-file upload (e.g. multer library req.file)
  if (req.file && typeof req.file === 'object' && typeof req.file.size === 'number') {
    return req.file.size
  }

  // array of files
  if (Array.isArray(req.files) && req.files.length) {
    const first = req.files[0]
    if (first && typeof first.size === 'number') return first.size
    return undefined
  }

  // named file fields (object of arrays or objects)
  if (req.files && typeof req.files === 'object') {
    for (const value of Object.values(req.files)) {
      if (Array.isArray(value) && value.length && typeof value[0]?.size === 'number') return value[0].size
      if (value && typeof value === 'object' && typeof (value as any).size === 'number') return (value as any).size
    }
  }

  return undefined
}
