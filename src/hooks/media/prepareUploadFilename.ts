import crypto from 'crypto'
import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'
import type { CollectionBeforeOperationHook, PayloadRequest } from 'payload'

import { getIncomingUploadFilename } from '@/collections/common/mediaPathHelpers'

const FILENAME_PROPS = ['name', 'originalname', 'originalFilename', 'filename'] as const
const PREPARED_UPLOAD_FILENAME_CONTEXT_KEY = 'mediaPreparedUploadFilename'

type UploadFileLike = Record<string, unknown>

function shortHash(input: Buffer | string): string {
  return crypto.createHash('sha1').update(input).digest('hex').slice(0, 10)
}

function normalizeUploadedFilename(filename: string): string | null {
  const normalizedPath = filename.replace(/\\/g, '/')
  const base = path.posix.basename(normalizedPath).trim()
  return base.length > 0 ? base : null
}

function splitFilename(filename: string): { stem: string; extension: string } {
  const extension = path.extname(filename)
  const stem = extension ? filename.slice(0, -extension.length) : filename

  return {
    stem: stem || filename,
    extension,
  }
}

function readFilenameCandidate(file: UploadFileLike | null): string | null {
  if (!file) return null

  for (const prop of FILENAME_PROPS) {
    const value = file[prop]
    if (typeof value !== 'string') continue
    const trimmed = value.trim()
    if (trimmed.length > 0) return trimmed
  }

  return null
}

function readUploadFileSize(file: UploadFileLike | null): number | undefined {
  if (!file) return undefined
  const size = file.size
  return typeof size === 'number' && Number.isFinite(size) ? size : undefined
}

async function readUploadFileBuffer(file: UploadFileLike | null): Promise<Buffer | null> {
  if (!file) return null

  const data = file.data
  if (Buffer.isBuffer(data)) return data
  if (data instanceof Uint8Array) return Buffer.from(data)

  const tempFilePath = file.tempFilePath
  if (typeof tempFilePath === 'string' && tempFilePath.trim().length > 0) {
    try {
      return await fs.readFile(tempFilePath)
    } catch {
      return null
    }
  }

  return null
}

function findUploadFiles(value: unknown): UploadFileLike[] {
  if (!value) return []

  if (Array.isArray(value)) {
    return value.flatMap(findUploadFiles)
  }

  if (typeof value !== 'object') return []

  const objectValue = value as UploadFileLike
  if (readFilenameCandidate(objectValue)) return [objectValue]

  return Object.values(objectValue).flatMap(findUploadFiles)
}

function getUploadFiles(args: Record<string, unknown> | undefined, req: PayloadRequest): UploadFileLike[] {
  const files = [
    ...findUploadFiles((req as unknown as Record<string, unknown>).file),
    ...findUploadFiles((req as unknown as Record<string, unknown>).files),
    ...findUploadFiles(args?.file),
    ...findUploadFiles(args?.files),
  ]

  const deduped: UploadFileLike[] = []
  const seen = new Set<UploadFileLike>()

  for (const file of files) {
    if (seen.has(file)) continue
    seen.add(file)
    deduped.push(file)
  }

  return deduped
}

function writePreparedFilename(file: UploadFileLike, filename: string): void {
  for (const prop of FILENAME_PROPS) {
    if (prop in file || prop === 'name') {
      file[prop] = filename
    }
  }
}

export function buildPreparedUploadFilename({ filename, hash }: { filename: string; hash: string }): string | null {
  const normalized = normalizeUploadedFilename(filename)
  if (!normalized) return null

  const { stem, extension } = splitFilename(normalized)
  return `${hash}-${stem}${extension}`
}

export function prepareUploadFilenameFromBuffer({
  filename,
  buffer,
}: {
  filename: string
  buffer: Buffer
}): string | null {
  return buildPreparedUploadFilename({
    filename,
    hash: shortHash(buffer),
  })
}

export function prepareUploadFilenameFromFilePathSync(filePath: string): string | null {
  try {
    const buffer = fsSync.readFileSync(filePath)
    return prepareUploadFilenameFromBuffer({
      filename: path.basename(filePath),
      buffer,
    })
  } catch {
    return null
  }
}

async function prepareUploadFile(file: UploadFileLike, fallbackFilename: string | null): Promise<string | null> {
  const filename = readFilenameCandidate(file) ?? fallbackFilename
  if (!filename) return null

  const buffer = await readUploadFileBuffer(file)
  const fileSize = readUploadFileSize(file)
  const hash = buffer ? shortHash(buffer) : shortHash(`${filename}:${fileSize ?? ''}`)
  const preparedFilename = buildPreparedUploadFilename({ filename, hash })
  if (!preparedFilename) return null

  writePreparedFilename(file, preparedFilename)
  return preparedFilename
}

export const beforeOperationPrepareUploadFilename: CollectionBeforeOperationHook = async ({ args, operation, req }) => {
  if (operation !== 'create' && operation !== 'update') return args

  const recordArgs = args as Record<string, unknown> | undefined
  const uploadFiles = getUploadFiles(recordArgs, req)
  const fallbackFilename =
    getIncomingUploadFilename(recordArgs ?? null) ??
    getIncomingUploadFilename(req as unknown as Record<string, unknown>)

  if (uploadFiles.length === 0) return args

  req.context = req.context ?? {}
  const preparedNames: string[] = []

  for (const file of uploadFiles) {
    const prepared = await prepareUploadFile(file, fallbackFilename)
    if (prepared) preparedNames.push(prepared)
  }

  if (preparedNames.length > 0) {
    req.context[PREPARED_UPLOAD_FILENAME_CONTEXT_KEY] = preparedNames[0]
  }

  return args
}
