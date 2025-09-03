import { vi } from 'vitest'

// Global mock for Supabase provisioning used across unit and integration tests.
// Ensures hooks don't attempt real network calls while preserving deterministic IDs.
vi.mock('@/auth/utilities/supabaseProvision', () => ({
  createSupabaseAccount: vi.fn(async () => 'sb-unit-1'),
  deleteSupabaseAccount: vi.fn(async () => true),
}))
