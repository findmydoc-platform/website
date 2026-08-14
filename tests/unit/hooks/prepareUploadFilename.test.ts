import crypto from 'crypto'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import type { PayloadRequest, SanitizedCollectionConfig } from 'payload'

import { ClinicGalleryMedia } from '@/collections/ClinicGalleryMedia'
import { ClinicMedia } from '@/collections/ClinicMedia'
import { DoctorMedia } from '@/collections/DoctorMedia'
import { PlatformContentMedia } from '@/collections/PlatformContentMedia'
import { UserProfileMedia } from '@/collections/UserProfileMedia'
import {
  beforeOperationPrepareUploadFilename,
  prepareUploadFilenameFromFilePathSync,
} from '@/hooks/media/prepareUploadFilename'
import { beforeOperationNormalizeClinicMediaUpload } from '@/hooks/media/normalizeClinicMediaUpload'
import { beforeOperationValidateMediaUpload } from '@/hooks/media/validateMediaUpload'

const collection = {
  slug: 'clinicMedia',
} as SanitizedCollectionConfig
const sharedMediaCollections = [PlatformContentMedia, ClinicMedia, ClinicGalleryMedia, DoctorMedia, UserProfileMedia]

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

  it('keeps the prepared filename stable during the internal cloud-storage update', async () => {
    const buffer = Buffer.from('doctor portrait')
    const uploadFile = {
      name: 'portrait.png',
      originalname: 'portrait.png',
      data: buffer,
      size: buffer.length,
    }
    const req = createReq({
      file: uploadFile,
      files: {
        file: [uploadFile],
      },
    } as unknown as Partial<PayloadRequest>)

    await beforeOperationPrepareUploadFilename({
      args: { data: {} },
      collection,
      operation: 'create',
      req,
    } as never)

    const expected = `${shortHash(buffer)}-portrait.png`
    expect(uploadFile.name).toBe(expected)

    req.file = undefined
    req.context.skipCloudStorage = true

    await beforeOperationPrepareUploadFilename({
      args: { data: {} },
      collection,
      operation: 'update',
      req,
    } as never)

    expect(uploadFile.name).toBe(expected)
    expect(uploadFile.originalname).toBe(expected)
    expect(req.context.mediaPreparedUploadFilename).toBe(expected)
  })

  it.each(sharedMediaCollections)('wires filename preparation after upload validation for $slug', (mediaCollection) => {
    const beforeOperationHooks = mediaCollection.hooks?.beforeOperation ?? []

    expect(beforeOperationHooks).toContain(beforeOperationValidateMediaUpload)
    expect(beforeOperationHooks).toContain(beforeOperationPrepareUploadFilename)
    const validationIndex = beforeOperationHooks.indexOf(beforeOperationValidateMediaUpload)
    const filenameIndex = beforeOperationHooks.indexOf(beforeOperationPrepareUploadFilename)

    expect(filenameIndex).toBeGreaterThan(validationIndex)

    if (mediaCollection.slug === 'clinicMedia') {
      const normalizationIndex = beforeOperationHooks.indexOf(beforeOperationNormalizeClinicMediaUpload)
      expect(normalizationIndex).toBe(validationIndex + 1)
      expect(filenameIndex).toBe(normalizationIndex + 1)
    }
  })

  it('does not hash an upload twice when the hook is invoked repeatedly for one request', async () => {
    const buffer = Buffer.from('repeatable seed image')
    const uploadFile = {
      name: 'seed-image.webp',
      data: buffer,
      size: buffer.length,
    }
    const req = createReq({
      context: {
        seedMediaExpectedNoSuchKeyRecovery: true,
      },
      file: uploadFile,
    } as unknown as Partial<PayloadRequest>)

    const hookArgs = {
      args: { data: {} },
      collection,
      operation: 'update',
      req,
    } as never

    await beforeOperationPrepareUploadFilename(hookArgs)
    await beforeOperationPrepareUploadFilename(hookArgs)

    const expected = `${shortHash(buffer)}-seed-image.webp`
    expect(uploadFile.name).toBe(expected)
    expect(req.context.mediaPreparedUploadFilename).toBe(expected)
  })
})
