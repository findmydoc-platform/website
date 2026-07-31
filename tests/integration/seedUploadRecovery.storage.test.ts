import { randomUUID } from 'crypto'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'

import config from '@payload-config'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { cleanupTrackedDocs } from '../fixtures/cleanupTrackedDocs'
import { createTinyPngFile } from '../fixtures/mediaFile'
import { testSlug } from '../fixtures/testSlug'
import { upsertByStableId } from '@/endpoints/seed/utils/upsert'
import { resolveS3StorageConfig } from '@/plugins/storageConfig'
import type { PlatformContentMedia, PlatformStaff, UserProfileMedia } from '@/payload-types'

const storageConfig = resolveS3StorageConfig({ DEPLOYMENT_ENV: 'test' })
const slugPrefix = testSlug('seedUploadRecovery.storage.test.ts')

const storageObjectUrl = (storagePath: string): string =>
  new URL(`${storageConfig.bucket}/${storagePath}`, `${storageConfig.clientConfig.endpoint}/`).toString()

describe('seed upload recovery with Payload and S3Mock', () => {
  let payload: Payload
  const createdPlatformMediaIds: Array<number | string> = []
  const createdProfileMediaIds: Array<number | string> = []
  const createdPlatformStaffIds: Array<number | string> = []
  const trashedPlatformMediaIds: Array<number | string> = []
  const temporaryDirectories = new Set<string>()

  const createPlatformStaff = async (suffix: string): Promise<PlatformStaff> => {
    const staff = (await payload.create({
      collection: 'platformStaff',
      data: {
        email: `${slugPrefix}-${suffix}-${randomUUID()}@findmydoc.eu`,
        firstName: 'Seed',
        lastName: `Recovery-${suffix}`,
        role: 'support',
        supabaseUserId: `${slugPrefix}-${suffix}-${randomUUID()}`,
      },
      context: { trustedPlatformStaffOps: true },
      depth: 0,
      overrideAccess: true,
    })) as PlatformStaff

    createdPlatformStaffIds.push(staff.id)
    return staff
  }

  const createSourceFile = (suffix: string): { bytes: Buffer; filePath: string } => {
    const directoryPath = fs.mkdtempSync(path.join(os.tmpdir(), 'findmydoc-seed-storage-'))
    temporaryDirectories.add(directoryPath)

    const file = createTinyPngFile(`${slugPrefix}-${suffix}-${randomUUID()}.png`)
    const filePath = path.join(directoryPath, file.name)
    fs.writeFileSync(filePath, file.data)

    return { bytes: file.data, filePath }
  }

  const findPlatformMedia = async (stableId: string): Promise<PlatformContentMedia> => {
    const result = await payload.find({
      collection: 'platformContentMedia',
      depth: 0,
      limit: 1,
      overrideAccess: true,
      trash: true,
      where: { stableId: { equals: stableId } },
    })
    const media = result.docs[0] as PlatformContentMedia | undefined
    if (!media) throw new Error(`Expected platform media for stable ID ${stableId}`)
    return media
  }

  const findProfileMedia = async (stableId: string): Promise<UserProfileMedia> => {
    const result = await payload.find({
      collection: 'userProfileMedia',
      depth: 0,
      limit: 1,
      overrideAccess: true,
      trash: true,
      where: { stableId: { equals: stableId } },
    })
    const media = result.docs[0] as UserProfileMedia | undefined
    if (!media) throw new Error(`Expected profile media for stable ID ${stableId}`)
    return media
  }

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
  }, 60000)

  afterEach(async () => {
    await cleanupTrackedDocs(payload, [
      { collection: 'platformContentMedia', ids: createdPlatformMediaIds },
      { collection: 'userProfileMedia', ids: createdProfileMediaIds },
    ])

    while (trashedPlatformMediaIds.length > 0) {
      const id = trashedPlatformMediaIds.pop()
      if (id === undefined) continue
      await payload.delete({
        collection: 'platformContentMedia',
        context: { disableRevalidate: true },
        id,
        overrideAccess: true,
        trash: true,
      })
    }

    await cleanupTrackedDocs(payload, [{ collection: 'platformStaff', ids: createdPlatformStaffIds }])

    for (const directoryPath of temporaryDirectories) {
      fs.rmSync(directoryPath, { force: true, recursive: true })
    }
    temporaryDirectories.clear()
  })

  it('recovers a platform upload after its S3 object was removed externally', async () => {
    const owner = await createPlatformStaff('missing-object')
    const source = createSourceFile('missing-object')
    const stableId = randomUUID()
    const data = {
      alt: 'Recovered seed media',
      createdBy: owner.id,
      stableId,
    }

    await upsertByStableId(payload, 'platformContentMedia', data, { filePath: source.filePath })
    const initial = await findPlatformMedia(stableId)
    createdPlatformMediaIds.push(initial.id)

    expect(Buffer.from(await (await fetch(storageObjectUrl(initial.storagePath))).arrayBuffer())).toEqual(source.bytes)

    const externalDelete = await fetch(storageObjectUrl(initial.storagePath), { method: 'DELETE' })
    expect(externalDelete.ok).toBe(true)
    expect((await fetch(storageObjectUrl(initial.storagePath))).status).toBe(404)

    const result = await upsertByStableId(payload, 'platformContentMedia', data, { filePath: source.filePath })
    const recovered = await findPlatformMedia(stableId)

    expect(result).toEqual({ created: false, updated: true })
    expect(recovered.id).toBe(initial.id)
    expect(recovered.filename).toBe(recovered.storagePath.replace(/^platform\//, ''))
    const recoveredObject = await fetch(storageObjectUrl(recovered.storagePath))
    expect(recoveredObject.status).toBe(200)
    expect(Buffer.from(await recoveredObject.arrayBuffer())).toEqual(source.bytes)
  })

  it('frees a trashed filename through Payload before retrying the seed upload', async () => {
    const owner = await createPlatformStaff('trashed-filename')
    const source = createSourceFile('trashed-filename')
    const trashedStableId = randomUUID()

    await upsertByStableId(
      payload,
      'platformContentMedia',
      {
        alt: 'Trashed seed media',
        createdBy: owner.id,
        stableId: trashedStableId,
      },
      { filePath: source.filePath },
    )

    const trashed = await findPlatformMedia(trashedStableId)
    await payload.update({
      collection: 'platformContentMedia',
      context: { disableRevalidate: true },
      data: { deletedAt: new Date().toISOString() },
      id: trashed.id,
      overrideAccess: true,
    })
    trashedPlatformMediaIds.push(trashed.id)

    const replacementStableId = randomUUID()
    const result = await upsertByStableId(
      payload,
      'platformContentMedia',
      {
        alt: 'Replacement seed media',
        createdBy: owner.id,
        stableId: replacementStableId,
      },
      { filePath: source.filePath },
    )
    const replacement = await findPlatformMedia(replacementStableId)
    createdPlatformMediaIds.push(replacement.id)

    const clearedTrash = (await payload.findByID({
      collection: 'platformContentMedia',
      id: trashed.id,
      overrideAccess: true,
      trash: true,
    })) as PlatformContentMedia

    expect(result).toEqual({ created: true, updated: false })
    expect(clearedTrash.deletedAt).toBeTruthy()
    expect(clearedTrash.filename).toBeNull()
    expect(Buffer.from(await (await fetch(storageObjectUrl(replacement.storagePath))).arrayBuffer())).toEqual(
      source.bytes,
    )
  })

  it('recreates owner-bound media through Payload and removes the previous object', async () => {
    const originalOwner = await createPlatformStaff('relation-original')
    const replacementOwner = await createPlatformStaff('relation-replacement')
    const source = createSourceFile('relation-drift')
    const stableId = randomUUID()

    await upsertByStableId(
      payload,
      'userProfileMedia',
      {
        alt: 'Original profile media',
        createdBy: { relationTo: 'platformStaff', value: originalOwner.id },
        stableId,
        user: { relationTo: 'platformStaff', value: originalOwner.id },
      },
      { filePath: source.filePath },
    )

    const original = await findProfileMedia(stableId)
    expect((await fetch(storageObjectUrl(original.storagePath))).status).toBe(200)

    const result = await upsertByStableId(
      payload,
      'userProfileMedia',
      {
        alt: 'Replacement profile media',
        createdBy: { relationTo: 'platformStaff', value: replacementOwner.id },
        stableId,
        user: { relationTo: 'platformStaff', value: replacementOwner.id },
      },
      {
        filePath: source.filePath,
        policy: { recreateUploadOnRelationDrift: ['user', 'createdBy'] },
      },
    )
    const replacement = await findProfileMedia(stableId)
    createdProfileMediaIds.push(replacement.id)

    expect(result).toEqual({ created: false, updated: true })
    expect(replacement.id).not.toBe(original.id)
    expect((await fetch(storageObjectUrl(original.storagePath))).status).toBe(404)
    expect(Buffer.from(await (await fetch(storageObjectUrl(replacement.storagePath))).arrayBuffer())).toEqual(
      source.bytes,
    )
  })
})
