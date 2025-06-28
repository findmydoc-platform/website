/**
 * Integration tests for rating calculation hooks
 * Tests hook functionality with mocked PayloadCMS operations
 */

import { updateAverageRatingsAfterChange, updateAverageRatingsAfterDelete } from '@/hooks/calculations/updateAverageRatings'
import type { Review } from '@/payload-types'

describe('Rating Calculation Hooks Integration Tests', () => {
  let mockPayload: any
  let mockContext: any

  beforeEach(() => {
    // Mock Payload instance with all required methods
    mockPayload = {
      find: jest.fn(),
      update: jest.fn(),
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
    }

    mockContext = {
      skipHooks: false,
    }

    jest.clearAllMocks()
  })

  describe('updateAverageRatingsAfterChange Hook', () => {
    test('should calculate and update clinic average rating after review creation', async () => {
      // Mock approved reviews for the clinic
      mockPayload.find.mockResolvedValueOnce({
        docs: [
          { starRating: 5, status: 'approved' },
          { starRating: 3, status: 'approved' },
          { starRating: 4, status: 'approved' },
        ],
      })

      // Mock the update calls
      mockPayload.update.mockResolvedValue({})

      const mockReview: Review = {
        id: 'review-1',
        starRating: 4,
        comment: 'Great service',
        status: 'approved',
        clinic: 'clinic-1',
        doctor: 'doctor-1',
        treatment: 'treatment-1',
        patient: 'patient-1',
        reviewDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const req = {
        payload: mockPayload,
        context: mockContext,
      }

      const result = await updateAverageRatingsAfterChange({
        doc: mockReview,
        req,
        previousDoc: undefined,
        operation: 'create',
        collection: {} as any,
      })

      // Verify the hook returns the original document
      expect(result).toBe(mockReview)

      // Verify that find was called to get clinic reviews
      expect(mockPayload.find).toHaveBeenCalledWith({
        collection: 'review',
        where: {
          and: [
            { clinic: { equals: 'clinic-1' } },
            { status: { equals: 'approved' } },
          ],
        },
        limit: 1000,
      })

      // Verify that update was called to set the average rating
      expect(mockPayload.update).toHaveBeenCalledWith({
        collection: 'clinics',
        id: 'clinic-1',
        data: { averageRating: 4 }, // (5 + 3 + 4) / 3 = 4
        context: {
          skipHooks: false,
          skipHooks: true, // Should prevent infinite loops
        },
      })
    })

    test('should only include approved reviews in calculations', async () => {
      // Mock mixed status reviews - return only approved ones based on the filter
      mockPayload.find.mockImplementation(({ where }) => {
        // Simulate the filter for approved status
        if (where?.and?.find(condition => condition.status?.equals === 'approved')) {
          return Promise.resolve({
            docs: [
              { starRating: 5, status: 'approved' }, // Only approved review
            ],
          })
        }
        return Promise.resolve({ docs: [] })
      })

      mockPayload.update.mockResolvedValue({})

      const mockReview: Review = {
        id: 'review-2',
        starRating: 5,
        comment: 'Excellent',
        status: 'approved',
        clinic: 'clinic-2',
        doctor: 'doctor-2', 
        treatment: 'treatment-2',
        patient: 'patient-2',
        reviewDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const req = {
        payload: mockPayload,
        context: mockContext,
      }

      await updateAverageRatingsAfterChange({
        doc: mockReview,
        req,
        previousDoc: undefined,
        operation: 'create',
        collection: {} as any,
      })

      // Verify only approved reviews are used (average should be 5, not (5+1+2)/3)
      expect(mockPayload.update).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: 'clinics',
          data: { averageRating: 5 },
        })
      )
    })

    test('should set average rating to null when no approved reviews exist', async () => {
      // Mock no approved reviews
      mockPayload.find.mockResolvedValue({ docs: [] })
      mockPayload.update.mockResolvedValue({})

      const mockReview: Review = {
        id: 'review-3',
        starRating: 3,
        comment: 'OK service',
        status: 'pending',
        clinic: 'clinic-3',
        doctor: 'doctor-3',
        treatment: 'treatment-3',
        patient: 'patient-3',
        reviewDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const req = {
        payload: mockPayload,
        context: mockContext,
      }

      await updateAverageRatingsAfterChange({
        doc: mockReview,
        req,
        previousDoc: undefined,
        operation: 'create',
        collection: {} as any,
      })

      // Verify average rating is set to null when no approved reviews
      expect(mockPayload.update).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: 'clinics',
          data: { averageRating: null },
        })
      )
    })

    test('should update multiple entities (clinic, doctor, treatment)', async () => {
      // Mock reviews for all entities
      mockPayload.find.mockResolvedValue({
        docs: [{ starRating: 4, status: 'approved' }],
      })
      mockPayload.update.mockResolvedValue({})

      const mockReview: Review = {
        id: 'review-4',
        starRating: 4,
        comment: 'Good service',
        status: 'approved',
        clinic: 'clinic-4',
        doctor: 'doctor-4',
        treatment: 'treatment-4',
        patient: 'patient-4',
        reviewDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const req = {
        payload: mockPayload,
        context: mockContext,
      }

      await updateAverageRatingsAfterChange({
        doc: mockReview,
        req,
        previousDoc: undefined,
        operation: 'create',
        collection: {} as any,
      })

      // Verify all three entities are updated
      expect(mockPayload.update).toHaveBeenCalledTimes(3)
      expect(mockPayload.update).toHaveBeenCalledWith(
        expect.objectContaining({ collection: 'clinics', id: 'clinic-4' })
      )
      expect(mockPayload.update).toHaveBeenCalledWith(
        expect.objectContaining({ collection: 'doctors', id: 'doctor-4' })
      )
      expect(mockPayload.update).toHaveBeenCalledWith(
        expect.objectContaining({ collection: 'treatments', id: 'treatment-4' })
      )
    })

    test('should skip execution when skipHooks context is true', async () => {
      const mockReview: Review = {
        id: 'review-5',
        starRating: 4,
        comment: 'Good service',
        status: 'approved',
        clinic: 'clinic-5',
        doctor: 'doctor-5',
        treatment: 'treatment-5',
        patient: 'patient-5',
        reviewDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const req = {
        payload: mockPayload,
        context: { skipHooks: true },
      }

      const result = await updateAverageRatingsAfterChange({
        doc: mockReview,
        req,
        previousDoc: undefined,
        operation: 'create',
        collection: {} as any,
      })

      // Should return early and not call any payload methods
      expect(result).toBe(mockReview)
      expect(mockPayload.find).not.toHaveBeenCalled()
      expect(mockPayload.update).not.toHaveBeenCalled()
    })

    test('should handle relationship changes by updating old entities', async () => {
      // Mock reviews for both old and new entities
      mockPayload.find.mockResolvedValue({
        docs: [{ starRating: 3, status: 'approved' }],
      })
      mockPayload.update.mockResolvedValue({})

      const previousReview: Review = {
        id: 'review-6',
        starRating: 4,
        comment: 'Good service',
        status: 'approved',
        clinic: 'old-clinic',
        doctor: 'old-doctor',
        treatment: 'old-treatment',
        patient: 'patient-6',
        reviewDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const updatedReview: Review = {
        ...previousReview,
        clinic: 'new-clinic',
        doctor: 'new-doctor',
        treatment: 'new-treatment',
      }

      const req = {
        payload: mockPayload,
        context: mockContext,
      }

      await updateAverageRatingsAfterChange({
        doc: updatedReview,
        req,
        previousDoc: previousReview,
        operation: 'update',
        collection: {} as any,
      })

      // Should update both old and new entities (6 updates total)
      expect(mockPayload.update).toHaveBeenCalledTimes(6)

      // Verify old entities are updated
      expect(mockPayload.update).toHaveBeenCalledWith(
        expect.objectContaining({ collection: 'clinics', id: 'old-clinic' })
      )
      expect(mockPayload.update).toHaveBeenCalledWith(
        expect.objectContaining({ collection: 'doctors', id: 'old-doctor' })
      )
      expect(mockPayload.update).toHaveBeenCalledWith(
        expect.objectContaining({ collection: 'treatments', id: 'old-treatment' })
      )

      // Verify new entities are updated
      expect(mockPayload.update).toHaveBeenCalledWith(
        expect.objectContaining({ collection: 'clinics', id: 'new-clinic' })
      )
      expect(mockPayload.update).toHaveBeenCalledWith(
        expect.objectContaining({ collection: 'doctors', id: 'new-doctor' })
      )
      expect(mockPayload.update).toHaveBeenCalledWith(
        expect.objectContaining({ collection: 'treatments', id: 'new-treatment' })
      )
    })
  })

  describe('updateAverageRatingsAfterDelete Hook', () => {
    test('should update average ratings after review deletion', async () => {
      // Mock remaining reviews after deletion
      mockPayload.find.mockResolvedValue({
        docs: [
          { starRating: 5, status: 'approved' },
          { starRating: 3, status: 'approved' },
        ],
      })
      mockPayload.update.mockResolvedValue({})

      const deletedReview: Review = {
        id: 'review-deleted',
        starRating: 1,
        comment: 'Poor service',
        status: 'approved',
        clinic: 'clinic-deleted',
        doctor: 'doctor-deleted',
        treatment: 'treatment-deleted',
        patient: 'patient-deleted',
        reviewDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const req = {
        payload: mockPayload,
        context: mockContext,
      }

      const result = await updateAverageRatingsAfterDelete({
        doc: deletedReview,
        req,
        id: 'review-deleted',
        collection: {} as any,
      })

      // Verify the hook returns the deleted document
      expect(result).toBe(deletedReview)

      // Verify average is recalculated without the deleted review
      expect(mockPayload.update).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: 'clinics',
          data: { averageRating: 4 }, // (5 + 3) / 2 = 4
        })
      )
    })

    test('should set average to null when deleting the last approved review', async () => {
      // Mock no remaining approved reviews
      mockPayload.find.mockResolvedValue({ docs: [] })
      mockPayload.update.mockResolvedValue({})

      const deletedReview: Review = {
        id: 'last-review',
        starRating: 5,
        comment: 'Great service',
        status: 'approved',
        clinic: 'clinic-last',
        doctor: 'doctor-last',
        treatment: 'treatment-last',
        patient: 'patient-last',
        reviewDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const req = {
        payload: mockPayload,
        context: mockContext,
      }

      await updateAverageRatingsAfterDelete({
        doc: deletedReview,
        req,
        id: 'last-review',
        collection: {} as any,
      })

      // Verify average rating is set to null
      expect(mockPayload.update).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: 'clinics',
          data: { averageRating: null },
        })
      )
    })
  })

  describe('Error Handling', () => {
    test('should handle database errors gracefully', async () => {
      // Mock database error
      mockPayload.find.mockRejectedValue(new Error('Database connection failed'))
      mockPayload.update.mockResolvedValue({})

      const mockReview: Review = {
        id: 'review-error',
        starRating: 4,
        comment: 'Good service',
        status: 'approved',
        clinic: 'clinic-error',
        doctor: 'doctor-error',
        treatment: 'treatment-error',
        patient: 'patient-error',
        reviewDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const req = {
        payload: mockPayload,
        context: mockContext,
      }

      // Should not throw an error
      const result = await updateAverageRatingsAfterChange({
        doc: mockReview,
        req,
        previousDoc: undefined,
        operation: 'create',
        collection: {} as any,
      })

      expect(result).toBe(mockReview)
      expect(mockPayload.logger.error).toHaveBeenCalled()
    })

    test('should handle update errors gracefully', async () => {
      mockPayload.find.mockResolvedValue({
        docs: [{ starRating: 4, status: 'approved' }],
      })
      // Mock update error
      mockPayload.update.mockRejectedValue(new Error('Update failed'))

      const mockReview: Review = {
        id: 'review-update-error',
        starRating: 4,
        comment: 'Good service',
        status: 'approved',
        clinic: 'clinic-update-error',
        doctor: 'doctor-update-error',
        treatment: 'treatment-update-error',
        patient: 'patient-update-error',
        reviewDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const req = {
        payload: mockPayload,
        context: mockContext,
      }

      // Should not throw an error
      const result = await updateAverageRatingsAfterChange({
        doc: mockReview,
        req,
        previousDoc: undefined,
        operation: 'create',
        collection: {} as any,
      })

      expect(result).toBe(mockReview)
      expect(mockPayload.logger.error).toHaveBeenCalled()
    })
  })
})