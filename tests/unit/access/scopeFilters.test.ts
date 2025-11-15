/**
 * Unit Tests for Scope Filter Functions
 *
 * Tests all scope-based access control filters that implement
 * the permission matrix logic for clinic and patient resources.
 */

import { describe, it, beforeEach, vi } from 'vitest'
import { createAccessArgs, expectAccess, clearAllMocks } from '../helpers/testHelpers'
import { mockUsers } from '../helpers/mockUsers'

// Import all scope filter functions
import {
  platformOrOwnClinicResource,
  platformOrOwnPatientResource,
  platformOrOwnClinicProfile,
  ownResourceOnly,
  platformOrOwnClinicDoctorResource,
  platformOnlyOrPublished,
  platformOnlyOrApproved,
  platformOnlyOrApprovedReviews,
} from '@/access/scopeFilters'

// Mock the utility function
vi.mock('@/access/utils/getClinicAssignment', () => ({
  getUserAssignedClinicId: vi.fn(),
}))

// Import the mocked function so we can control its return value
import { getUserAssignedClinicId } from '@/access/utils/getClinicAssignment'
const mockGetUserAssignedClinicId = getUserAssignedClinicId as any

describe('Scope Filter Functions', () => {
  beforeEach(() => {
    clearAllMocks()
    mockGetUserAssignedClinicId.mockReset()
  })

  describe('platformOrOwnClinicResource', () => {
    it('Platform Staff gets full access (returns true)', async () => {
      const result = await platformOrOwnClinicResource(createAccessArgs(mockUsers.platform()))
      expectAccess.full(result)
    })

    it('Clinic Staff gets scoped access (returns clinic filter)', async () => {
      // Mock clinic assignment
      mockGetUserAssignedClinicId.mockResolvedValue('clinic-123')

      const result = await platformOrOwnClinicResource(createAccessArgs(mockUsers.clinic()))
      expectAccess.scoped(result, {
        clinic: {
          equals: 'clinic-123',
        },
      })
    })

    it('Clinic Staff without clinic assignment gets no access', async () => {
      // Mock no clinic assignment
      mockGetUserAssignedClinicId.mockResolvedValue(null)

      const result = await platformOrOwnClinicResource(createAccessArgs(mockUsers.clinic()))
      expectAccess.none(result)
    })

    it('Patient gets no access (returns false)', async () => {
      const result = await platformOrOwnClinicResource(createAccessArgs(mockUsers.patient()))
      expectAccess.none(result)
    })

    it('Anonymous gets no access (returns false)', async () => {
      const result = await platformOrOwnClinicResource(createAccessArgs(mockUsers.anonymous()))
      expectAccess.none(result)
    })
  })

  describe('platformOrOwnPatientResource', () => {
    it('Platform Staff gets full access', async () => {
      const result = await platformOrOwnPatientResource(createAccessArgs(mockUsers.platform()))
      expectAccess.full(result)
    })

    it('Patient gets own resource access only', async () => {
      const patientUser = mockUsers.patient(123)
      const result = await platformOrOwnPatientResource(createAccessArgs(patientUser))
      expectAccess.scoped(result, {
        patient: {
          equals: 123,
        },
      })
    })

    it('Clinic Staff gets no access', async () => {
      const result = await platformOrOwnPatientResource(createAccessArgs(mockUsers.clinic()))
      expectAccess.none(result)
    })

    it('Anonymous gets no access', async () => {
      const result = await platformOrOwnPatientResource(createAccessArgs(mockUsers.anonymous()))
      expectAccess.none(result)
    })
  })

  describe('platformOrOwnClinicProfile', () => {
    it('Platform Staff gets full access', async () => {
      const result = await platformOrOwnClinicProfile(createAccessArgs(mockUsers.platform()))
      expectAccess.full(result)
    })

    it('Clinic Staff gets own clinic profile access only', async () => {
      // Mock clinic assignment
      mockGetUserAssignedClinicId.mockResolvedValue('clinic-456')

      const result = await platformOrOwnClinicProfile(createAccessArgs(mockUsers.clinic()))
      expectAccess.scoped(result, {
        id: {
          equals: 'clinic-456',
        },
      })
    })

    it('Clinic Staff without clinic assignment gets no access', async () => {
      // Mock no clinic assignment
      mockGetUserAssignedClinicId.mockResolvedValue(null)

      const result = await platformOrOwnClinicProfile(createAccessArgs(mockUsers.clinic()))
      expectAccess.none(result)
    })

    it('Patient gets no access', async () => {
      const result = await platformOrOwnClinicProfile(createAccessArgs(mockUsers.patient()))
      expectAccess.none(result)
    })

    it('Anonymous gets no access', async () => {
      const result = await platformOrOwnClinicProfile(createAccessArgs(mockUsers.anonymous()))
      expectAccess.none(result)
    })
  })

  describe('ownResourceOnly', () => {
    it('User gets access to own resources only', () => {
      const user = mockUsers.platform(789)
      const result = ownResourceOnly(createAccessArgs(user))
      expectAccess.scoped(result, {
        user: {
          equals: 789,
        },
      })
    })

    it('Different user types can access own resources', () => {
      const clinicUser = mockUsers.clinic(456)
      const result = ownResourceOnly(createAccessArgs(clinicUser))
      expectAccess.scoped(result, {
        user: {
          equals: 456,
        },
      })
    })

    it('Anonymous gets no access', () => {
      const result = ownResourceOnly(createAccessArgs(mockUsers.anonymous()))
      expectAccess.none(result)
    })

    it('Null user gets no access', () => {
      const result = ownResourceOnly(createAccessArgs(null))
      expectAccess.none(result)
    })
  })

  describe('platformOrOwnClinicDoctorResource', () => {
    it('Platform Staff gets full access', async () => {
      const result = await platformOrOwnClinicDoctorResource(createAccessArgs(mockUsers.platform()))
      expectAccess.full(result)
    })

    it('Clinic Staff gets doctors from own clinic only', async () => {
      // Mock clinic assignment
      mockGetUserAssignedClinicId.mockResolvedValue('clinic-789')

      const result = await platformOrOwnClinicDoctorResource(createAccessArgs(mockUsers.clinic()))
      expectAccess.scoped(result, {
        'doctor.clinic': {
          equals: 'clinic-789',
        },
      })
    })

    it('Clinic Staff without clinic assignment gets no access', async () => {
      // Mock no clinic assignment
      mockGetUserAssignedClinicId.mockResolvedValue(null)

      const result = await platformOrOwnClinicDoctorResource(createAccessArgs(mockUsers.clinic()))
      expectAccess.none(result)
    })

    it('Patient gets no access', async () => {
      const result = await platformOrOwnClinicDoctorResource(createAccessArgs(mockUsers.patient()))
      expectAccess.none(result)
    })

    it('Anonymous gets no access', async () => {
      const result = await platformOrOwnClinicDoctorResource(createAccessArgs(mockUsers.anonymous()))
      expectAccess.none(result)
    })
  })

  describe('platformOnlyOrPublished', () => {
    it('Platform Staff gets full access to all content', () => {
      const result = platformOnlyOrPublished(createAccessArgs(mockUsers.platform()))
      expectAccess.full(result)
    })

    it('Clinic Staff gets published content only', () => {
      const result = platformOnlyOrPublished(createAccessArgs(mockUsers.clinic()))
      expectAccess.scoped(result, {
        _status: {
          equals: 'published',
        },
      })
    })

    it('Patient gets published content only', () => {
      const result = platformOnlyOrPublished(createAccessArgs(mockUsers.patient()))
      expectAccess.scoped(result, {
        _status: {
          equals: 'published',
        },
      })
    })

    it('Anonymous gets published content only', () => {
      const result = platformOnlyOrPublished(createAccessArgs(mockUsers.anonymous()))
      expectAccess.scoped(result, {
        _status: {
          equals: 'published',
        },
      })
    })
  })

  describe('platformOnlyOrApproved', () => {
    it('Platform Staff gets full access to all clinics', () => {
      const result = platformOnlyOrApproved(createAccessArgs(mockUsers.platform()))
      expectAccess.full(result)
    })

    it('Clinic Staff gets approved clinics only', () => {
      const result = platformOnlyOrApproved(createAccessArgs(mockUsers.clinic()))
      expectAccess.scoped(result, {
        status: {
          equals: 'approved',
        },
      })
    })

    it('Patient gets approved clinics only', () => {
      const result = platformOnlyOrApproved(createAccessArgs(mockUsers.patient()))
      expectAccess.scoped(result, {
        status: {
          equals: 'approved',
        },
      })
    })

    it('Anonymous gets approved clinics only', () => {
      const result = platformOnlyOrApproved(createAccessArgs(mockUsers.anonymous()))
      expectAccess.scoped(result, {
        status: {
          equals: 'approved',
        },
      })
    })
  })

  describe('platformOnlyOrApprovedReviews', () => {
    it('Platform Staff gets full access to all reviews for moderation', () => {
      const result = platformOnlyOrApprovedReviews(createAccessArgs(mockUsers.platform()))
      expectAccess.full(result)
    })

    it('Clinic Staff gets approved reviews only', () => {
      const result = platformOnlyOrApprovedReviews(createAccessArgs(mockUsers.clinic()))
      expectAccess.scoped(result, {
        status: {
          equals: 'approved',
        },
      })
    })

    it('Patient gets approved reviews only', () => {
      const result = platformOnlyOrApprovedReviews(createAccessArgs(mockUsers.patient()))
      expectAccess.scoped(result, {
        status: {
          equals: 'approved',
        },
      })
    })

    it('Anonymous gets approved reviews only', () => {
      const result = platformOnlyOrApprovedReviews(createAccessArgs(mockUsers.anonymous()))
      expectAccess.scoped(result, {
        status: {
          equals: 'approved',
        },
      })
    })
  })
})
