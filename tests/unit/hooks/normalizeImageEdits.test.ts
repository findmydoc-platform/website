import { describe, expect, it, vi } from 'vitest'
import type { PayloadRequest } from 'payload'
import { beforeOperationNormalizeImageEdits } from '@/hooks/media/normalizeImageEdits'
import { PlatformContentMedia } from '@/collections/PlatformContentMedia'
import { ClinicMedia } from '@/collections/ClinicMedia'
import { DoctorMedia } from '@/collections/DoctorMedia'
import { UserProfileMedia } from '@/collections/UserProfileMedia'
import { ClinicGalleryMedia } from '@/collections/ClinicGalleryMedia'

describe('media edit normalization', () => {
  it('consumes completed edits for storage metadata without changing other request state', async () => {
    const query = { locale: 'en', uploadEdits: { widthInPixels: 50 } }
    const context = { skipCloudStorage: true }
    const headers = new Headers()
    const findByID = vi.fn()
    const req = {
      query,
      context,
      headers,
      transactionID: 'transaction',
      payload: { findByID },
    } as unknown as PayloadRequest
    const args = { id: 150, req }
    const result = await beforeOperationNormalizeImageEdits({ args, operation: 'update', req } as unknown as Parameters<
      typeof beforeOperationNormalizeImageEdits
    >[0])
    expect(result).toBe(args)
    expect(req.query).toEqual({ locale: 'en' })
    expect(query.uploadEdits).toEqual({ widthInPixels: 50 })
    expect(req.context).toBe(context)
    expect(req.headers).toBe(headers)
    expect(req.transactionID).toBe('transaction')
    expect(findByID).not.toHaveBeenCalled()
  })

  it.each([PlatformContentMedia, ClinicMedia, DoctorMedia, UserProfileMedia, ClinicGalleryMedia])(
    'normalizes before the upload pipeline in $slug',
    async (collection) => {
      const req = {
        query: { uploadEdits: { widthInPixels: '100', heightInPixels: '80' } },
        payload: { findByID: vi.fn().mockResolvedValue({ width: 100, height: 80 }) },
      } as unknown as PayloadRequest
      const firstHook = collection.hooks!.beforeOperation![0]!
      await firstHook({ args: { id: 150, req }, collection, req, operation: 'update' } as unknown as Parameters<
        typeof firstHook
      >[0])
      expect(req.query.uploadEdits).toBeUndefined()
    },
  )

  const saved = { width: 100, height: 80, focalX: null, focalY: null }
  const run = async (
    edits: Record<string, unknown>,
    options: { saved?: Record<string, unknown>; file?: object; operation?: 'create' | 'update'; denied?: boolean } = {},
  ) => {
    const findByID = vi.fn().mockResolvedValue(options.saved ?? saved)
    if (options.denied) findByID.mockRejectedValue(new Error('Forbidden'))
    const req = {
      query: { locale: 'en', uploadEdits: edits },
      payload: { findByID },
      file: options.file,
    } as unknown as PayloadRequest
    const args = { id: 150, req } as Parameters<typeof beforeOperationNormalizeImageEdits>[0]['args']
    await beforeOperationNormalizeImageEdits({
      args,
      operation: options.operation ?? 'update',
      req,
      collection: { slug: 'platformContentMedia' },
    } as Parameters<typeof beforeOperationNormalizeImageEdits>[0])
    return { req, findByID }
  }

  it('removes unchanged numeric strings and preserves other query parameters', async () => {
    const { req, findByID } = await run({
      widthInPixels: '100',
      heightInPixels: '80',
      focalPoint: { x: '50', y: '50' },
    })
    expect(req.query).toEqual({ locale: 'en' })
    expect(findByID).toHaveBeenCalledWith(expect.objectContaining({ id: 150, overrideAccess: false, req }))
  })

  it('removes a full-frame crop only when both pixel dimensions match', async () => {
    const crop = { unit: '%', x: '0', y: '0', width: '100', height: '100' }
    expect((await run({ crop, widthInPixels: '100', heightInPixels: '80' })).req.query).toEqual({ locale: 'en' })
    expect((await run({ crop, widthInPixels: '50', heightInPixels: '40' })).req.query.uploadEdits).toEqual({
      crop,
      widthInPixels: 50,
      heightInPixels: 40,
    })
  })

  it('retains both dimensions needed by a real crop', async () => {
    const crop = { unit: '%', x: 0, y: 50, width: 100, height: 50 }
    expect((await run({ crop, widthInPixels: '100', heightInPixels: '40' })).req.query.uploadEdits).toEqual({
      crop,
      widthInPixels: 100,
      heightInPixels: 40,
    })
  })

  it('preserves a changed focal point at zero and removes an unchanged zero', async () => {
    const focalPoint = { x: '0', y: '0' }
    expect((await run({ focalPoint })).req.query.uploadEdits).toEqual({ focalPoint: { x: 0, y: 0 } })
    expect((await run({ focalPoint }, { saved: { ...saved, focalX: 0, focalY: 0 } })).req.query).toEqual({
      locale: 'en',
    })
  })

  it.each([{ operation: 'create' as const }, { file: { name: 'replacement.png' } }])(
    'leaves new uploads untouched: %j',
    async (options) => {
      const edits = { widthInPixels: '100', focalPoint: { x: '0', y: '0' } }
      const { req, findByID } = await run(edits, options)
      expect(req.query.uploadEdits).toBe(edits)
      expect(findByID).not.toHaveBeenCalled()
    },
  )

  it('does not normalize away invalid or unknown edits', async () => {
    const edits = { widthInPixels: 'invalid', rotate: 90, focalPoint: { x: '', y: 50 } }
    expect((await run(edits)).req.query.uploadEdits).toEqual(edits)
  })

  it('does not bypass denied reads', async () => {
    await expect(run({ widthInPixels: 100 }, { denied: true })).rejects.toThrow('Forbidden')
  })
})
