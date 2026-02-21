import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { testSlug } from '../fixtures/testSlug'
import { upsertByStableId } from '@/endpoints/seed/utils/upsert'
import type { MedicalSpecialty } from '@/payload-types'

describe('MedicalSpecialties upsert integration', () => {
  let payload: Payload
  const slugPrefix = testSlug('medicalSpecialties.upsert.integration.test.ts')
  const createdSpecialtyIds: Array<string | number> = []

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
  })

  afterEach(async () => {
    while (createdSpecialtyIds.length) {
      const id = createdSpecialtyIds.pop()
      if (!id) continue
      try {
        await payload.delete({ collection: 'medical-specialties', id, overrideAccess: true })
      } catch {}
    }
  })

  it('does not create duplicate specialties for repeated upserts with the same stableId and name', async () => {
    const stableId = `${slugPrefix}-stable-id`
    const specialtyName = `${slugPrefix}-specialty`

    const firstRun = await upsertByStableId(payload, 'medical-specialties', {
      stableId,
      name: specialtyName,
      description: 'Initial description',
    })

    expect(firstRun.created).toBe(true)
    expect(firstRun.updated).toBe(false)

    const secondRun = await upsertByStableId(payload, 'medical-specialties', {
      stableId,
      name: specialtyName,
      description: 'Updated description',
    })

    expect(secondRun.created).toBe(false)
    expect(secondRun.updated).toBe(true)

    const byStableId = await payload.find({
      collection: 'medical-specialties',
      where: { stableId: { equals: stableId } },
      limit: 1,
      overrideAccess: true,
      depth: 0,
    })

    const updatedDoc = byStableId.docs[0] as MedicalSpecialty | undefined
    if (!updatedDoc) {
      throw new Error(`Expected specialty with stableId ${stableId}`)
    }

    createdSpecialtyIds.push(updatedDoc.id)

    const byName = await payload.find({
      collection: 'medical-specialties',
      where: { name: { equals: specialtyName } },
      limit: 10,
      overrideAccess: true,
      depth: 0,
    })

    expect(byName.docs).toHaveLength(1)
    expect(updatedDoc.description).toBe('Updated description')
  })

  it('creates a second specialty when a different stableId reuses the same name', async () => {
    const firstStableId = `${slugPrefix}-unique-name-a`
    const secondStableId = `${slugPrefix}-unique-name-b`
    const specialtyName = `${slugPrefix}-name-unique`

    const firstRun = await upsertByStableId(payload, 'medical-specialties', {
      stableId: firstStableId,
      name: specialtyName,
      description: 'Primary specialty record',
    })

    expect(firstRun.created).toBe(true)

    const firstDoc = await payload.find({
      collection: 'medical-specialties',
      where: { stableId: { equals: firstStableId } },
      limit: 1,
      overrideAccess: true,
      depth: 0,
    })

    const persisted = firstDoc.docs[0] as MedicalSpecialty | undefined
    if (!persisted) {
      throw new Error(`Expected specialty with stableId ${firstStableId}`)
    }

    createdSpecialtyIds.push(persisted.id)

    const secondRun = await upsertByStableId(payload, 'medical-specialties', {
      stableId: secondStableId,
      name: specialtyName,
      description: 'Attempted duplicate by name',
    })

    expect(secondRun.created).toBe(true)
    expect(secondRun.updated).toBe(false)

    const byName = await payload.find({
      collection: 'medical-specialties',
      where: { name: { equals: specialtyName } },
      limit: 10,
      overrideAccess: true,
      depth: 0,
    })

    expect(byName.docs).toHaveLength(2)

    const secondDoc = await payload.find({
      collection: 'medical-specialties',
      where: { stableId: { equals: secondStableId } },
      limit: 1,
      overrideAccess: true,
      depth: 0,
    })

    const secondPersisted = secondDoc.docs[0] as MedicalSpecialty | undefined
    if (!secondPersisted) {
      throw new Error(`Expected specialty with stableId ${secondStableId}`)
    }

    createdSpecialtyIds.push(secondPersisted.id)
  })
})
