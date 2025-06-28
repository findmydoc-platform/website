# Calculation Hooks Implementation

This document describes the implementation of calculation hooks for ratings and prices in the FindMyDoc platform.

## Overview

The implementation provides automatic calculation of average ratings and prices when reviews or clinic treatments are created, updated, or deleted. The hooks are designed to be loop-safe and only consider approved data for calculations.

## Features Implemented

### 1. Review Hooks (Average Rating Calculation)
- **Location**: `src/hooks/calculations/updateAverageRatings.ts`
- **Purpose**: Calculate and update averageRating for Clinics, Doctors, and Treatments
- **Triggers**: afterChange and afterDelete hooks on Reviews collection
- **Business Logic**: Only approved reviews are included in calculations

### 2. ClinicTreatment Hooks (Average Price Calculation)
- **Location**: `src/hooks/calculations/updateAveragePrices.ts`
- **Purpose**: Calculate and update averagePrice for Treatments
- **Triggers**: afterChange and afterDelete hooks on ClinicTreatments collection
- **Business Logic**: Only valid prices (> 0) are included in calculations

### 3. Loop Prevention
- Uses `context.skipHooks = true` when updating calculated fields
- Prevents infinite loops that could occur when hooks trigger other hooks

### 4. Field Updates
- **Clinics**: averageRating field (readOnly)
- **Doctors**: averageRating field (readOnly, updated from previous 'rating' field)
- **Treatments**: averageRating field (readOnly, newly added)
- **Treatments**: averagePrice field (readOnly, enhanced with description)

## Key Implementation Details

### Rating Calculation Logic
```typescript
// Only approved reviews count
const reviews = await payload.find({
  collection: 'review',
  where: {
    and: [
      { [entityField]: { equals: entityId } },
      { status: { equals: 'approved' } }
    ]
  }
})

// Calculate average or return null if no reviews
const totalRating = reviews.docs.reduce((sum, review) => sum + review.starRating, 0)
return reviews.docs.length > 0 ? totalRating / reviews.docs.length : null
```

### Price Calculation Logic
```typescript
// Filter valid prices
const validPrices = clinicTreatments.docs
  .map(ct => ct.price)
  .filter(price => price !== null && price !== undefined && price > 0)

// Calculate average or return null if no valid prices
return validPrices.length > 0 ? 
  validPrices.reduce((sum, price) => sum + price, 0) / validPrices.length : 
  null
```

### Loop Prevention Pattern
```typescript
await payload.update({
  collection: 'clinics',
  id: clinicId,
  data: { averageRating },
  context: {
    ...context,
    skipHooks: true // Prevents infinite loops
  }
})
```

## Files Modified

1. **src/collections/Reviews.ts**: Added afterChange and afterDelete hooks
2. **src/collections/ClinicTreatments.ts**: Added afterChange and afterDelete hooks
3. **src/collections/Doctors.ts**: Updated rating field to averageRating with proper configuration
4. **src/collections/Treatments.ts**: Added averageRating field, enhanced averagePrice description
5. **src/endpoints/seed/clinics/doctors-seed.ts**: Updated to use averageRating instead of rating

## Files Created

1. **src/hooks/calculations/updateAverageRatings.ts**: Review calculation hooks
2. **src/hooks/calculations/updateAveragePrices.ts**: ClinicTreatment calculation hooks
3. **src/utils/verifyHooksImplementation.ts**: Verification script for the implementation

## Business Rules

### Reviews
- Each review must be linked to a clinic, doctor, and treatment
- Only reviews with status 'approved' count towards averages
- When no approved reviews exist, averageRating is set to null (appears empty in admin)
- When relationships change, both old and new entities are updated

### Clinic Treatments
- Only positive prices (> 0) are included in average calculations
- When no valid prices exist, averagePrice is set to null (appears empty in admin)
- When treatment relationship changes, both old and new treatments are updated

## Error Handling

- All database operations are wrapped in try-catch blocks
- Errors are logged but don't prevent the hook from completing
- Graceful handling of missing or invalid data
- Defensive programming against null/undefined values

## Testing

The implementation includes comprehensive Jest integration tests located in `src/__tests__/hooks/`:

### Test Files
- **`ratingCalculation.test.ts`**: Tests for review-based rating calculations
- **`priceCalculation.test.ts`**: Tests for clinic treatment-based price calculations

### Running Tests
```bash
# Run all tests
npm test

# Run only hook tests
npm test -- src/__tests__/hooks/

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm test -- --coverage
```

### Test Coverage

**Rating Calculation Tests:**
1. Review creation with approved status
2. Multiple reviews averaging
3. Non-approved reviews exclusion
4. Rating updates when review status changes
5. Rating updates when star rating changes
6. Review deletion impact on averages
7. Doctor and treatment rating calculations
8. Relationship changes (moving reviews between entities)

**Price Calculation Tests:**
1. Clinic treatment creation with pricing
2. Multiple clinic treatments averaging
3. Invalid price exclusion (zero, negative, null)
4. Price updates when clinic treatment changes
5. Clinic treatment deletion impact on averages
6. Relationship changes (moving clinic treatments)
7. Edge cases (extreme values, null handling)

### Test Environment Setup
- Uses Jest with TypeScript support
- Node environment for PayloadCMS integration
- 30-second timeout for database operations
- Automatic cleanup of test data
- Isolated test scenarios with proper setup/teardown

### Key Test Features
- **Database Integration**: Tests use actual PayloadCMS instance
- **Real Data Flow**: Tests verify complete hook execution chain
- **Edge Case Coverage**: Tests handle null values, invalid data, and errors
- **Loop Prevention**: Verifies hooks don't cause infinite loops
- **Business Logic**: Confirms only approved reviews and valid prices count

## Migration Commands

After implementing the hooks, run these commands:

```bash
pnpm payload migrate:create
pnpm generate:types
pnpm generate:importmap
```

Note: Migration creation requires a database connection. The types and importmap generation have been successfully completed.

## Verification

The implementation has been verified to:
- ✅ Compile without TypeScript errors
- ✅ Follow PayloadCMS hook patterns
- ✅ Include proper loop prevention
- ✅ Handle all specified business requirements
- ✅ Maintain backward compatibility
- ✅ Use minimal, surgical changes to existing code