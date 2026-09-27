import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PayloadRequest } from 'payload'

const dependencies = vi.hoisted(() => ({
  accept: vi.fn(),
  runActive: vi.fn(),
  selectAcceptance: vi.fn(),
}))

vi.mock('@/features/transactionalEmail/payloadIntegration', () => ({
  selectTransactionalEmailCommandAcceptance: dependencies.selectAcceptance,
}))

import { submitClinicRegistration } from '@/features/clinicRegistration/service'
import { TransactionalEmailError } from '@/features/transactionalEmail/errors'

const input = {
  clinicName: 'Atomic Clinic',
  clinicWebsite: 'https://atomic-clinic.example/',
  contactFirstName: 'Ada',
  contactLastName: 'Lovelace',
  contactEmail: 'clinic@example.test',
  contactRole: 'Clinic Management' as const,
  medicalSpecialtyIds: [1, 3],
  sourceMeta: { ip: '', userAgent: 'test' },
}

describe('clinic registration service', () => {
  const create = vi.fn()
  const req = { payload: { create } } as unknown as PayloadRequest
  const transactionReq = { payload: { create }, transactionID: Promise.resolve(17) } as unknown as PayloadRequest

  beforeEach(() => {
    vi.clearAllMocks()
    create.mockResolvedValue({ id: 123 })
    dependencies.accept.mockResolvedValue({ operationId: '456' })
    dependencies.runActive.mockImplementation(async (_req, work) =>
      work(transactionReq, { accept: dependencies.accept }),
    )
    dependencies.selectAcceptance.mockReturnValue({ kind: 'active', run: dependencies.runActive })
  })

  it('uses atomic command acceptance when the email boundary is active', async () => {
    await expect(submitClinicRegistration(req, input)).resolves.toEqual({ applicationId: 123 })

    expect(dependencies.selectAcceptance).toHaveBeenCalledWith('clinic.registration-received')
    expect(dependencies.runActive).toHaveBeenCalledOnce()
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ req: transactionReq }))
    expect(dependencies.accept).toHaveBeenCalledWith({
      type: 'clinic.registration-received',
      registrationId: 123,
    })
  })

  it('preserves application-only intake while the email boundary is inactive', async () => {
    dependencies.selectAcceptance.mockReturnValue({ kind: 'inactive' })

    await expect(submitClinicRegistration(req, input)).resolves.toEqual({ applicationId: 123 })

    expect(dependencies.runActive).not.toHaveBeenCalled()
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ req }))
    expect(dependencies.accept).not.toHaveBeenCalled()
  })

  it('fails before persistence when the activation registry is malformed', async () => {
    dependencies.selectAcceptance.mockImplementation(() => {
      throw new TransactionalEmailError('environment-unavailable')
    })

    await expect(submitClinicRegistration(req, input)).rejects.toMatchObject({
      code: 'clinic-registration-unavailable',
      cause: { code: 'environment-unavailable' },
    })

    expect(create).not.toHaveBeenCalled()
    expect(dependencies.runActive).not.toHaveBeenCalled()
  })

  it('does not fall back after activated hosted acceptance fails closed', async () => {
    dependencies.runActive.mockRejectedValue(new TransactionalEmailError('environment-unavailable'))

    await expect(submitClinicRegistration(req, input)).rejects.toMatchObject({
      code: 'clinic-registration-unavailable',
      cause: { code: 'environment-unavailable' },
    })

    expect(dependencies.runActive).toHaveBeenCalledOnce()
    expect(create).not.toHaveBeenCalled()
    expect(dependencies.accept).not.toHaveBeenCalled()
  })
})
