# Collection Extension Tasks

## Overview
The following tasks were identified during the baseline content enrichment process but require extending existing PayloadCMS collections with new fields or configuration. These tasks have been extracted to prevent immediate collection schema changes.

## Tasks

### 1. Accreditation Logos/Icons (Deferred)
**Description**: The `accreditation` collection already includes an `icon` upload field. Seeding of logo media is currently deferred.

**Required Changes (when prioritized)**:
- Add logo references to seed data once assets and storage policy are finalized
- Use existing media helpers; prefer URL-based ingestion over base64

**Impact**: Enhanced visual representation of accreditations in the UI

### 2. Treatments Catalog (Status: Implemented)
**Description**: Treatments have been expanded across Plastic Surgery, Dentistry, Ophthalmology, Bariatric & Metabolic, Oncology, Fertility/Women’s Health, Medical Aesthetics, Neurology, and Hair Transplant.

**Required Changes**: None at this time. Future metadata fields can be proposed separately.

**Impact**: Comprehensive treatment portfolio mapped to existing medical specialties

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