import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createLocalReq, getPayload, type Payload, type PayloadRequest } from 'payload'
import config from '@payload-config'
import { importCollection } from '@/endpoints/seed/utils/import-collection'
import { demoPlan } from '@/endpoints/seed/utils/plan'
import { createStableIdResolvers } from '@/endpoints/seed/utils/resolvers'
import { changeClinicGroup } from '@/features/clinicGroups/membership'
import { replaceClinicStaffAssignment } from '@/features/clinicGroups/staffAssignments'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import {
  asClinicScopedPayloadUser,
  asPayloadStaffUser,
  cleanupTrackedUsers,
  createClinicTestUser,
  createPlatformTestUser,
} from '../fixtures/testUsers'
import { testSlug } from '../fixtures/testSlug'

const relationId = (value: unknown): number | null =>
  typeof value === 'number' ? value : value && typeof value === 'object' && 'id' in value ? Number(value.id) : null
const ownClinic = 'seed-clinic-izmir-coast'

describe('native group-access seed preservation', () => {
  let payload: Payload
  let operator: PayloadRequest
  const staffIds: Array<number | string> = []
  const prefix = testSlug('clinicGroupSeeds.lifecycle.test.ts')
  const readId = async (collection: 'clinicGroups' | 'clinics', stableId: string) =>
    (
      await payload.find({
        collection,
        where: { stableId: { equals: stableId } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
    ).docs[0]!.id
  const seed = async (collection: 'clinicGroups' | 'clinics', stableIds?: string[]) => {
    const step = demoPlan.find((step) => step.kind === 'collection' && step.collection === collection)!
    if (step.kind !== 'collection') throw new Error('Missing collection seed')
    const callerState = {
      transactionID: operator.transactionID,
      payloadDataLoader: operator.payloadDataLoader,
      context: operator.context,
      user: operator.user,
    }
    const result = await importCollection({
      payload,
      kind: 'demo',
      collection,
      fileName: step.fileName,
      mapping: step.mapping,
      upsertPolicy: step.upsertPolicy,
      stableIds,
      resolvers: createStableIdResolvers(payload),
      req: operator,
    })
    expect(operator.transactionID).toBe(callerState.transactionID)
    expect(operator.payloadDataLoader).toBe(callerState.payloadDataLoader)
    expect(operator.context).toBe(callerState.context)
    expect(operator.user).toBe(callerState.user)
    return result
  }
  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
    operator = await createLocalReq(
      {
        user: asPayloadStaffUser(
          await createPlatformTestUser(payload, { emailPrefix: prefix, createdStaffIds: staffIds }),
        ),
      },
      payload,
    )
    expect((await seed('clinicGroups')).failures).toEqual([])
    expect((await seed('clinics', [ownClinic, 'seed-clinic-istanbul-bosphorus'])).failures).toEqual([])
  }, 60_000)
  afterAll(async () => {
    try {
      await cleanupTrackedUsers(payload, { staffIds })
    } finally {
      await payload?.db.destroy?.()
    }
  })

  it('reuses stable groups and clinics without changing a protected activated principal', async () => {
    const groupId = await readId('clinicGroups', 'seed-group-coastal')
    const clinicId = await readId('clinics', ownClinic)
    const person = await asClinicScopedPayloadUser(
      payload,
      await createClinicTestUser(payload, { emailPrefix: `${prefix}-manager`, createdStaffIds: staffIds }),
      clinicId,
    )
    await replaceClinicStaffAssignment(operator, Number(person.id), { scope: 'group', groupId })
    const before = await payload.findByID({
      collection: 'clinicStaff',
      id: Number(person.id),
      depth: 0,
      overrideAccess: true,
    })
    const repeatedGroups = await seed('clinicGroups')
    expect(repeatedGroups).toMatchObject({ created: 0, updated: 0, failures: [] })
    expect((await seed('clinics', [ownClinic, 'seed-clinic-istanbul-bosphorus'])).failures).toEqual([])
    expect(await readId('clinicGroups', 'seed-group-coastal')).toBe(groupId)
    expect(await readId('clinics', ownClinic)).toBe(clinicId)
    const after = await payload.findByID({
      collection: 'clinicStaff',
      id: Number(person.id),
      depth: 0,
      overrideAccess: true,
    })
    expect(after).toEqual(before)
    const unpublished = await payload.findByID({
      collection: 'clinics',
      id: await readId('clinics', 'seed-clinic-istanbul-bosphorus'),
      depth: 0,
      overrideAccess: true,
    })
    expect(unpublished).toMatchObject({ status: 'pending', participationStatus: 'approved' })
  })

  it('reports a moved membership without silently restoring or clearing its current group', async () => {
    const clinicId = await readId('clinics', ownClinic)
    const fromGroupId = await readId('clinicGroups', 'seed-group-coastal')
    const toGroupId = await readId('clinicGroups', 'seed-group-capital')
    try {
      await changeClinicGroup(operator, clinicId, { fromGroupId, toGroupId })
      const result = await seed('clinics', [ownClinic])
      expect(result).toMatchObject({ created: 0, updated: 0 })
      expect(result.failures).toHaveLength(1)
      expect(
        relationId(
          (await payload.findByID({ collection: 'clinics', id: clinicId, depth: 0, overrideAccess: true })).group,
        ),
      ).toBe(toGroupId)
    } finally {
      const current = await payload.findByID({ collection: 'clinics', id: clinicId, depth: 0, overrideAccess: true })
      if (relationId(current.group) === toGroupId)
        await changeClinicGroup(operator, clinicId, { fromGroupId: toGroupId, toGroupId: fromGroupId })
    }
  })
})
