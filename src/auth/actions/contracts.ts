export const authActionTypes = [
  'patient-verification',
  'clinic-invitation',
  'patient-recovery',
  'clinic-recovery',
  'platform-recovery',
] as const
export const authActionEnvironments = ['local', 'test', 'ci', 'preview', 'production'] as const
export const authActionStates = [
  'pending',
  'active',
  'confirmed',
  'completed',
  'superseded',
  'expired',
  'revoked',
] as const
export const terminalAuthActionStates = ['completed', 'superseded', 'expired', 'revoked'] as const
export const authActionOutcomes = ['ineligible', 'source-unavailable', 'recipient-changed', 'superseded'] as const
export const authActionDiagnosticFields = [
  'id',
  'actionType',
  'environment',
  'state',
  'createdAt',
  'updatedAt',
  'expiresAt',
  'terminalAt',
  'outcomeCode',
] as const
export const authActionRetentionMs = 42 * 86400000

const verificationLifetime = 24 * 60 * 60 * 1000
const recoveryLifetime = 60 * 60 * 1000
export const authActionPolicies = {
  'patient-verification': {
    principalCollection: 'patients',
    callbackDestination: 'website-auth-callback',
    supabaseTokenType: 'magiclink',
    completionRoute: '/patient/inquiries',
    finalDestination: 'patient-inquiries',
    lifetime: verificationLifetime,
  },
  'clinic-invitation': {
    principalCollection: 'clinicStaff',
    callbackDestination: 'clinic-dashboard-auth-callback',
    supabaseTokenType: 'invite',
    completionRoute: '/auth/invite/complete',
    finalDestination: 'clinic-dashboard',
    lifetime: verificationLifetime,
  },
  'patient-recovery': {
    principalCollection: 'patients',
    callbackDestination: 'website-auth-callback',
    supabaseTokenType: 'recovery',
    completionRoute: '/auth/password/reset/complete',
    finalDestination: 'patient-inquiries',
    lifetime: recoveryLifetime,
  },
  'clinic-recovery': {
    principalCollection: 'clinicStaff',
    callbackDestination: 'clinic-dashboard-auth-callback',
    supabaseTokenType: 'recovery',
    completionRoute: '/auth/password/reset/complete',
    finalDestination: 'clinic-dashboard',
    lifetime: recoveryLifetime,
  },
  'platform-recovery': {
    principalCollection: 'platformStaff',
    callbackDestination: 'website-auth-callback',
    supabaseTokenType: 'recovery',
    completionRoute: '/auth/password/reset/complete',
    finalDestination: 'platform-administration',
    lifetime: recoveryLifetime,
  },
} as const

export const authActionTransitions: Record<
  (typeof authActionStates)[number],
  readonly (typeof authActionStates)[number][]
> = {
  pending: ['active', 'superseded', 'expired', 'revoked'],
  active: ['confirmed', 'superseded', 'expired', 'revoked'],
  confirmed: ['completed', 'expired', 'revoked'],
  completed: [],
  superseded: [],
  expired: [],
  revoked: [],
}
