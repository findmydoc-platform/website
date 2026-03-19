import { afterEach, describe, expect, it, vi } from 'vitest'
import { afterErrorLogMediaUploadError, beforeOperationCaptureMediaUpload } from '@/hooks/media/uploadLogging'
import type { PayloadRequest, SanitizedCollectionConfig } from 'payload'

const createLogger = () => ({
  level: 'info',
  debug: vi.fn(),
  error: vi.fn(),
  fatal: vi.fn(),
  info: vi.fn(),
  trace: vi.fn(),
  warn: vi.fn(),
})

const createRequest = (): PayloadRequest =>
  ({
    context: {},
    file: { originalname: 'avatar.png', size: 2048 },
    headers: new Headers({
      'x-request-id': 'req-123',
      'x-vercel-id': 'fra1::deploy123',
    }),
    payload: {
      logger: createLogger(),
    },
  }) as unknown as PayloadRequest

const collection = {
  slug: 'clinicMedia',
} as SanitizedCollectionConfig

describe('media upload logging hooks', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('captures upload metadata in req.context before the operation runs', async () => {
    const req = createRequest()
    const beforeOperation = beforeOperationCaptureMediaUpload({
      ownerField: 'clinic',
      storagePrefix: 'clinic-media',
    })

    await beforeOperation({
      args: {
        data: {
          clinic: { id: 'clinic-1' },
        },
      },
      collection,
      operation: 'create',
      req,
    } as never)

    expect(req.context).toEqual(
      expect.objectContaining({
        mediaUploadLog: {
          collection: 'clinicMedia',
          event: 'storage.media.upload_attempt',
          fileName: 'avatar.png',
          fileSize: 2048,
          operation: 'create',
          ownerField: 'clinic',
          ownerId: 'clinic-1',
          storagePrefix: 'clinic-media',
        },
      }),
    )
  })

  it('logs structured upload failures with request context', async () => {
    const req = createRequest()
    req.context.mediaUploadLog = {
      collection: 'clinicMedia',
      event: 'storage.media.upload_attempt',
      fileName: 'avatar.png',
      fileSize: 2048,
      operation: 'create',
      ownerField: 'clinic',
      ownerId: 'clinic-1',
      storagePrefix: 'clinic-media',
    }
    const error = new Error('bucket rejected object')

    await afterErrorLogMediaUploadError({
      collection,
      error,
      req,
    } as never)

    expect(req.payload.logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'clinicMedia',
        deploymentEnv: expect.any(String),
        err: error,
        event: 'storage.media.upload_failed',
        fileName: 'avatar.png',
        fileSize: 2048,
        operation: 'create',
        ownerField: 'clinic',
        ownerId: 'clinic-1',
        requestId: 'req-123',
        scope: 'storage.media',
        storagePrefix: 'clinic-media',
        vercelId: 'fra1::deploy123',
      }),
      'Media upload failed',
    )
  })

  it('downgrades expected NoSuchKey upload failures to warnings without stack traces', async () => {
    const req = createRequest()
    vi.stubEnv('S3_BUCKET', 'portalfiles')
    req.context.mediaUploadLog = {
      collection: 'clinicMedia',
      event: 'storage.media.upload_attempt',
      fileName: 'avatar.png',
      fileSize: 2048,
      operation: 'update',
      ownerField: 'clinic',
      ownerId: 'clinic-1',
      storagePrefix: 'clinic-media',
    }
    req.context.seedMediaExpectedNoSuchKeyRecovery = true
    const error = {
      name: 'NoSuchKey',
      Code: 'NoSuchKey',
      Resource: 'portalfiles/platform/eye-care-laser-vision-correction.webp',
      message: 'Object not found',
    }

    await afterErrorLogMediaUploadError({
      collection,
      error,
      req,
    } as never)

    expect(req.payload.logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'clinicMedia',
        deploymentEnv: expect.any(String),
        event: 'storage.media.upload_recovery_needed',
        fileName: 'avatar.png',
        fileSize: 2048,
        missingKey: 'platform/eye-care-laser-vision-correction.webp',
        operation: 'update',
        ownerField: 'clinic',
        ownerId: 'clinic-1',
        requestId: 'req-123',
        scope: 'storage.media',
        storagePrefix: 'clinic-media',
        vercelId: 'fra1::deploy123',
      }),
      'Media upload missing object key; seed recovery can replace the upload',
    )
    expect(req.payload.logger.error).not.toHaveBeenCalled()
  })

  it('does nothing when no upload context is available', async () => {
    const req = createRequest()

    await afterErrorLogMediaUploadError({
      collection,
      error: new Error('boom'),
      req,
    } as never)

    expect(req.payload.logger.error).not.toHaveBeenCalled()
  })

  it('does not capture upload context for metadata-only updates', async () => {
    const req = createRequest()
    delete (req as { file?: unknown }).file
    req.context.mediaUploadLog = {
      collection: 'clinicMedia',
      event: 'storage.media.upload_attempt',
      operation: 'update',
      storagePrefix: 'clinic-media',
    }

    const beforeOperation = beforeOperationCaptureMediaUpload({
      ownerField: 'clinic',
      storagePrefix: 'clinic-media',
    })

    await beforeOperation({
      args: {
        data: {
          clinic: { id: 'clinic-1' },
          filename: 'existing-file.png',
        },
      },
      collection,
      operation: 'update',
      req,
    } as never)

    expect(req.context.mediaUploadLog).toBeUndefined()
  })
})
