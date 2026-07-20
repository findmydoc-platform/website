import { beforeEach, describe, expect, it, vi } from 'vitest'
import { provisionApprovedClinicApplication } from '@/hooks/clinicApplicationProvisioning'
import type { ClinicApplication } from '@/payload-types'

const onboardingMocks = vi.hoisted(() => ({
  provisionClinicOnboarding: vi.fn(),
}))

vi.mock('@/features/clinicOnboarding/provisionClinicOnboarding', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/clinicOnboarding/provisionClinicOnboarding')>()),
  provisionClinicOnboarding: onboardingMocks.provisionClinicOnboarding,
}))

const application = (overrides: Partial<ClinicApplication> = {}): ClinicApplication => ({
  id: 42,
  clinicName: 'Example Clinic',
  clinicWebsite: 'https://clinic.example',
  contactFirstName: 'Ada',
  contactLastName: 'Lovelace',
  contactEmail: 'clinic@example.com',
  contactRole: 'Clinic Management',
  medicalSpecialties: [1],
  status: 'approved',
  provisioningStatus: 'not_started',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
})

const request = () => ({
  context: {},
  payload: {
    logger: {
      debug: vi.fn(),
      error: vi.fn(),
      fatal: vi.fn(),
      info: vi.fn(),
      level: 'info',
      trace: vi.fn(),
      warn: vi.fn(),
    },
    update: vi.fn().mockResolvedValue({}),
  },
})

describe('provisionApprovedClinicApplication', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    onboardingMocks.provisionClinicOnboarding.mockResolvedValue({ clinicId: 8, clinicStaffId: 4 })
  })

  it('does not materialize a historical approved application on an unrelated edit', async () => {
    const req = request()
    const doc = application()

    await provisionApprovedClinicApplication({ doc, previousDoc: application(), req } as never)

    expect(onboardingMocks.provisionClinicOnboarding).not.toHaveBeenCalled()
    expect(req.payload.update).not.toHaveBeenCalled()
  })

  it('materializes an application when it transitions into approved', async () => {
    const req = request()
    const doc = application()

    await provisionApprovedClinicApplication({
      doc,
      previousDoc: application({ status: 'submitted' }),
      req,
    } as never)

    expect(onboardingMocks.provisionClinicOnboarding).toHaveBeenCalledWith(
      req.payload,
      expect.objectContaining({ onboardingKey: 'clinic-application:42' }),
    )
    expect(req.payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          provisioningErrorCode: null,
          provisioningStatus: 'completed',
        }),
      }),
    )
  })

  it('does not retry a failed approved application after an unrelated edit', async () => {
    const req = request()
    const previousDoc = application({ provisioningStatus: 'failed', provisioningErrorCode: 'auth_failed' })
    const doc = application({
      provisioningStatus: 'failed',
      provisioningErrorCode: 'auth_failed',
      reviewNotes: 'Reviewed again.',
    })

    await provisionApprovedClinicApplication({ doc, previousDoc, req } as never)

    expect(onboardingMocks.provisionClinicOnboarding).not.toHaveBeenCalled()
  })

  it('retries a failed approved application after a provisioning input changes', async () => {
    const req = request()
    const previousDoc = application({ provisioningStatus: 'failed', provisioningErrorCode: 'auth_failed' })
    const doc = application({
      provisioningStatus: 'failed',
      provisioningErrorCode: 'auth_failed',
      contactEmail: 'updated@example.com',
    })

    await provisionApprovedClinicApplication({ doc, previousDoc, req } as never)

    expect(onboardingMocks.provisionClinicOnboarding).toHaveBeenCalledOnce()
  })
})
