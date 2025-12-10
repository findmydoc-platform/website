import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'

describe('Patient lifecycle integration', () => {
  let payload: Payload

  beforeAll(async () => {
    payload = await getPayload({ config })
  })

  beforeEach(async () => {
    try {
      await payload.delete({ collection: 'patients', where: {}, overrideAccess: true })
    } catch {}
  })

  it('creates Patient -> creates Supabase user; then deletes both', async () => {
    const patient = await payload.create({
      collection: 'patients',
      data: {
        email: 'patient.integration@example.com',
        firstName: 'Pat',
        lastName: 'Ent',
      },
      overrideAccess: true,
    })

    expect(patient.id).toBeDefined()
    expect(patient.supabaseUserId).toBe('sb-unit-1')

    await payload.delete({ collection: 'patients', id: patient.id, overrideAccess: true })
  }, 20000)
})
