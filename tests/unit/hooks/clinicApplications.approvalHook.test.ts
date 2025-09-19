import { describe, test, expect, vi, beforeEach } from 'vitest'
import { ClinicApplications } from '@/collections/ClinicApplications'
import { createMockPayload } from '../helpers/testHelpers'

// Helper to extract the afterChange hook we added
const afterChange = (ClinicApplications.hooks?.afterChange || [])[0] as any

describe('clinicApplications approval hook', () => {
  beforeEach(() => vi.clearAllMocks())

  test('provisions artifacts on first approval (at least basic user created)', async () => {
    const payload = createMockPayload()
    payload.create
      .mockImplementationOnce(async (args) => {
        expect(args.collection).toBe('basicUsers')
        return { id: 10 }
      })
      .mockImplementationOnce(async (args) => {
        expect(args.collection).toBe('clinics')
        return { id: 20 }
      })
      .mockImplementationOnce(async (args) => {
        expect(args.collection).toBe('clinicStaff')
        return { id: 30 }
      })
    payload.update.mockResolvedValue({})

    const doc = {
      id: 1,
      status: 'approved',
      clinicName: 'Test Clinic',
      contactEmail: 'c@example.com',
      contactFirstName: 'A',
      contactLastName: 'B',
      address: { city: 'Istanbul', street: 'Main', houseNumber: '1', zipCode: 12345, country: 'Turkey' },
      createdArtifacts: {},
    }
    const previousDoc = { id: 1, status: 'submitted' }

    await afterChange({ doc, previousDoc, operation: 'update', req: { payload } })

    expect(payload.create).toHaveBeenCalledTimes(1)
    const firstCallArgs = payload.create.mock.calls[0]?.[0]
    expect(firstCallArgs?.collection).toBe('basicUsers')
  })

  test('idempotent second approval', async () => {
    const payload = createMockPayload()
    const doc = { id: 1, status: 'approved', createdArtifacts: { clinic: 99 } }
    const previousDoc = { id: 1, status: 'submitted' }

    await afterChange({ doc, previousDoc, operation: 'update', req: { payload } })
    expect(payload.create).not.toHaveBeenCalled()
  })
})
