import { vi } from 'vitest'

// Global mock for Supabase provisioning used across unit and integration tests.
// Ensures hooks don't attempt real network calls while preserving deterministic IDs.
vi.mock('@/auth/utilities/supabaseProvision', () => ({
  inviteSupabaseAccount: vi.fn(async () => 'sb-unit-1'),
  inviteClinicSupabaseAccount: vi.fn(
    async ({ onboardingKey }: { onboardingKey: string }) => `sb-clinic-${onboardingKey}`,
  ),
  createSupabaseAccountWithPassword: vi.fn(async () => 'sb-direct-1'),
  deleteSupabaseAccount: vi.fn(async () => true),
  deleteClinicSupabaseAccount: vi.fn(async () => undefined),
  setClinicSupabaseAccountAccess: vi.fn(async () => undefined),
}))
