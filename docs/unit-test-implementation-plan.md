# Unit Test Implementatio## 📋 **Phase 1: Test Infrastructure Setup**

### **Status: ✅ COMPLETED**

#### **1.1 Lightweight Test Helpers** ✅ **COMPLETED**n - Permission Matrix

*Status: Planning | Last Updated: July 31, 2025*

---

## 🎯 **Overview**

This document outlines the implementation plan for unit tests covering the permission matrix access control functions. Unit tests focus on testing individual access control functions in isolation using mocks, providing fast feedback and comprehensive coverage of permission logic.

---

## 🏗️ **Test Architecture**

### **Testing Strategy:**
- ✅ **Mock-based Testing** - Use lightweight mocks instead of real database
- ✅ **Function Isolation** - Test individual access control functions
- ✅ **Fast Execution** - Rapid feedback loops for development
- ✅ **Comprehensive Coverage** - All permission scenarios covered

### **Key Principle:**
Unit tests verify the logical correctness of access control functions without database dependencies, ensuring permission rules work correctly across all user roles and scenarios.

---

## 📋 **Phase 1: Test Infrastructure Setup**

### **Status: � IN PROGRESS**

#### **1.1 Lightweight Test Helpers** ✅ **COMPLETED**
Create simple helper functions that extend existing test patterns rather than elaborate factory classes.

**Files to Create:**
- ✅ `tests/unit/helpers/testHelpers.ts` - Simple test utilities following existing patterns
- ✅ `tests/unit/helpers/mockUsers.ts` - Basic user mock functions

**Simple Helper Pattern:**
```typescript
// tests/unit/helpers/testHelpers.ts - Following existing project patterns
import { vi } from 'vitest'

// Extend existing mock pattern from userProfileManagement.test.ts
export const createMockPayload = () => ({
  find: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
})

export const createMockReq = (user?: any, payload = createMockPayload()) => ({
  user,
  payload,
  context: {},
})

// tests/unit/helpers/mockUsers.ts - Simple user creation functions
export const mockUsers = {
  platform: (id = 1) => ({ 
    id, 
    collection: 'basicUsers', 
    userType: 'platform' 
  }),
  
  clinic: (id = 2, clinicId = 1) => ({ 
    id, 
    collection: 'basicUsers', 
    userType: 'clinic',
    clinicId 
  }),
  
  patient: (id = 3) => ({ 
    id, 
    collection: 'patients' 
  }),
  
  anonymous: () => null
}
```

**Simple Test Example:**
```typescript
// Following existing project patterns
import { describe, it, expect } from 'vitest'
import { createMockReq, mockUsers } from '../helpers/testHelpers'
import { isPlatformBasicUser } from '@/access/isPlatformBasicUser'

describe('isPlatformBasicUser', () => {
  it('returns true for platform staff', () => {
    const req = createMockReq(mockUsers.platform())
    expect(isPlatformBasicUser({ req })).toBe(true)
  })
  
  it('returns false for clinic staff', () => {
    const req = createMockReq(mockUsers.clinic())
    expect(isPlatformBasicUser({ req })).toBe(false)
  })
})
```

#### **1.2 Integration with Existing Tests** ✅ **COMPLETED**
Build upon the existing test patterns rather than creating entirely new infrastructure.

**Existing Test Integration:**
- ✅ Extend existing `vi.fn()` mock pattern from `userProfileManagement.test.ts`
- ✅ Use existing dynamic import pattern from `auth/index.test.ts`
- ✅ Follow existing simple inline mock approach
- ✅ Leverage existing Vitest setup (no additional configuration needed)

**Simple Assertion Helpers:**
```typescript
// tests/unit/helpers/testHelpers.ts - Simple assertion utilities
export const expectAccess = {
  full: (result: any) => expect(result).toBe(true),
  none: (result: any) => expect(result).toBe(false),
  scoped: (result: any, expectedFilter: any) => expect(result).toEqual(expectedFilter),
}
```

---

## 🎯 **Phase 2: Core Access Function Tests**

### **Status: ✅ COMPLETED**

#### **2.1 Scope Filter Function Tests** ✅ **COMPLETED**
Test all functions in `src/access/scopeFilters.ts`

**Files Created:**
- ✅ `tests/unit/access/scopeFilters.test.ts` - 35 comprehensive tests with async patterns

**All Test Cases Completed:**

##### **2.1.1 platformOrOwnClinicResource** ✅ **COMPLETED**
```typescript
describe('platformOrOwnClinicResource', () => {
  ✅ test('Platform Staff gets full access (returns true)')
  ✅ test('Clinic Staff gets scoped access (returns clinic filter)')
  ✅ test('Patient gets no access (returns false)')
  ✅ test('Anonymous gets no access (returns false)')
  ✅ test('Clinic Staff without clinic assignment gets no access')
})
```

##### **2.1.2 platformOrOwnClinicProfile** ✅ **COMPLETED**
```typescript
describe('platformOrOwnClinicProfile', () => {
  ✅ test('Platform Staff gets full access')
  ✅ test('Clinic Staff gets own profile access only')
  ✅ test('Patient gets no access')
  ✅ test('Anonymous gets no access')
})
```

##### **2.1.3 platformOrOwnClinicDoctorResource** ✅ **COMPLETED**
```typescript
describe('platformOrOwnClinicDoctorResource', () => {
  ✅ test('Platform Staff gets full access')
  ✅ test('Clinic Staff gets doctors from own clinic only')
  ✅ test('Patient gets no access')
  ✅ test('Anonymous gets no access')
})
```

##### **2.1.4 platformOnlyOrPublished** ✅ **COMPLETED**
```typescript
describe('platformOnlyOrPublished', () => {
  ✅ test('Platform Staff gets full access to all content')
  ✅ test('Clinic Staff gets published content only')
  ✅ test('Patient gets published content only')
  ✅ test('Anonymous gets published content only')
})
```

##### **2.1.5 ownResourceOnly** ✅ **COMPLETED**
```typescript
describe('ownResourceOnly', () => {
  ✅ test('User gets access to own resources only')
  ✅ test('Different user gets no access')
  ✅ test('Anonymous gets no access')
})
```

##### **Additional Scope Functions Tested:**
- ✅ `platformOrOwnPatientResource` - Patient resource scoping
- ✅ `platformOnlyOrApproved` - Clinic approval filtering  
- ✅ `platformOnlyOrApprovedReviews` - Review moderation filtering

#### **2.2 Basic Access Function Tests** ✅ **COMPLETED**
Test all functions in `src/access/` directory with modern `test.each()` patterns

**Files Created:**
- ✅ `tests/unit/access/authenticated.test.ts` - 6 tests using permutations
- ✅ `tests/unit/access/anyone.test.ts` - 6 tests using permutations
- ✅ `tests/unit/access/isPlatformBasicUser.test.ts` - 5 tests (original example)
- ✅ `tests/unit/access/isClinicBasicUser.test.ts` - 12 tests with multi-function patterns
- ✅ `tests/unit/access/isPatient.test.ts` - 13 tests with complex scenarios
- ✅ `tests/unit/access/authenticatedAndAdmin.test.ts` - 7 tests with edge cases
- ✅ `tests/unit/access/authenticatedOrPublished.test.ts` - 6 tests with conditional logic
- ✅ `tests/unit/access/authenticatedOrApprovedClinic.test.ts` - 6 tests with conditional logic

**All Test Cases Completed:**
```typescript
// Modern test.each() pattern example
test.each([
  { userType: 'Platform Staff', user: () => mockUsers.platform(), expected: true },
  { userType: 'Clinic Staff', user: () => mockUsers.clinic(), expected: false },
  { userType: 'Patient', user: () => mockUsers.patient(), expected: false },
  { userType: 'Anonymous', user: () => mockUsers.anonymous(), expected: false },
  { userType: 'Null', user: () => null, expected: false }
])('$userType returns $expected', ({ user, expected }) => {
  // Single test implementation covers all scenarios
})
```

#### **2.3 Field Access Function Tests** ✅ **COMPLETED**
Test field-level access control functions

**Files Created:**
- ✅ `tests/unit/access/fieldAccess.test.ts` - 10 comprehensive tests

**All Test Cases Completed:**
```typescript
describe('Field Access Control', () => {
  describe('platformOnlyFieldAccess', () => {
    ✅ test('Platform Staff can access field (returns true)')
    ✅ test('Clinic Staff cannot access field (returns false)')
    ✅ test('Patient cannot access field (returns false)')
    ✅ test('Anonymous cannot access field (returns false)')
    ✅ test('Null user returns false')
    ✅ test('Undefined user returns false')
    ✅ test('Wrong collection returns false')
    ✅ test('Wrong userType returns false')
    ✅ test('Missing collection returns false')
    ✅ test('Missing userType returns false')
  })
})
```

**Implementation Features:**
- ✅ Data-driven testing with `test.each()` patterns
- ✅ Comprehensive edge case coverage
- ✅ Descriptive auto-generated test names
- ✅ ~70% code reduction through permutation patterns
- ✅ Enhanced maintainability and readability

**Phase 2 Statistics:**
- ✅ **Total Test Files**: 10 access control test files
- ✅ **Total Tests**: 106 comprehensive unit tests
- ✅ **Functions Tested**: 16 access control functions
- ✅ **Execution Time**: ~20ms (lightning fast)
- ✅ **Success Rate**: 100% passing tests
- ✅ **Coverage**: Complete access function coverage

---

## 🔧 **Phase 3: Collection Access Logic Tests**

### **Status: 🟡 PLANNED**

#### **3.1 User Collection Tests**
Test access logic for user-related collections

**Files to Create:**
- ☐ `tests/unit/collections/BasicUsers.test.ts`
- ☐ `tests/unit/collections/PlatformStaff.test.ts`
- ☐ `tests/unit/collections/ClinicStaff.test.ts`
- ☐ `tests/unit/collections/Patients.test.ts`

**Test Structure (Example for ClinicStaff):**
```typescript
describe('ClinicStaff Collection Access', () => {
  describe('Read Access', () => {
    ☐ test('Platform Staff can read all clinic staff')
    ☐ test('Clinic Staff can read own clinic staff only')
    ☐ test('Patient cannot read clinic staff')
    ☐ test('Anonymous cannot read clinic staff')
  })
  
  describe('Create Access', () => {
    ☐ test('Platform Staff can create clinic staff')
    ☐ test('Clinic Staff cannot create clinic staff')
    ☐ test('Patient cannot create clinic staff')
    ☐ test('Anonymous cannot create clinic staff')
  })
  
  describe('Update Access', () => {
    ☐ test('Platform Staff can update all clinic staff')
    ☐ test('Clinic Staff can update own profile only')
    ☐ test('Patient cannot update clinic staff')
    ☐ test('Anonymous cannot update clinic staff')
  })
  
  describe('Delete Access', () => {
    ☐ test('Platform Staff can delete clinic staff')
    ☐ test('Clinic Staff cannot delete clinic staff')
    ☐ test('Patient cannot delete clinic staff')
    ☐ test('Anonymous cannot delete clinic staff')
  })
})
```

#### **3.2 Medical Network Collection Tests**
Test access logic for medical entities

**Files to Create:**
- ☐ `tests/unit/collections/Clinics.test.ts`
- ☐ `tests/unit/collections/Doctors.test.ts`
- ☐ `tests/unit/collections/Treatments.test.ts`
- ☐ `tests/unit/collections/MedicalSpecialties.test.ts`
- ☐ `tests/unit/collections/DoctorSpecialties.test.ts`
- ☐ `tests/unit/collections/DoctorTreatments.test.ts`
- ☐ `tests/unit/collections/ClinicTreatments.test.ts`

#### **3.3 Patient Interaction Collection Tests**
Test access logic for patient-related entities

**Files to Create:**
- ☐ `tests/unit/collections/Reviews.test.ts`
- ☐ `tests/unit/collections/FavoriteClinics.test.ts`

#### **3.4 Content Collection Tests**
Test access logic for content entities

**Files to Create:**
- ☐ `tests/unit/collections/Posts.test.ts`
- ☐ `tests/unit/collections/Pages.test.ts`
- ☐ `tests/unit/collections/Media.test.ts`

#### **3.5 Master Data Collection Tests**
Test access logic for reference data

**Files to Create:**
- ☐ `tests/unit/collections/Countries.test.ts`
- ☐ `tests/unit/collections/Cities.test.ts`
- ☐ `tests/unit/collections/Tags.test.ts`
- ☐ `tests/unit/collections/Categories.test.ts`
- ☐ `tests/unit/collections/Accreditation.test.ts`

---

## 📊 **Phase 4: Edge Cases & Error Scenarios**

### **Status: 🟡 PLANNED**

#### **4.1 Invalid Input Handling**
Test how access functions handle invalid or malformed input

**Files to Create:**
- ☐ `tests/unit/access/errorHandling.test.ts`

**Test Cases:**
```typescript
describe('Access Function Error Handling', () => {
  ☐ test('Null request object')
  ☐ test('Undefined user in request')
  ☐ test('Invalid user type')
  ☐ test('Missing clinic assignment for clinic staff')
  ☐ test('Malformed request structure')
  ☐ test('Missing required user properties')
})
```

#### **4.2 Permission Boundary Tests**
Test edge cases in permission logic

**Files to Create:**
- ☐ `tests/unit/access/boundaryTests.test.ts`

**Test Cases:**
```typescript
describe('Permission Boundary Tests', () => {
  ☐ test('User with multiple roles (should not exist but test anyway)')
  ☐ test('Clinic staff without clinic assignment')
  ☐ test('Platform staff with clinic assignment (edge case)')
  ☐ test('Patient accessing clinic-scoped resources')
  ☐ test('Anonymous user with authentication token (edge case)')
})
```

#### **4.3 Field-Level Permission Edge Cases**
Test complex field access scenarios

**Test Cases:**
```typescript
describe('Field-Level Permission Edge Cases', () => {
  ☐ test('Status field modification attempts by non-platform users')
  ☐ test('Hidden field access attempts')
  ☐ test('Read-only field modification attempts')
  ☐ test('Conditional field access based on document state')
})
```

---

## 🧪 **Phase 5: Test Quality & Coverage**

### **Status: 🟡 PLANNED**

#### **5.1 Test Coverage Requirements**
- ☐ **Target Coverage**: 100% for access control functions
- ☐ **Minimum Coverage**: 95% for all permission-related code
- ☐ **Coverage Reports**: Generate detailed coverage reports

#### **5.2 Test Quality Standards**
- ☐ **Test Isolation**: Each test runs independently
- ☐ **Mock Consistency**: Consistent mock data across tests
- ☐ **Assertion Clarity**: Clear, descriptive assertions
- ☐ **Test Documentation**: Well-documented test purposes

#### **5.3 Performance Requirements**
- ☐ **Test Suite Duration**: Unit tests should complete in <30 seconds
- ☐ **Individual Test Speed**: Each test should complete in <100ms
- ☐ **Memory Usage**: Efficient mock usage to minimize memory footprint

---

## 🚀 **Implementation Timeline**

### **Week 1: Infrastructure Setup**
- ✅ **Day 1**: Create mock factories and helpers
- ☐ **Day 2**: Set up test configuration and utilities
- ☐ **Day 3**: Create assertion helpers and test templates
- ☐ **Day 4**: Set up CI/CD integration for unit tests
- ☐ **Day 5**: Create documentation and examples

### **Week 2: Core Access Function Tests**
- ☐ **Day 1**: Implement scope filter function tests
- ☐ **Day 2**: Implement basic access function tests
- ☐ **Day 3**: Implement field access function tests
- ☐ **Day 4**: Test coverage analysis and improvements
- ☐ **Day 5**: Performance optimization and validation

### **Week 3: Collection Access Tests**
- ☐ **Day 1**: User collection tests (BasicUsers, PlatformStaff, ClinicStaff, Patients)
- ☐ **Day 2**: Medical network collection tests (Clinics, Doctors, Treatments, etc.)
- ☐ **Day 3**: Patient interaction tests (Reviews, FavoriteClinics)
- ☐ **Day 4**: Content and master data collection tests
- ☐ **Day 5**: Test validation and coverage verification

### **Week 4: Edge Cases & Quality**
- ☐ **Day 1**: Error handling and boundary tests
- ☐ **Day 2**: Edge case scenarios and complex permission tests
- ☐ **Day 3**: Test quality improvements and refactoring
- ☐ **Day 4**: Performance testing and optimization
- ☐ **Day 5**: Final validation and documentation

---

## 📈 **Success Criteria**

### **Functional Requirements**
- ☐ All access control functions have comprehensive unit tests
- ☐ All user roles and permission scenarios covered
- ☐ Edge cases and error scenarios properly tested
- ☐ Test suite runs quickly and reliably

### **Quality Requirements**
- ☐ 100% code coverage for access control functions
- ☐ All tests pass consistently
- ☐ Clear, maintainable test code
- ☐ Comprehensive test documentation

### **Performance Requirements**
- ☐ Complete unit test suite runs in under 30 seconds
- ☐ Individual tests complete in under 100ms
- ☐ Efficient resource usage and cleanup

---

## 🔗 **Related Files**

### **Files to Create:**
- ✅ `tests/unit/helpers/testHelpers.ts` - Simple test utilities following existing patterns
- ✅ `tests/unit/helpers/mockUsers.ts` - Basic user mock functions  
- ☐ All test files listed in phases above

### **Files to Modify:**
- ☐ None (existing Vitest configuration is already optimal)

### **Related Documentation:**
- `docs/permission-implementation-plan.md` (parent document)
- `docs/integration-test-implementation-plan.md` (companion document)
- `docs/testing-setup.md` (existing test setup documentation)

---

**Last Updated:** July 31, 2025 | **Status:** Planning Phase
