/**
 * Integration tests for price calculation hooks
 * Tests hook functionality with mocked PayloadCMS operations
 */

import { updateAveragePriceAfterChange, updateAveragePriceAfterDelete } from '@/hooks/calculations/updateAveragePrices'
import type { Clinictreatment } from '@/payload-types'

describe('Price Calculation Hooks Integration Tests', () => {
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

  describe('updateAveragePriceAfterChange Hook', () => {
    test('should calculate and update treatment average price after clinic treatment creation', async () => {
      // Mock clinic treatments for the treatment
      mockPayload.find.mockResolvedValueOnce({
        docs: [
          { price: 100 },
          { price: 150 },
          { price: 200 },
        ],
      })

      // Mock the update call
      mockPayload.update.mockResolvedValue({})

      const mockClinicTreatment: Clinictreatment = {
        id: 'ct-1',
        clinic: 'clinic-1',
        treatment: 'treatment-1',
        price: 150,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const req = {
        payload: mockPayload,
        context: mockContext,
      }

      const result = await updateAveragePriceAfterChange({
        doc: mockClinicTreatment,
        req,
        previousDoc: undefined,
        operation: 'create',
        collection: {} as any,
      })

      // Verify the hook returns the original document
      expect(result).toBe(mockClinicTreatment)

      // Verify that find was called to get clinic treatments
      expect(mockPayload.find).toHaveBeenCalledWith({
        collection: 'clinictreatments',
        where: {
          treatment: {
            equals: 'treatment-1',
          },
        },
        limit: 1000,
      })

      // Verify that update was called to set the average price
      expect(mockPayload.update).toHaveBeenCalledWith({
        collection: 'treatments',
        id: 'treatment-1',
        data: { averagePrice: 150 }, // (100 + 150 + 200) / 3 = 150
        context: {
          skipHooks: false,
          skipHooks: true, // Should prevent infinite loops
        },
      })
    })

    test('should ignore clinic treatments with zero or invalid prices', async () => {
      // Mock clinic treatments with mixed valid/invalid prices
      mockPayload.find.mockResolvedValue({
        docs: [
          { price: 200 }, // Valid
          { price: 0 },   // Invalid - should be ignored
          { price: null }, // Invalid - should be ignored
          { price: undefined }, // Invalid - should be ignored
          { price: -50 }, // Invalid - should be ignored
        ],
      })

      mockPayload.update.mockResolvedValue({})

      const mockClinicTreatment: Clinictreatment = {
        id: 'ct-2',
        clinic: 'clinic-2',
        treatment: 'treatment-2',
        price: 200,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const req = {
        payload: mockPayload,
        context: mockContext,
      }

      await updateAveragePriceAfterChange({
        doc: mockClinicTreatment,
        req,
        previousDoc: undefined,
        operation: 'create',
        collection: {} as any,
      })

      // Verify only valid prices are used (average should be 200, not affected by invalid prices)
      expect(mockPayload.update).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: 'treatments',
          data: { averagePrice: 200 },
        })
      )
    })

    test('should set average price to null when no valid clinic treatments exist', async () => {
      // Mock no valid clinic treatments
      mockPayload.find.mockResolvedValue({ docs: [] })
      mockPayload.update.mockResolvedValue({})

      const mockClinicTreatment: Clinictreatment = {
        id: 'ct-3',
        clinic: 'clinic-3',
        treatment: 'treatment-3',
        price: 100,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const req = {
        payload: mockPayload,
        context: mockContext,
      }

      await updateAveragePriceAfterChange({
        doc: mockClinicTreatment,
        req,
        previousDoc: undefined,
        operation: 'create',
        collection: {} as any,
      })

      // Verify average price is set to null when no valid clinic treatments
      expect(mockPayload.update).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: 'treatments',
          data: { averagePrice: null },
        })
      )
    })

    test('should update price when clinic treatment price is modified', async () => {
      // Mock clinic treatments after price update
      mockPayload.find.mockResolvedValue({
        docs: [
          { price: 250 }, // Updated price
          { price: 150 },
        ],
      })
      mockPayload.update.mockResolvedValue({})

      const previousClinicTreatment: Clinictreatment = {
        id: 'ct-4',
        clinic: 'clinic-4',
        treatment: 'treatment-4',
        price: 100,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const updatedClinicTreatment: Clinictreatment = {
        ...previousClinicTreatment,
        price: 250,
      }

      const req = {
        payload: mockPayload,
        context: mockContext,
      }

      await updateAveragePriceAfterChange({
        doc: updatedClinicTreatment,
        req,
        previousDoc: previousClinicTreatment,
        operation: 'update',
        collection: {} as any,
      })

      // Verify average is recalculated with new price
      expect(mockPayload.update).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: 'treatments',
          data: { averagePrice: 200 }, // (250 + 150) / 2 = 200
        })
      )
    })

    test('should skip execution when skipHooks context is true', async () => {
      const mockClinicTreatment: Clinictreatment = {
        id: 'ct-5',
        clinic: 'clinic-5',
        treatment: 'treatment-5',
        price: 100,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const req = {
        payload: mockPayload,
        context: { skipHooks: true },
      }

      const result = await updateAveragePriceAfterChange({
        doc: mockClinicTreatment,
        req,
        previousDoc: undefined,
        operation: 'create',
        collection: {} as any,
      })

      // Should return early and not call any payload methods
      expect(result).toBe(mockClinicTreatment)
      expect(mockPayload.find).not.toHaveBeenCalled()
      expect(mockPayload.update).not.toHaveBeenCalled()
    })

    test('should handle treatment relationship changes by updating old treatment', async () => {
      // Mock clinic treatments for both old and new treatments
      mockPayload.find.mockResolvedValue({
        docs: [{ price: 150 }],
      })
      mockPayload.update.mockResolvedValue({})

      const previousClinicTreatment: Clinictreatment = {
        id: 'ct-6',
        clinic: 'clinic-6',
        treatment: 'old-treatment',
        price: 100,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const updatedClinicTreatment: Clinictreatment = {
        ...previousClinicTreatment,
        treatment: 'new-treatment',
      }

      const req = {
        payload: mockPayload,
        context: mockContext,
      }

      await updateAveragePriceAfterChange({
        doc: updatedClinicTreatment,
        req,
        previousDoc: previousClinicTreatment,
        operation: 'update',
        collection: {} as any,
      })

      // Should update both old and new treatments (2 updates total)
      expect(mockPayload.update).toHaveBeenCalledTimes(2)

      // Verify old treatment is updated
      expect(mockPayload.update).toHaveBeenCalledWith(
        expect.objectContaining({ collection: 'treatments', id: 'old-treatment' })
      )

      // Verify new treatment is updated
      expect(mockPayload.update).toHaveBeenCalledWith(
        expect.objectContaining({ collection: 'treatments', id: 'new-treatment' })
      )
    })

    test('should handle decimal prices correctly', async () => {
      // Mock clinic treatments with decimal prices
      mockPayload.find.mockResolvedValue({
        docs: [
          { price: 99.99 },
          { price: 150.50 },
          { price: 200.25 },
        ],
      })
      mockPayload.update.mockResolvedValue({})

      const mockClinicTreatment: Clinictreatment = {
        id: 'ct-7',
        clinic: 'clinic-7',
        treatment: 'treatment-7',
        price: 150.50,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const req = {
        payload: mockPayload,
        context: mockContext,
      }

      await updateAveragePriceAfterChange({
        doc: mockClinicTreatment,
        req,
        previousDoc: undefined,
        operation: 'create',
        collection: {} as any,
      })

      // Calculate expected average: (99.99 + 150.50 + 200.25) / 3 = 150.24666...
      const expectedAverage = (99.99 + 150.50 + 200.25) / 3

      expect(mockPayload.update).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: 'treatments',
          data: { averagePrice: expectedAverage },
        })
      )
    })
  })

  describe('updateAveragePriceAfterDelete Hook', () => {
    test('should update average price after clinic treatment deletion', async () => {
      // Mock remaining clinic treatments after deletion
      mockPayload.find.mockResolvedValue({
        docs: [
          { price: 200 },
          { price: 100 },
        ],
      })
      mockPayload.update.mockResolvedValue({})

      const deletedClinicTreatment: Clinictreatment = {
        id: 'ct-deleted',
        clinic: 'clinic-deleted',
        treatment: 'treatment-deleted',
        price: 300, // This price should no longer affect the average
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const req = {
        payload: mockPayload,
        context: mockContext,
      }

      const result = await updateAveragePriceAfterDelete({
        doc: deletedClinicTreatment,
        req,
        id: 'ct-deleted',
        collection: {} as any,
      })

      // Verify the hook returns the deleted document
      expect(result).toBe(deletedClinicTreatment)

      // Verify average is recalculated without the deleted clinic treatment
      expect(mockPayload.update).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: 'treatments',
          data: { averagePrice: 150 }, // (200 + 100) / 2 = 150
        })
      )
    })

    test('should set average to null when deleting the last clinic treatment', async () => {
      // Mock no remaining clinic treatments
      mockPayload.find.mockResolvedValue({ docs: [] })
      mockPayload.update.mockResolvedValue({})

      const deletedClinicTreatment: Clinictreatment = {
        id: 'last-ct',
        clinic: 'clinic-last',
        treatment: 'treatment-last',
        price: 500,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const req = {
        payload: mockPayload,
        context: mockContext,
      }

      await updateAveragePriceAfterDelete({
        doc: deletedClinicTreatment,
        req,
        id: 'last-ct',
        collection: {} as any,
      })

      // Verify average price is set to null
      expect(mockPayload.update).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: 'treatments',
          data: { averagePrice: null },
        })
      )
    })

    test('should skip execution when skipHooks context is true', async () => {
      const deletedClinicTreatment: Clinictreatment = {
        id: 'ct-skip',
        clinic: 'clinic-skip',
        treatment: 'treatment-skip',
        price: 100,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const req = {
        payload: mockPayload,
        context: { skipHooks: true },
      }

      const result = await updateAveragePriceAfterDelete({
        doc: deletedClinicTreatment,
        req,
        id: 'ct-skip',
        collection: {} as any,
      })

      // Should return early and not call any payload methods
      expect(result).toBe(deletedClinicTreatment)
      expect(mockPayload.find).not.toHaveBeenCalled()
      expect(mockPayload.update).not.toHaveBeenCalled()
    })
  })

  describe('Error Handling', () => {
    test('should handle database errors gracefully in afterChange hook', async () => {
      // Mock database error
      mockPayload.find.mockRejectedValue(new Error('Database connection failed'))
      mockPayload.update.mockResolvedValue({})

      const mockClinicTreatment: Clinictreatment = {
        id: 'ct-error',
        clinic: 'clinic-error',
        treatment: 'treatment-error',
        price: 100,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const req = {
        payload: mockPayload,
        context: mockContext,
      }

      // Should not throw an error
      const result = await updateAveragePriceAfterChange({
        doc: mockClinicTreatment,
        req,
        previousDoc: undefined,
        operation: 'create',
        collection: {} as any,
      })

      expect(result).toBe(mockClinicTreatment)
      expect(mockPayload.logger.error).toHaveBeenCalled()
    })

    test('should handle update errors gracefully in afterChange hook', async () => {
      mockPayload.find.mockResolvedValue({
        docs: [{ price: 100 }],
      })
      // Mock update error
      mockPayload.update.mockRejectedValue(new Error('Update failed'))

      const mockClinicTreatment: Clinictreatment = {
        id: 'ct-update-error',
        clinic: 'clinic-update-error',
        treatment: 'treatment-update-error',
        price: 100,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const req = {
        payload: mockPayload,
        context: mockContext,
      }

      // Should not throw an error
      const result = await updateAveragePriceAfterChange({
        doc: mockClinicTreatment,
        req,
        previousDoc: undefined,
        operation: 'create',
        collection: {} as any,
      })

      expect(result).toBe(mockClinicTreatment)
      expect(mockPayload.logger.error).toHaveBeenCalled()
    })

    test('should handle database errors gracefully in afterDelete hook', async () => {
      // Mock database error
      mockPayload.find.mockRejectedValue(new Error('Database connection failed'))
      mockPayload.update.mockResolvedValue({})

      const deletedClinicTreatment: Clinictreatment = {
        id: 'ct-delete-error',
        clinic: 'clinic-delete-error',
        treatment: 'treatment-delete-error',
        price: 100,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const req = {
        payload: mockPayload,
        context: mockContext,
      }

      // Should not throw an error
      const result = await updateAveragePriceAfterDelete({
        doc: deletedClinicTreatment,
        req,
        id: 'ct-delete-error',
        collection: {} as any,
      })

      expect(result).toBe(deletedClinicTreatment)
      expect(mockPayload.logger.error).toHaveBeenCalled()
    })
  })
})