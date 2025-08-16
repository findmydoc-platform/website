# Collection Extension Tasks

## Overview
The following tasks were identified during the baseline content enrichment process but require extending existing PayloadCMS collections with new fields or configuration. These tasks have been extracted to prevent immediate collection schema changes.

## Tasks

### 1. Add Logo/Icon Support to Accreditations Collection
**Description**: Extend the `accreditation` collection to support logo/icon images for accreditations like JCI.

**Required Changes**:
- Add an `icon` field of type `upload` to the accreditation collection
- Update the accreditation seed data to include logo references
- Implement base64 to media conversion helper for seeding logos

**Impact**: Enhanced visual representation of accreditations in the UI

### 2. Additional Treatment Categories
**Description**: Expand the treatments collection to include comprehensive medical treatments across all specialties mentioned in earlier comments.

**Required Changes**:
- Review and implement complete list of treatments from previous discussions
- Ensure proper relationships to medical specialties
- Add any additional fields needed for treatment metadata

**Impact**: More comprehensive treatment portfolio for the platform

### 3. Enhanced Media Management
**Description**: Implement utilities for handling various media types during seeding operations.

**Required Changes**:
- Create media conversion helpers for different image formats
- Add support for external image URLs in seed data
- Implement media deduplication logic

**Impact**: Better media management and reduced storage duplication

## Implementation Guidelines

1. **Schema Changes**: All collection modifications require database migrations using PayloadCMS CLI
2. **Seeding**: Update seed data to utilize new fields while maintaining idempotency
3. **Testing**: Add comprehensive tests for new collection fields and relationships
4. **Documentation**: Update collection documentation with new field descriptions

## Next Steps

1. Prioritize tasks based on immediate platform needs
2. Plan migration strategy for existing data
3. Implement changes incrementally to minimize disruption
4. Test thoroughly in development environment before production deployment