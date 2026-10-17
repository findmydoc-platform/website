import { describe, expect, it, vi } from 'vitest'
import type { PayloadRequest } from 'payload'
import { guardDoctorOperation, verifyDoctorOperation } from '@/features/doctorProfiles/authorization'

const record = { id: 7, doctor: null, clinic: null }
function request(collection?: string): PayloadRequest {
  return {
    user: collection ? { id: 2, collection } : undefined,
    context: {},
    transactionID: Promise.resolve('native-owner'),
    payload: {
      db: { sessions: { 'native-owner': {} } },
      find: vi.fn(async () => ({ docs: [record], hasNextPage: false })),
    },
  } as unknown as PayloadRequest
}
const operation = (req: PayloadRequest, kind = 'delete') =>
  guardDoctorOperation({ req, collection: { slug: 'doctorMedia' }, operation: kind, args: { id: 7 } })
describe('Native doctor media orphan cleanup', () => {
  it.each([undefined, 'platformStaff'])('allows only source cleanup with native ownership for %s', async (actor) => {
    const req = request(actor)
    await expect(operation(req)).resolves.toBeUndefined()
    await expect(
      verifyDoctorOperation({ req, collection: { slug: 'doctorMedia' }, operation: 'delete', result: record }),
    ).resolves.toEqual(record)
  })
  it.each(['clinicStaff', 'patients'])('denies orphan cleanup for %s even with access override', async (actor) => {
    await expect(operation(request(actor))).rejects.toMatchObject({ status: 403 })
  })
  it('denies a target-bound cleanup even for platform staff', async () => {
    const req = request('platformStaff')
    req.routeParams = { clinicId: '11' }
    await expect(operation(req)).rejects.toMatchObject({ status: 403 })
  })
  it('requires the active native transaction for orphan cleanup', async () => {
    const req = request('platformStaff')
    req.transactionID = undefined
    await expect(operation(req)).rejects.toThrow(/active native transaction/)
  })
  it('preserves immutable doctor ownership before resolving an incoming owner', async () => {
    const req = request('platformStaff')
    req.payload.find = vi.fn(async () => ({
      docs: [{ id: 7, doctor: 41, clinic: 11 }],
      hasNextPage: false,
    })) as unknown as typeof req.payload.find
    req.payload.findByID = vi.fn()
    await expect(
      guardDoctorOperation({
        req,
        collection: { slug: 'doctorMedia' },
        operation: 'update',
        args: { id: 7, data: { doctor: 42 } },
      }),
    ).rejects.toThrow(/Doctor ownership/)
    expect(req.payload.findByID).not.toHaveBeenCalled()
  })
  it.each(['create', 'update'])('never turns orphan cleanup into %s authorization', async (kind) => {
    await expect(operation(request('platformStaff'), kind)).rejects.toMatchObject({ status: 403 })
  })
})
