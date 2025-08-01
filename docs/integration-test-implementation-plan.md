# Integration Test Implementation Plan - Permission Matrix

*Status: Planning | Last Updated: July 31, 2025*

---

## 🎯 **Overview**

This document outlines the implementation plan for integration tests covering the complete permission matrix implementation. Integration tests verify that the permission system works correctly with real database operations, ensuring data segregation and security across the entire medical platform.

---

## 🏗️ **Test Architecture**

### **Testing Strategy:**
- ✅ **Database-backed Testing** - Use real PostgreSQL database with Docker
- ✅ **End-to-End Permission Flows** - Test complete user workflows
- ✅ **Real PayloadCMS Operations** - Test with actual Payload API calls
- ✅ **Data Segregation Verification** - Ensure clinic data isolation

### **Key Principle:**
Integration tests verify that the permission matrix works correctly in realistic scenarios with real database operations, ensuring the security model prevents unauthorized access and maintains data integrity.

---

## 📋 **Phase 1: Test Infrastructure Setup**

### **Status: 🟡 PLANNED**

#### **1.1 Database Factory Creation**
Create comprehensive factories for generating real database entities with proper relationships.

**Files to Create:**
- ☐ `tests/integration/factories/DatabaseFactory.ts`
- ☐ `tests/integration/factories/TestScenarios.ts`
- ☐ `tests/integration/helpers/DatabaseHelpers.ts`
- ☐ `tests/integration/helpers/AuthHelpers.ts`
- ☐ `tests/integration/helpers/PermissionHelpers.ts`

**Database Factory Features:**
```typescript
// Example structure - not full implementation
export class DatabaseFactory {
  constructor(private payload: Payload)
  
  // Core entity creation
  async createRealPlatformStaff(overrides?: Partial<PlatformStaff>)
  async createRealClinicStaff(clinic?: Clinic, overrides?: Partial<ClinicStaff>)
  async createRealPatient(overrides?: Partial<Patient>)
  async createRealClinic(overrides?: Partial<Clinic>)
  async createRealDoctor(clinic: Clinic, overrides?: Partial<Doctor>)
  
  // Master data creation
  async createMasterData() // Countries, Cities, MedicalSpecialties, Treatments
  
  // Relationship creation
  async createClinicTreatmentRelationship(clinic: Clinic, treatment: Treatment)
  async createDoctorSpecialtyRelationship(doctor: Doctor, specialty: MedicalSpecialty)
  
  // Content creation
  async createReview(patient: Patient, clinic: Clinic, doctor: Doctor, treatment: Treatment)
  async createBlogPost(author: PlatformStaff, status: 'draft' | 'published')
}
```

**Test Scenarios Factory:**
```typescript
// Example structure - not full implementation
export class TestScenarios {
  constructor(private factory: DatabaseFactory)
  
  // Multi-clinic scenarios
  async createMultiClinicScenario()
  async createCrossClinicSecurityScenario()
  
  // User role scenarios
  async createAllUserRolesScenario()
  async createPermissionBoundaryScenario()
  
  // Content scenarios
  async createContentPublicationScenario()
  async createReviewModerationScenario()
  
  // Medical network scenarios
  async createComplexMedicalNetworkScenario()
}
```

#### **1.2 Test Helper Utilities**
Create utilities for database management, authentication context, and permission verification.

**Helper Features:**
```typescript
// Example structure - not full implementation
export class DatabaseHelpers {
  static async cleanDatabase()
  static async seedMasterData()
  static async createTestScenario(scenarioName: string)
  static async verifyDatabaseIntegrity()
}

export class AuthHelpers {
  static createPlatformStaffRequest(platformStaff: PlatformStaff)
  static createClinicStaffRequest(clinicStaff: ClinicStaff)
  static createPatientRequest(patient: Patient)
  static createAnonymousRequest()
}

export class PermissionHelpers {
  static async expectCanAccess(collection: string, operation: string, req: PayloadRequest, documentId?: number)
  static async expectCannotAccess(collection: string, operation: string, req: PayloadRequest, documentId?: number)
  static async expectOnlyOwnClinicData(collection: string, req: PayloadRequest, expectedClinicId: number)
  static async expectOnlyOwnData(collection: string, req: PayloadRequest, expectedUserId: number)
  static async verifyDataSegregation(collections: string[], scenarios: any[])
}
```

#### **1.3 Docker Test Database Enhancement**
Enhance existing Docker setup for integration testing with proper isolation.

**Files to Modify:**
- ☐ `docker-compose.test.yml` - Optimize for integration testing
- ☐ `tests/setup/integrationGlobalSetup.ts` - Enhance database setup
- ☐ `vitest.config.ts` - Add integration test configuration

---

## 🎯 **Phase 2: Cross-Clinic Security Tests**

### **Status: 🟡 PLANNED**

#### **2.1 Clinic Data Segregation Tests**
Verify that clinic staff can only access their own clinic's data.

**Files to Create:**
- ☐ `tests/integration/security/clinicDataSegregation.test.ts`

**Test Cases:**
```typescript
describe('Clinic Data Segregation', () => {
  beforeEach(async () => {
    await DatabaseHelpers.cleanDatabase()
    await DatabaseHelpers.seedMasterData()
  })

  ☐ test('Clinic Staff cannot access other clinics doctors', async () => {
    // Create two clinics with doctors
    // Verify staff from clinic A cannot see/modify doctors from clinic B
  })

  ☐ test('Clinic Staff cannot access other clinics treatments', async () => {
    // Create clinic-specific treatment offerings
    // Verify treatment access is properly scoped
  })

  ☐ test('Clinic Staff cannot access other clinics staff profiles', async () => {
    // Create multiple clinic staff
    // Verify staff can only see their own clinic colleagues
  })

  ☐ test('Clinic Staff cannot modify other clinics profiles', async () => {
    // Attempt cross-clinic profile modifications
    // Verify operations are rejected
  })
})
```

#### **2.2 Doctor Assignment Security Tests**
Verify doctor-related resource access is properly scoped.

**Files to Create:**
- `tests/integration/security/doctorResourceSecurity.test.ts`

**Test Cases:**
```typescript
describe('Doctor Resource Security', () => {
  test('DoctorSpecialties are scoped to clinic', async () => {
    // Create doctors in different clinics with specialties
    // Verify clinic staff can only manage their doctors specialties
  })

  test('DoctorTreatments are scoped to clinic', async () => {
    // Create doctor-treatment assignments across clinics
    // Verify scope filtering works correctly
  })

  test('Cross-clinic doctor modifications are prevented', async () => {
    // Attempt to modify doctors from other clinics
    // Verify operations fail with proper error handling
  })
})
```

#### **2.3 Platform Staff Override Tests**
Verify platform staff have unrestricted access while maintaining audit trails.

**Files to Create:**
- `tests/integration/security/platformStaffAccess.test.ts`

**Test Cases:**
```typescript
describe('Platform Staff Access', () => {
  test('Platform Staff can access all clinic data', async () => {
    // Create multi-clinic scenario
    // Verify platform staff can read/modify all resources
  })

  test('Platform Staff can manage clinic approvals', async () => {
    // Test clinic status field modifications
    // Verify only platform staff can approve/reject clinics
  })

  test('Platform Staff can moderate all reviews', async () => {
    // Create reviews across multiple clinics
    // Verify platform staff can moderate any review
  })
})
```

---

## 🔧 **Phase 3: Patient Privacy & Access Tests**

### **Status: 🟡 PLANNED**

#### **3.1 Patient Data Protection Tests**
Verify patient data is properly protected and scoped.

**Files to Create:**
- `tests/integration/security/patientDataProtection.test.ts`

**Test Cases:**
```typescript
describe('Patient Data Protection', () => {
  test('Patients can only access own reviews', async () => {
    // Create multiple patients with reviews
    // Verify each patient only sees their own reviews
  })

  test('Patients can only manage own favorite clinics', async () => {
    // Create favorite clinic relationships
    // Verify patients cannot see others favorites
  })

  test('Patients cannot access clinic staff data', async () => {
    // Attempt patient access to clinic staff collections
    // Verify access is properly denied
  })

  test('Patients cannot modify clinic or doctor data', async () => {
    // Attempt patient modifications to medical entities
    // Verify write operations are rejected
  })
})
```

#### **3.2 Review System Security Tests**
Verify review system maintains integrity and proper access control.

**Files to Create:**
- `tests/integration/security/reviewSystemSecurity.test.ts`

**Test Cases:**
```typescript
describe('Review System Security', () => {
  test('Patients cannot edit reviews after submission', async () => {
    // Create and submit reviews
    // Verify patients cannot modify submitted reviews
  })

  test('Only Platform Staff can moderate reviews', async () => {
    // Test review status modifications
    // Verify only platform staff can approve/reject
  })

  test('Review visibility respects approval status', async () => {
    // Create reviews with different statuses
    // Verify visibility rules for each user type
  })

  test('Review audit trail is maintained', async () => {
    // Test review modifications by platform staff
    // Verify audit fields are properly populated
  })
})
```

---

## 🎛️ **Phase 4: Content Publication Security Tests**

### **Status: 🟡 PLANNED**

#### **4.1 Content Access Control Tests**
Verify content publication controls work correctly.

**Files to Create:**
- `tests/integration/security/contentPublicationSecurity.test.ts`

**Test Cases:**
```typescript
describe('Content Publication Security', () => {
  test('Only Platform Staff can see draft content', async () => {
    // Create posts and pages with draft status
    // Verify visibility rules for each user type
  })

  test('Published content is visible to all users', async () => {
    // Create published content
    // Verify all user types can access published content
  })

  test('Non-platform users cannot modify content', async () => {
    // Attempt content modifications by clinic staff/patients
    // Verify operations are properly rejected
  })

  test('Content publication workflow is secure', async () => {
    // Test draft -> published transition
    // Verify only platform staff can publish content
  })
})
```

#### **4.2 Media Access Control Tests**
Verify media upload and access controls.

**Files to Create:**
- `tests/integration/security/mediaAccessSecurity.test.ts`

**Test Cases:**
```typescript
describe('Media Access Security', () => {
  test('Users can only manage own uploaded media', async () => {
    // Create media uploads by different users
    // Verify users only see their own uploads
  })

  test('Media visibility respects collection permissions', async () => {
    // Test media used in different collections
    // Verify media access follows collection rules
  })

  test('Platform Staff can manage all media', async () => {
    // Verify platform staff media management capabilities
  })
})
```

---

## 🏥 **Phase 5: Medical Network Integration Tests**

### **Status: 🟡 PLANNED**

#### **5.1 Complex Medical Relationship Tests**
Test access control with complex medical entity relationships.

**Files to Create:**
- `tests/integration/medical/complexRelationshipTests.test.ts`

**Test Cases:**
```typescript
describe('Complex Medical Relationship Tests', () => {
  test('Doctor-Treatment-Clinic relationships are properly scoped', async () => {
    // Create complex multi-clinic medical network
    // Verify relationship access is properly filtered
  })

  test('Medical specialty assignments respect clinic boundaries', async () => {
    // Create doctor specialty assignments across clinics
    // Verify scope filtering works for join collections
  })

  test('Treatment pricing is scoped to clinic access', async () => {
    // Create clinic-specific treatment pricing
    // Verify pricing visibility follows clinic access rules
  })
})
```

#### **5.2 Master Data Integrity Tests**
Verify master data protection and consistency.

**Files to Create:**
- `tests/integration/medical/masterDataIntegrity.test.ts`

**Test Cases:**
```typescript
describe('Master Data Integrity Tests', () => {
  test('Only Platform Staff can modify treatments', async () => {
    // Attempt treatment modifications by different user types
    // Verify only platform staff can make changes
  })

  test('Only Platform Staff can modify medical specialties', async () => {
    // Test medical specialty CRUD operations
    // Verify proper access restrictions
  })

  test('Master data is readable by all user types', async () => {
    // Verify read access to master data
    // Test with all user role contexts
  })

  test('Master data relationships are maintained', async () => {
    // Test cascading operations and referential integrity
    // Verify data consistency across operations
  })
})
```

---

## 🔄 **Phase 6: End-to-End Workflow Tests**

### **Status: 🟡 PLANNED**

#### **6.1 Complete User Journey Tests**
Test complete workflows from user perspective.

**Files to Create:**
- `tests/integration/workflows/userJourneyTests.test.ts`

**Test Cases:**
```typescript
describe('Complete User Journey Tests', () => {
  test('Clinic registration and approval workflow', async () => {
    // Test complete clinic onboarding process
    // Verify all permission checkpoints work correctly
  })

  test('Doctor assignment and management workflow', async () => {
    // Test doctor creation, specialty assignment, treatment setup
    // Verify clinic staff can only manage their own doctors
  })

  test('Patient review submission and moderation workflow', async () => {
    // Test complete review lifecycle
    // Verify all permission transitions work correctly
  })

  test('Content publication workflow', async () => {
    // Test content creation, review, and publication
    // Verify platform staff controls work correctly
  })
})
```

#### **6.2 Error Handling and Recovery Tests**
Test system behavior under error conditions.

**Files to Create:**
- `tests/integration/workflows/errorHandlingTests.test.ts`

**Test Cases:**
```typescript
describe('Error Handling and Recovery Tests', () => {
  test('Permission violations are properly logged', async () => {
    // Attempt unauthorized operations
    // Verify proper error logging and response
  })

  test('Database transaction rollbacks maintain consistency', async () => {
    // Test failed operations with database transactions
    // Verify data remains consistent after failures
  })

  test('Concurrent access scenarios handle permissions correctly', async () => {
    // Test concurrent operations by multiple users
    // Verify permission checks work under load
  })
})
```

---

## 📊 **Phase 7: Performance & Scale Tests**

### **Status: 🟡 PLANNED**

#### **7.1 Permission Performance Tests**
Verify permission checks don't significantly impact performance.

**Files to Create:**
- `tests/integration/performance/permissionPerformanceTests.test.ts`

**Test Cases:**
```typescript
describe('Permission Performance Tests', () => {
  test('Clinic scope filtering performs well with large datasets', async () => {
    // Create large datasets across multiple clinics
    // Measure permission check performance
  })

  test('Complex relationship queries maintain performance', async () => {
    // Test doctor-treatment-clinic relationship queries
    // Verify reasonable query execution times
  })

  test('User context resolution is efficient', async () => {
    // Test user role detection and context creation
    // Verify minimal overhead for permission checks
  })
})
```

#### **7.2 Scale Testing**
Test permission system with realistic data volumes.

**Files to Create:**
- `tests/integration/performance/scaleTests.test.ts`

**Test Cases:**
```typescript
describe('Scale Testing', () => {
  test('Permission system works with 100+ clinics', async () => {
    // Create large multi-clinic scenario
    // Verify permission isolation at scale
  })

  test('Performance remains acceptable with 1000+ doctors', async () => {
    // Create large doctor dataset
    // Test clinic scope filtering performance
  })

  test('Review moderation scales to high volumes', async () => {
    // Create thousands of reviews
    // Test platform staff moderation capabilities
  })
})
```

---

## 🚀 **Implementation Timeline**

### **Week 1: Infrastructure & Security Core**
- **Day 1**: Database factory and test helpers creation
- **Day 2**: Test scenario setup and authentication helpers
- **Day 3**: Cross-clinic security test implementation
- **Day 4**: Doctor resource security tests
- **Day 5**: Platform staff access verification tests

### **Week 2: Patient & Content Security**
- **Day 1**: Patient data protection tests
- **Day 2**: Review system security tests
- **Day 3**: Content publication security tests
- **Day 4**: Media access control tests
- **Day 5**: Security test validation and coverage analysis

### **Week 3: Medical Network & Workflows**
- **Day 1**: Complex medical relationship tests
- **Day 2**: Master data integrity tests
- **Day 3**: End-to-end user journey tests
- **Day 4**: Error handling and recovery tests
- **Day 5**: Workflow test validation and refinement

### **Week 4: Performance & Quality**
- **Day 1**: Permission performance tests
- **Day 2**: Scale testing implementation
- **Day 3**: Performance optimization and tuning
- **Day 4**: Final integration test validation
- **Day 5**: Documentation and deployment preparation

---

## 📈 **Success Criteria**

### **Functional Requirements**
- ✅ All permission matrix scenarios tested with real database
- ✅ Cross-clinic data segregation verified
- ✅ Patient privacy protection confirmed
- ✅ Platform staff oversight capabilities validated
- ✅ Content publication controls working correctly

### **Security Requirements**
- ✅ No unauthorized cross-clinic data access possible
- ✅ Patient data properly isolated and protected
- ✅ Master data modification restricted to platform staff
- ✅ Review system integrity maintained
- ✅ Audit trails properly maintained

### **Performance Requirements**
- ✅ Permission checks add <50ms overhead to operations
- ✅ Large dataset queries complete within reasonable time
- ✅ System scales to realistic production volumes
- ✅ Concurrent access scenarios perform correctly

---

## 🔗 **Related Files**

### **Files to Create:**
- `tests/integration/factories/DatabaseFactory.ts`
- `tests/integration/factories/TestScenarios.ts`
- `tests/integration/helpers/DatabaseHelpers.ts`
- `tests/integration/helpers/AuthHelpers.ts`
- `tests/integration/helpers/PermissionHelpers.ts`
- All test files listed in phases above

### **Files to Modify:**
- `docker-compose.test.yml`
- `tests/setup/integrationGlobalSetup.ts`
- `vitest.config.ts`
- `package.json` (test scripts)

### **Related Documentation:**
- `docs/permission-implementation-plan.md` (parent document)
- `docs/unit-test-implementation-plan.md` (companion document)
- `docs/testing-setup.md` (existing test setup documentation)

---

**Last Updated:** July 31, 2025 | **Status:** Planning Phase
