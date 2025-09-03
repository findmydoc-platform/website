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
      await (payload as any).delete({ collection: 'patients', where: {}, overrideAccess: true })
    } catch {}
  })

  it('creates Patient -> creates Supabase user; then deletes both', async () => {
    const patient = await (payload as any).create({
      collection: 'patients',
      data: {
        email: 'patient.integration@example.com',
        firstName: 'Pat',
        lastName: 'Ent',
        password: 'Strong#12345',
      },
      overrideAccess: true,
      req: { context: { password: 'Strong#12345' } },
    })

    expect(patient.id).toBeDefined()
    expect(patient.supabaseUserId).toBe('sb-unit-1')

    await (payload as any).delete({ collection: 'patients', id: patient.id, overrideAccess: true })
  }, 20000)
})
