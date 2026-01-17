# Integration test tasks by collection

This backlog converts the provided integration test plan into per-collection tasks. Each task lists existing coverage to avoid duplicate work and calls out only the scenarios that still need integration tests.

## Pages

**Existing coverage**: None found under `tests/integration/`.

**Task**
- Add integration tests for create/update/delete flows, including:
  - Create pages with and without `publishedAt`; verify slug generation and `populatePublishedAt` hook behavior.
  - Update title and validate slug changes or lock behavior, plus invalid block payloads.
  - Delete (trash) and verify `revalidateDelete` hook side-effects via a mocked endpoint or logger hook.
  - Access control: only platform users can create/update/delete; non-platform reads only published.
  - Preview URL generation for live preview and preview fields.

## Posts

**Existing coverage**: None found under `tests/integration/`.

**Task**
- Add integration tests for create/update/delete flows, including:
  - Create posts with tags, hero image, content, excerpt, categories, authors, and slug generation.
  - Publish flow: set `_status` to `published` and verify `publishedAt` is set by the inline hook.
  - After read: ensure `populateAuthors` fills `populatedAuthors` and respects privacy access.
  - Related posts filter prevents self-referential links.
  - Delete (trash) and verify `revalidateDelete` hook side-effects via mocked endpoint or logger hook.
  - Access control: platform-only create/update/delete; others read published.

## Categories

**Existing coverage**: None found under `tests/integration/`.

**Task**
- Add integration tests for CRUD and slug behavior:
  - Create categories and verify auto-generated slug from title.
  - Update title and validate slug updates or remains stable if locked by Payload defaults.
  - Delete category and verify removal.
  - Validation: missing title should fail; duplicate titles should raise slug uniqueness errors when enforced.

## PlatformContentMedia

**Existing coverage**: None found under `tests/integration/`.

**Task**
- Add integration tests for upload and hook behavior:
  - Upload an image and verify `storagePath` and `createdBy` are set by `beforeChange` hook.
  - Update caption/alt and ensure `storagePath` and `createdBy` are stable.
  - Delete media and confirm file removal (if storage adapter allows).
  - Validation: reject non-image MIME types and missing `alt`.
  - Enforce the 5MB file size limit (global upload limit).

## PlatformStaff

**Existing coverage**: `tests/integration/basicUserLifecycle.test.ts` validates auto-creation via BasicUsers hooks and cleanup on delete.

**Task**
- Add integration tests for access control and updates:
  - Verify direct create requests are rejected (collection `create: false`).
  - Update role as platform user and validate persistence; deny updates for non-platform users.
  - Validation: duplicate `user` relationship should fail due to uniqueness.

## Clinics

**Existing coverage**: `tests/integration/clinics.creation.test.ts`, `tests/integration/clinic.test.ts`.

**Task**
- Add integration tests for remaining scenarios:
  - Access control for status field: non-platform users cannot update `status`.
  - Join behavior: create `ClinicTreatments` via clinic side and verify join visibility in clinic.
  - Accreditation relationships and gallery entries association behavior.
  - Access control: clinic users can only update their own clinic.

## ClinicApplications

**Existing coverage**: `tests/integration/clinicApplications.approval.test.ts`.

**Task**
- Add integration tests for validation and access:
  - Required fields validation for application submissions.
  - Public create without auth; non-platform read/update/delete should fail.
  - `reviewNotes` update guarded by platform user access.
  - Conditional `linkedRecords` visibility/editability when status changes from `submitted`.

## Doctors

**Existing coverage**: `tests/integration/doctors.titles.test.ts`.

**Task**
- Add integration tests for full CRUD and joins:
  - Create doctors with required fields and verify `fullName` and slug generation.
  - Validate required `qualifications` and `languages`; missing fields should fail.
  - Update name/title and verify `fullName` recalculates.
  - Join behavior: create `DoctorTreatments` and `DoctorSpecialties` and confirm joins.
  - Delete access restricted to platform users.

## Accreditation

**Existing coverage**: None found under `tests/integration/`.

**Task**
- Add integration tests for CRUD and uploads:
  - Create accreditation with name, abbreviation, country, description, and icon upload.
  - Update and delete flows.
  - Validation: missing required fields and non-image icon rejection.

## MedicalSpecialties

**Existing coverage**: None found under `tests/integration/`.

**Task**
- Add integration tests for hierarchy and joins:
  - Create specialties with and without `parentSpecialty` and `icon`.
  - Update parent-child relationships; prevent or detect self/circular references.
  - Create `DoctorSpecialties` and verify `doctorLinks` join behavior.
  - Delete specialty and verify join handling.

## Treatments

**Existing coverage**: `tests/integration/treatments.creation.test.ts`, plus review hook coverage in `tests/integration/reviews.averageRatings.test.ts`.

**Task**
- Add integration tests for join and aggregation scenarios:
  - Verify `ClinicTreatments` creation updates `Treatments.Clinics` join list.
  - Verify `DoctorTreatments` creation updates `Treatments.Doctors` join list.
  - Validate tag relationships and specialty requirements in read/update flows beyond current create tests.

## ClinicTreatments

**Existing coverage**: `tests/integration/clinicTreatments.creation.test.ts`, `tests/integration/clinicTreatments.averagePrice.test.ts`.

**Task**
- Add integration tests for access control:
  - Ensure non-platform users cannot delete or update others' entries.
  - Verify unique constraint enforcement is consistent when updating existing records.

## DoctorTreatments

**Existing coverage**: None found under `tests/integration/`.

**Task**
- Add integration tests for CRUD and unique constraints:
  - Create doctor-treatment links with specialization level.
  - Prevent duplicate doctor-treatment pairs (unique index).
  - Update specialization level and verify joins in doctor and treatment collections.
  - Delete and verify join removal.

## DoctorSpecialties

**Existing coverage**: None found under `tests/integration/`.

**Task**
- Add integration tests for CRUD, certifications array, and unique constraints:
  - Create doctor-specialty links with certifications array and specialization level.
  - Validate unique constraints on doctor + medicalSpecialty.
  - Update certifications array (empty and multiple values).
  - Delete and verify join removal on `medical-specialties`.

## FavoriteClinics

**Existing coverage**: None found under `tests/integration/`.

**Task**
- Add integration tests for CRUD and access:
  - Patient creates and deletes favorite clinic entries.
  - Access control: patient can only read/update/delete their own favorites; platform can read all.
  - Unique constraint enforcement on patient + clinic.

## Reviews

**Existing coverage**: `tests/integration/reviews.auditTrail.test.ts`, `tests/integration/reviews.averageRatings.test.ts`, `tests/integration/reviews.duplicateGuard.test.ts`.

**Task**
- Add integration tests for remaining validation/access scenarios:
  - Validate required relationships (clinic, doctor, treatment) and rating bounds.
  - Access control: patient can create, platform can update/delete; patient updates should fail.
  - Verify `reviewDate` default and read-only behavior on create.

## Countries

**Existing coverage**: None found under `tests/integration/`.

**Task**
- Add integration tests for CRUD and validation:
  - Create, update, and delete country entries with required fields.
  - Validation for missing required fields.
  - Optional: verify duplicate ISO codes behavior if uniqueness is enforced elsewhere.

## Cities

**Existing coverage**: `tests/integration/cities.creation.test.ts`.

**Task**
- Add integration tests for remaining access scenarios:
  - Validate non-platform create/update/delete denial (access control).
  - Confirm coordinates validation for boundary values if configured.

## Tags

**Existing coverage**: `tests/integration/tags.createAndDuplicate.test.ts`.

**Task**
- Add integration tests for join behavior:
  - Add tags to posts/clinics/treatments and verify join lists on tags.
  - Delete tags and verify disassociation or appropriate constraints.
