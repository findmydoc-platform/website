import crypto from 'crypto'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import type { PayloadRequest, SanitizedCollectionConfig } from 'payload'

import {
  beforeOperationPrepareUploadFilename,
  prepareUploadFilenameFromFilePathSync,
} from '@/hooks/media/prepareUploadFilename'

const collection = {
  slug: 'clinicMedia',
} as SanitizedCollectionConfig

function createReq(overrides: Partial<PayloadRequest> = {}): PayloadRequest {
  return {
    context: {},
    payload: {
      logger: {
        error: () => undefined,
      },
    },
    ...overrides,
  } as unknown as PayloadRequest
}

function shortHash(input: Buffer | string): string {
  return crypto.createHash('sha1').update(input).digest('hex').slice(0, 10)
}

describe('beforeOperationPrepareUploadFilename', () => {
  const tempDirs: string[] = []

  afterEach(() => {
    for (const tempDir of tempDirs.splice(0)) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('prefixes incoming buffer uploads with a content hash before Payload creates image sizes', async () => {
    const buffer = Buffer.from('team portrait')
    const req = createReq({
      file: {
        name: 'team/AnilGoekduman.webp',
        originalname: 'team/AnilGoekduman.webp',
        data: buffer,
        size: buffer.length,
      },
    } as unknown as Partial<PayloadRequest>)

    await beforeOperationPrepareUploadFilename({
      args: { data: {} },
      collection,
      operation: 'create',
      req,
    } as never)

    const expected = `${shortHash(buffer)}-AnilGoekduman.webp`
    expect((req.file as { name?: string }).name).toBe(expected)
    expect((req.file as { originalname?: string }).originalname).toBe(expected)
    expect(req.context.mediaPreparedUploadFilename).toBe(expected)
  })

  it('uses temp file content when uploads are backed by a tempFilePath', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'media-upload-'))
    tempDirs.push(tempDir)
    const filePath = path.join(tempDir, 'portrait.webp')
    const buffer = Buffer.from('temp portrait')
    fs.writeFileSync(filePath, buffer)
    const req = createReq({
      file: {
        name: 'portrait.webp',
        tempFilePath: filePath,
        size: buffer.length,
      },
    } as unknown as Partial<PayloadRequest>)

    await beforeOperationPrepareUploadFilename({
      args: { data: {} },
      collection,
      operation: 'update',
      req,
    } as never)

    expect((req.file as { name?: string }).name).toBe(`${shortHash(buffer)}-portrait.webp`)
    expect(prepareUploadFilenameFromFilePathSync(filePath)).toBe(`${shortHash(buffer)}-portrait.webp`)
  })

  it('leaves metadata-only updates unchanged', async () => {
    const req = createReq()

    await beforeOperationPrepareUploadFilename({
      args: { data: { alt: 'Updated alt' } },
      collection,
      operation: 'update',
      req,
    } as never)

    expect(req.context.mediaPreparedUploadFilename).toBeUndefined()
  })
})
