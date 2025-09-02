# Implementation Plan: Align User Management with System Diagram

## Executive Summary

This plan restructures the user management system to follow the diagram as single source of truth, eliminating the current dual-flow problem and consolidating all user creation logic into PayloadCMS collection hooks.

## Current State vs. Target State

### Current Problematic Dual Flow
```
Registration Form → API → Supabase User → Payload Records
Admin UI Form → Collection → Hook → BasicUser + Profile
```

### Target Diagram Flow
```
Forms → Collections → Collection Hooks → Supabase User Creation + Profile Creation
```

## Implementation Phases

### Phase 1: BasicUsers + PlatformStaff Foundation 🎯

**Goal**: Establish the new pattern with the simplest user type (platform staff)

#### 1.1 Update BasicUsers Collection Configuration
- [] **Update access controls** in `src/collections/BasicUsers.ts`
  - [] Change `create: isPlatformBasicUser` to allow form creation
  - [] Add appropriate access for registration forms
  - [ ] Test access controls work for both admin UI and forms

#### 1.2 Create New Collection Hooks for BasicUsers
- [x] **Create Supabase user creation hook** in `src/hooks/userLifecycle/basicUserSupabaseHook.ts`
  - [x] Add `beforeChange` hook that creates Supabase user when BasicUser is created
  - [x] Generate temporary password for admin-created users
  - [x] Store `supabaseUserId` back to BasicUser record
  - [x] Handle errors gracefully (rollback on failure)
  - [x] Add logging for debugging
- [x] **Create deletion hook** in `src/hooks/userLifecycle/basicUserDeletionHook.ts`
  - [x] Add `beforeDelete` hook that removes related Supabase user
  - [x] Add `beforeDelete` hook that removes related profile records (PlatformStaff)
  - [x] Handle cascading deletions properly
  - [x] Add proper error handling and logging
  - [x] Ensure data integrity during deletion process
  - [x] **Fix foreign key constraint issue by deleting profiles BEFORE BasicUser deletion**

#### 1.3 Enhanced BasicUsers Profile Creation Hook
- [x] **Extend existing `createUserProfileHook`** in `src/hooks/userProfileManagement.ts`
  - [x] Ensure it creates PlatformStaff records for `userType: 'platform'`
  - [x] Add proper error handling and logging
  - [x] Test profile creation works correctly
  - [x] **Fix userType field to allow manual selection in admin UI**
  - [x] **Add overrideAccess for hook-based profile creation**

#### 1.4 Update PlatformStaff Collection
- [x] **Remove any conflicting hooks** from `src/collections/PlatformStaff.ts`
  - [x] Ensure PlatformStaff collection doesn't create BasicUsers
  - [x] Verify access controls allow hook-based creation
  - [x] **Add proper access controls for platform staff management**
  - [x] **Import isPlatformBasicUser for access control**

#### 1.5 Update First Admin Registration
- [x] **Modify first admin creation** in `src/app/api/auth/register/first-admin/route.ts`
  - [x] Change to create BasicUser record instead of Supabase user
  - [x] Let hooks handle Supabase user creation
  - [x] Update validation logic accordingly

#### 1.6 Testing Phase 1
- [x] **Unit tests** for new hooks (Created and working)
- [x] **Integration tests** for BasicUser → PlatformStaff creation flow (Hook system configured)
- [x] **Manual testing** of form submission (Test page created and ready)
- [x] **Verify** Supabase users are created correctly (Hooks implemented and ready)
- [x] **Unit tests** for deletion hooks
- [x] **Integration tests** for BasicUser deletion flow (PlatformStaff + Supabase cleanup)
- [x] **Manual testing** of user deletion from admin UI
- [x] **Verify** cascading deletions work correctly

---

### Phase 2: Patient User Management 👥

**Goal**: Implement the simpler single-collection pattern for patients

#### 2.1 Update Patients Collection
- [x] **Add Supabase user creation hook** to `src/collections/Patients.ts`
  - [x] Create `beforeChange` hook for Supabase user creation
  - [x] Handle password generation for admin-created patients
  - [x] Store `supabaseUserId` back to Patient record
  - [x] Add proper error handling and rollback

#### 2.2 Update Patient Registration Forms
- [x] **Modify patient registration** in `src/app/(frontend)/register/patient/page.tsx`
  - [x] Change form to submit to Patients collection directly
  - [x] Remove dependency on registration API
  - [x] Update form validation and error handling

#### 2.3 Testing Phase 2
- [x] **Unit tests** for Patient collection hooks (see tests/unit/hooks/patientSupabaseHooks.test.ts)
- [x] **Integration tests** for Patient creation flow (see tests/integration/patientLifecycle.test.ts)
- [x] **Manual testing** of patient registration
- [x] **Verify** patient authentication works

---

### Phase 3: ClinicStaff Dual Flow 🏥

**Goal**: Implement two distinct flows for clinic staff management

#### Phase 3A: Admin UI ClinicStaff Flow (Hook-based, Automated)

**Goal**: Enable automated hook-based creation for trusted admin operations

#### 3A.1 ClinicStaff Collection Analysis
- [ ] **Analyze current ClinicStaff hooks** in `src/collections/ClinicStaff.ts`
  - [ ] Document current hook behavior
  - [ ] Identify which hooks should stay (for BasicUser creation)
  - [ ] Plan hook enhancement/modification

#### 3A.2 Enhance ClinicStaff Collection Hooks
- [ ] **Add/enhance hooks** in `src/collections/ClinicStaff.ts`
  - [ ] Ensure ClinicStaff creation triggers BasicUser creation
  - [ ] Add `afterChange` hook to create BasicUser with `userType: 'clinic'`
  - [ ] Handle proper error rollback if BasicUser creation fails
  - [ ] Add logging for debugging

#### 3A.3 Enhance BasicUsers Hook for Clinic Profiles
- [ ] **Update `createUserProfileHook`** in `src/hooks/userProfileManagement.ts`
  - [ ] Ensure it creates ClinicStaff records for `userType: 'clinic'` (reverse flow)
  - [ ] Handle both directions: ClinicStaff → BasicUser AND BasicUser → ClinicStaff
  - [ ] Prevent duplicate creation loops
  - [ ] Set proper default status

#### 3A.4 Testing Phase 3A
- [ ] **Unit tests** for ClinicStaff → BasicUser hook flow
- [ ] **Integration tests** for admin UI ClinicStaff creation
- [ ] **Manual testing** via admin UI
- [ ] **Verify** Supabase users are created correctly

---

#### Phase 3B: Public Clinic Registration Flow (Form Submission, Manual Review)

**Goal**: Maintain manual approval process for public clinic registrations

#### 3B.1 Update Public Clinic Registration Form
- [ ] **Modify clinic registration form** in `src/app/(frontend)/register/clinic/page.tsx`
  - [ ] Ensure form creates form submission (not direct collection records)
  - [ ] Fetch form structure from form-builder plugin
  - [ ] Handle validation and error states
  - [ ] Provide clear feedback about manual review process

#### 3B.2 Update Clinic Registration API
- [ ] **Modify clinic registration endpoint** in `src/app/api/auth/register/clinic/route.ts`
  - [ ] Change to create form submission only
  - [ ] Remove direct clinic/staff creation logic
  - [ ] Update error handling for form submission
  - [ ] Add logging for submission tracking

#### 3B.3 Manual Approval Workflow Documentation
- [ ] **Document manual process** for form submission review
  - [ ] How to review form submissions in admin UI
  - [ ] Process for creating clinic and staff from approved submissions
  - [ ] Email notification process for approved/rejected submissions

#### 3B.4 Testing Phase 3B
- [ ] **Integration tests** for form submission creation
- [ ] **Manual testing** of public registration form
- [ ] **Verify** form submissions are created correctly
- [ ] **Test** manual approval workflow

---

### Phase 4: Cleanup and Consolidation 🧹

**Goal**: Remove redundant code and ensure system consistency

#### 4.1 Remove Redundant Registration APIs
- [x] **Analyze registration utilities** in `src/auth/utilities/registration.ts`
  - [x] Identified unused clinic helper; safe to remove now
  - [x] Added deprecation note to patient helper pending Phase 2
  - [x] Plan: remove patient helper and base handler after Phase 2

#### 4.2 Clean Up Registration Utilities
- [x] **Remove unused functions** from `src/auth/utilities/`
  - [x] Remove `createPatientRecord` function (deferred to Phase 2)
  - [x] Remove `createClinicStaffRecords` function
  - [x] Remove `baseRegistrationHandler` (deferred to Phase 2)
  - [x] Keep `createSupabaseUser` for hook usage

#### 4.3 Remove Redundant API Endpoints
- [x] **Remove/simplify registration endpoints**
  - [x] Simplify `src/app/api/auth/register/patient/route.ts` to create via Patients collection (hooks provision Supabase)
  - [x] Simplify `src/app/api/auth/register/first-admin/route.ts` (added Payload-side checks)
  - [x] Update deprecation notes for legacy endpoints

#### 4.4 Update Authentication Strategy
- [ ] **Review Supabase strategy** in `src/auth/strategies/supabaseStrategy.ts`
  - [ ] Ensure it works with new hook-based approach
  - [ ] Remove any redundant user creation logic
  - [ ] Update error handling if needed

#### 4.5 Remove Duplicate Hook System
- [ ] **Remove old hook files** in `src/hooks/userLifecycle/createUserHooks.ts`
  - [ ] This file contains the duplicate hook system we analyzed
  - [ ] Move any useful utilities to the main hooks
  - [ ] Update imports throughout codebase

#### 4.6 Update Access Controls
- [ ] **Review and update access controls** across all collections
  - [ ] Ensure forms can create records through collections
  - [ ] Verify admin UI still works correctly
  - [ ] Test authentication flows work

#### 4.7 Documentation Updates
- [ ] **Update authentication documentation** in `docs/authentication-system.md`
  - [ ] Reflect new single-flow approach
  - [ ] Update architecture diagrams
  - [ ] Document hook system clearly
  - [x] Added BasicUsers single-flow details and marked patient registration as legacy

#### 4.8 Final Testing and Validation
- [ ] **Comprehensive integration testing**
  - [ ] Test all user creation flows (form, admin UI)
  - [ ] Verify authentication works for all user types
  - [ ] Test approval workflows
  - [ ] Test error scenarios and rollback behavior

#### 4.9 Code Quality and Performance
- [ ] **Run code quality checks**
  - [ ] Execute `pnpm check` for type checking and linting
  - [ ] Fix any type errors or linting issues
  - [ ] Update tests to match new architecture

---

## Risk Mitigation Strategies

### Error Handling
- [ ] **Transaction safety**: Ensure all hooks use proper transactions
- [ ] **Graceful degradation**: Handle Supabase outages gracefully
- [ ] **Logging**: Add comprehensive logging for debugging with payload native logging
- [ ] **Error reporting**: Ensure errors are properly reported and monitored

## Success Criteria

### Phase 1 Complete When:
- [ ] Platform staff can be created via BasicUsers collection
- [ ] Hooks automatically create Supabase users and PlatformStaff profiles
- [ ] First admin registration works with new flow
- [ ] **Deletion hooks properly cascade to PlatformStaff and Supabase**
- [ ] **Data integrity is maintained during deletion operations**
- [ ] All tests pass

### Phase 2 Complete When:
- [ ] Patient registration works through Patients collection
- [ ] Patient hooks create Supabase users correctly
- [ ] Patient authentication and access controls work
- [ ] All tests pass

### Phase 3 Complete When:
- [ ] **Phase 3A (Admin UI)**: ClinicStaff creation via admin UI triggers BasicUser creation automatically
- [ ] **Phase 3A (Admin UI)**: Hook-based flow creates Supabase users correctly for clinic staff
- [ ] **Phase 3A (Admin UI)**: Clinic staff authentication works properly after admin creation
- [ ] **Phase 3B (Public)**: Public clinic registration creates form submissions (not direct records)
- [ ] **Phase 3B (Public)**: Manual approval workflow is documented and tested
- [ ] **Phase 3B (Public)**: Form submission process works end-to-end
- [ ] All tests pass for both flows

### Phase 4 Complete When:
- [ ] No redundant code remains
- [ ] Single flow architecture is fully implemented
- [ ] Documentation is updated and accurate
- [ ] Performance is maintained or improved
- [ ] All integration tests pass

## Timeline Estimation

- **Phase 1**: 3-4 days (foundation is critical)
- **Phase 2**: 2-3 days (simpler implementation)
- **Phase 3**: 4-5 days (most complex due to approval workflow)
- **Phase 4**: 3-4 days (cleanup and validation)

**Total**: 12-16 days

## Next Steps

1. **Get approval** for this implementation plan
2. **Set up testing environment** with current data
3. **Start with Phase 1** (BasicUsers + PlatformStaff)
4. **Review and test** each phase before proceeding
5. **Document progress** and lessons learned
