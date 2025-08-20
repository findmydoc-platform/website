import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'

// Mock Supabase admin provisioning used by hooks
vi.mock('../../src/auth/utilities/supaBaseServer', () => ({
  createAdminClient: vi.fn(async () => ({
    auth: {
      admin: {
        createUser: vi.fn(async () => ({ data: { user: { id: 'sb-int-p1' } }, error: null })),
        deleteUser: vi.fn(async () => ({ error: null })),
      },
    },
  })),
}))

// Patient lifecycle integration
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
        initialPassword: 'Strong#12345',
      },
      overrideAccess: true,
    })

    expect(patient.id).toBeDefined()
    expect(patient.supabaseUserId).toBe('sb-int-p1')
    // Field is not persisted; Payload may return null for missing text fields
    expect((patient as any).initialPassword ?? undefined).toBeUndefined()

    await (payload as any).delete({ collection: 'patients', id: patient.id, overrideAccess: true })
  }, 20000)
})
