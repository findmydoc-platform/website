import { vi } from 'vitest'

/**
 * Global mock for Next.js cache revalidation APIs.
 *
 * In test environments (Vitest), Next.js's static generation store is not available,
 * causing revalidateTag and revalidatePath to throw "Invariant: static generation store missing".
 *
 * This mock provides no-op implementations for tests while preserving the real behavior
 * in development and production environments.
 *
 * Production hooks remain unchanged - they call these functions normally at runtime.
 */
vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(() => undefined),
  revalidatePath: vi.fn(() => undefined),
  unstable_cache: vi.fn((fn) => fn), // Pass-through for caching functions
}))
