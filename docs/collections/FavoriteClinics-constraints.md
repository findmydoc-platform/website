# FavoriteClinics Collection: Field Constraints and Data Integrity

## Overview

The `FavoriteClinics` collection implements a many-to-many relationship between patients and clinics, allowing patients to bookmark their preferred healthcare providers. This document outlines the field-level constraints and data integrity mechanisms in place.

## Collection Structure

### Fields

1. **patient** (relationship, required)
   - Type: `relationship` to `patients` collection
   - Required: `true`
   - Cardinality: One patient per favorite
   - Index: Part of unique composite index
   - Admin: Creation of new patients not allowed (`allowCreate: false`)

2. **clinic** (relationship, required)
   - Type: `relationship` to `clinics` collection  
   - Required: `true`
   - Cardinality: One clinic per favorite
   - Index: Part of unique composite index
   - Admin: Creation of new clinics not allowed (`allowCreate: false`)

3. **timestamps** (automatic)
   - `createdAt`: Automatically set on creation
   - `updatedAt`: Automatically updated on modification

## Data Integrity Constraints

### 1. Unique Constraint (Database Level)

```typescript
indexes: [
  {
    fields: ['patient', 'clinic'],
    unique: true,
  },
]
```

**Purpose**: Prevents duplicate favorites - each patient can only favorite a specific clinic once.

**Behavior**: 
- ✅ Patient A can favorite Clinic X
- ✅ Patient B can favorite Clinic X (same clinic, different patient)
- ✅ Patient A can favorite Clinic Y (same patient, different clinic)
- ❌ Patient A cannot favorite Clinic X twice (duplicate)

**Error Message**: `"The following field is invalid: patient_id, clinic_id"` with status 400

### 2. Referential Integrity

**Patient Relationship**:
- Must reference an existing record in the `patients` collection
- Foreign key constraint enforced at database level
- Deletion behavior: Depends on database configuration (likely CASCADE or RESTRICT)

**Clinic Relationship**:
- Must reference an existing record in the `clinics` collection  
- Foreign key constraint enforced at database level
- Deletion behavior: Depends on database configuration (likely CASCADE or RESTRICT)

### 3. Required Field Validation

Both `patient` and `clinic` fields are marked as `required: true`, ensuring:
- Cannot create favorites without specifying a patient
- Cannot create favorites without specifying a clinic
- Validation occurs at the Payload level before database operations

## Access Control Constraints

### Permission Matrix

| User Type | Create | Read | Update | Delete |
|-----------|--------|------|--------|--------|
| **Platform Staff** | ✅ All | ✅ All | ✅ All | ✅ All |
| **Patient** | ✅ Own only | ✅ Own only | ✅ Own only | ✅ Own only |
| **Clinic Staff** | ❌ | ❌ | ❌ | ❌ |
| **Anonymous** | ❌ | ❌ | ❌ | ❌ |

### Implementation Details

- **Platform Staff**: Full RWDA access for moderation and abuse handling
- **Patient Access**: Scoped to `{ patient: { equals: req.user.id } }`
- **Create Logic**: `isPlatformBasicUser({ req }) || isPatient({ req })`
- **RUD Logic**: Uses `platformOrOwnPatientResource` scope filter

## Usage Examples

### Valid Operations

```javascript
// Patient favorites a clinic
await payload.create({
  collection: 'favoriteclinics',
  data: {
    patient: currentPatientId,
    clinic: selectedClinicId,
  },
  user: patientUser
})

// Platform staff creates favorite for any patient
await payload.create({
  collection: 'favoriteclinics', 
  data: {
    patient: anyPatientId,
    clinic: anyClinicId,
  },
  user: platformUser
})
```

### Invalid Operations (will throw errors)

```javascript
// Duplicate favorite
await payload.create({
  collection: 'favoriteclinics',
  data: {
    patient: 1, 
    clinic: 1,
  }
}) // First creation succeeds

await payload.create({
  collection: 'favoriteclinics',
  data: {
    patient: 1,
    clinic: 1, // Same combination
  }
}) // Throws unique constraint error

// Missing required fields
await payload.create({
  collection: 'favoriteclinics',
  data: {
    patient: 1,
    // Missing clinic field
  }
}) // Throws validation error

// Non-existent relationships
await payload.create({
  collection: 'favoriteclinics', 
  data: {
    patient: 99999, // Non-existent patient
    clinic: 1,
  }
}) // Throws foreign key constraint error
```

## Administrative Considerations

### Database Performance
- The composite unique index on `(patient, clinic)` provides efficient lookups
- Consider additional indexes on individual fields if needed for queries
- Monitor query performance for patient-specific favorite lists

### Data Migration
- When adding new constraints, ensure existing data complies
- Test constraint enforcement in staging before production deployment
- Consider cleanup scripts for any existing duplicate data

### Monitoring and Maintenance
- Monitor unique constraint violations for UX improvements
- Track favorite creation/deletion patterns for analytics
- Consider archival strategies for deleted patients/clinics

## Testing Coverage

The collection includes comprehensive integration tests covering:
- ✅ Basic CRUD operations
- ✅ Unique constraint enforcement  
- ✅ Required field validation
- ✅ Referential integrity
- ✅ Access control permissions
- ✅ Collection configuration validation

See `tests/integration/FavoriteClinics.test.ts` for detailed test cases.