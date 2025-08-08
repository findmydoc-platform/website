# PayloadCMS Soft Delete Implementation

## Overview

This document describes the implementation of PayloadCMS native soft delete functionality across target collections using the `trash: true` configuration option introduced in version 3.49.0.

## Collections with Soft Delete Enabled

The following collections now support soft delete functionality:

- **Clinics** - Critical business data with relationships to doctors and treatments
- **Doctors** - Referenced by reviews and treatment associations
- **Treatments** - Core medical data with clinic and doctor relationships
- **Medical Specialties** - Foundational data referenced by doctors and treatments
- **Reviews** - Important audit trail and patient feedback data
- **Media** - Files that may be referenced by multiple entities
- **Posts** - Blog content that may be referenced for SEO
- **Pages** - Static pages that may be referenced in navigation
- **Tags** - Classification data referenced by multiple entities

## Permission Matrix Update

### Delete & Restore Access Control

| Collection | Delete Permission | Restore Permission | Rationale |
|------------|------------------|--------------------|-----------|
| Clinics | Platform Staff Only | Platform Staff Only | Business critical data |
| Doctors | Platform Staff Only | Platform Staff Only | Referenced by reviews/treatments |
| Treatments | Platform Staff Only | Platform Staff Only | Core medical data |
| Medical Specialties | Platform Staff Only | Platform Staff Only | Foundational data |
| Reviews | Platform Staff Only | Platform Staff Only | Audit trail integrity |
| Media | Platform Staff Only | Platform Staff Only | Referenced by multiple entities |
| Posts | Platform Staff Only | Platform Staff Only | Content management |
| Pages | Platform Staff Only | Platform Staff Only | Site structure |
| Tags | Platform Staff Only | Platform Staff Only | Classification system |

**Note**: PayloadCMS uses the existing `delete` access control for restore operations. No separate restore permission configuration is required.

## Technical Implementation

### Database Changes

- Added `deleted_at` timestamp field to all target collections
- Created indexes on `deleted_at` fields for query performance
- Includes version tables for Posts and Pages (draft/published content)

### Behavior Changes

1. **Delete Operations**: Now perform soft delete (set `deleted_at` timestamp)
2. **Read Operations**: Automatically exclude deleted items from default queries
3. **Restore Operations**: Available through admin interface for Platform Staff
4. **Admin Interface**: Provides trash view and restore functionality

### Migration

Generated migration: `20250808_052756_soft_delete_enablement.ts`

```sql
-- Example: Add deleted_at column and index
ALTER TABLE "clinics" ADD COLUMN "deleted_at" timestamp(3) with time zone;
CREATE INDEX "clinics_deleted_at_idx" ON "clinics" USING btree ("deleted_at");
```

## Testing

- All existing tests pass (496/496)
- New test validates `trash: true` configuration on all target collections
- Migration successfully applied during test runs

## Benefits

1. **Data Preservation**: Maintains referential integrity and audit trails
2. **Safety**: Prevents accidental permanent data loss
3. **Compliance**: Supports data retention requirements
4. **Performance**: Indexed `deleted_at` fields ensure efficient queries
5. **User Experience**: Native admin interface for restore operations