import { stat } from 'node:fs/promises'
import path from 'node:path'
import type { LocalFileAsset } from '../types'

const CONTENT_TYPES = new Map<string, string>([
  ['.gif', 'image/gif'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp'],
])

export const resolveLocalFileAsset = async (filePath: string): Promise<LocalFileAsset> => {
  const absolutePath = path.resolve(process.cwd(), filePath)
  const stats = await stat(absolutePath)

  if (!stats.isFile()) {
    throw new Error(`Attachment path is not a file: ${filePath}`)
  }

  const extension = path.extname(absolutePath).toLowerCase()
  const contentType = CONTENT_TYPES.get(extension)

  if (!contentType) {
    throw new Error(`Unsupported attachment file type: ${extension || 'none'}`)
  }

  return {
    contentType,
    name: path.basename(absolutePath),
    path: absolutePath,
    size: stats.size,
  }
}
