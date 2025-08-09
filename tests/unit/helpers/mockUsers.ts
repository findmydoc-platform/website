/**
 * Mock User Creation Functions
 *
 * Simple user mock functions for permission testing.
 * Creates user objects matching the project's user structure.
 */

/**
 * Mock user creation utilities for different user types
 */
export const mockUsers = {
  /**
   * Create a Platform Staff user
   */
  platform: (id = 1) => ({
    id,
    collection: 'basicUsers',
    userType: 'platform',
  }),

  /**
   * Create a Clinic Staff user
   */
  clinic: (id = 2, clinicId = 1) => ({
    id,
    collection: 'basicUsers',
    userType: 'clinic',
    clinicId,
  }),

  /**
   * Create a Patient user
   */
  patient: (id: string | number = 3) => ({
    id,
    collection: 'patients',
  }),

  /**
   * Create anonymous user (null)
   */
  anonymous: () => null,
}
