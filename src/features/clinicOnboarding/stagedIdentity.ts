import { createHash } from 'node:crypto'

type OnboardingIdentity = { onboardingKey: string; provisioningIdentity: string }

export function getStagedOnboardingIdentity(applicationId: number): OnboardingIdentity {
  const onboardingKey = `clinic-application:${applicationId}`
  return { onboardingKey, provisioningIdentity: createHash('sha256').update(onboardingKey).digest('hex') }
}

export function getStagedOnboardingApplicationId(onboardingKey?: string | null): number | undefined {
  const applicationId = Number(/^clinic-application:([1-9]\d*)$/u.exec(onboardingKey ?? '')?.[1])
  return Number.isSafeInteger(applicationId) ? applicationId : undefined
}

export function matchesStagedOnboardingIdentity(
  record: { onboardingKey?: string | null; provisioningIdentity?: string | null },
  identity: OnboardingIdentity,
) {
  return (
    record.onboardingKey === identity.onboardingKey && record.provisioningIdentity === identity.provisioningIdentity
  )
}
