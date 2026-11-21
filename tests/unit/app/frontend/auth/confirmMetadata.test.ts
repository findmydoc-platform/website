import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createSiteMetadata: vi.fn((args: unknown) => args),
  recoveryConfirmationCopy: vi.fn(),
  recoveryMetadataTitle: vi.fn(async () => 'Recovery confirmation'),
  patientVerificationCopy: vi.fn(),
  patientVerificationMetadataTitle: vi.fn(async () => 'Verify your email'),
}))

vi.mock('@/utilities/generateMeta', () => ({
  createSiteMetadata: mocks.createSiteMetadata,
}))

vi.mock('@/features/uiCopy/passwordRecovery', () => ({
  recoveryConfirmationCopy: mocks.recoveryConfirmationCopy,
  recoveryMetadataTitle: mocks.recoveryMetadataTitle,
}))

vi.mock('@/features/uiCopy/patientVerification', () => ({
  patientVerificationCopy: mocks.patientVerificationCopy,
  patientVerificationMetadataTitle: mocks.patientVerificationMetadataTitle,
}))

vi.mock('@/features/transactionalEmail/environment', () => ({
  resolveTransactionalEmailEnvironment: vi.fn(),
}))

vi.mock('@/auth/actions/verificationConfiguration', () => ({
  resolveVerificationKeys: vi.fn(),
}))

vi.mock('@/auth/actions/patientVerificationContext', () => ({
  PATIENT_VERIFICATION_COOKIE: 'patient-verification',
  readPatientVerificationContext: vi.fn(),
}))

vi.mock('@/auth/actions/patientVerificationCompletion', () => ({
  patientVerificationAuthority: vi.fn(),
}))

vi.mock('@/auth/actions/recoveryConfiguration', () => ({
  resolveRecoveryKeys: vi.fn(),
}))

vi.mock('@/auth/actions/websiteRecoveryContext', () => ({
  readWebsiteRecoveryContext: vi.fn(),
  WEBSITE_RECOVERY_COOKIE: 'website-recovery',
}))

vi.mock('@/app/(frontend)/_components/PublicAuthRouteShell', () => ({
  PublicAuthRouteShell: () => null,
}))

vi.mock('@/app/(frontend)/auth/confirm/ConfirmTokenHashForm', () => ({
  ConfirmTokenHashForm: () => null,
}))

vi.mock('@/app/(frontend)/auth/confirm/PatientVerificationForm', () => ({
  PatientVerificationForm: () => null,
}))

vi.mock('@/app/(frontend)/auth/confirm/RecoveryConfirmationForm', () => ({
  RecoveryConfirmationForm: () => null,
}))

describe('confirm auth metadata', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it.each([
    ['de', '/auth/confirm'],
    ['en', '/auth/en/confirm'],
  ] as const)('uses the %s confirmation route as canonical metadata', async (locale, path) => {
    const { confirmMetadata } = await import('@/app/(frontend)/auth/confirm/ConfirmAuthLinkPage')

    await confirmMetadata({ searchParams: Promise.resolve({ type: 'recovery' }) }, locale)

    expect(mocks.createSiteMetadata).toHaveBeenCalledWith({
      title: 'Recovery confirmation',
      path,
    })
  })
})
