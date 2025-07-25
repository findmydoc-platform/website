# Permission Matrix Implementation Plan - PaloTMS Platform

*Status: In Progress | Last Updated: July 23, 2025*

---

## 🎯 **Overview**

This document tracks the implementation of the comprehensive permission matrix for the PaloTMS medical platform. The goal is to implement proper access control across all PayloadCMS collections according to the defined permission matrix.

---

## 🏗️ **Architecture Decisions**

### **Data Model Approach:**
- ✅ **BasicUsers remains unchanged** (only `userType: 'clinic'|'platform'`)
- ✅ **ClinicStaff Profiles** get `clinic` relationship field
- ✅ **Assignment via Profiles**, not via BasicUsers
- ✅ **Access Control** uses Profile relationships

### **Key Principle:**
Platform creates clinics and assigns clinic staff to them. Clinic staff can only manage resources belonging to their assigned clinic.

---

## 🚨 **Phase 1: Critical Security Fixes & Data Model**

### **Status: ✅ COMPLETED**

#### **1.1 ClinicStaff Collection Enhancement** ✅ **COMPLETED**
- [x] Add `clinic` relationship field to ClinicStaff
- [x] Update admin defaultColumns to show clinic
- [x] Create `getUserAssignedClinicId` utility function
- [x] Update ClinicStaff access logic to scope by clinic
- [x] Only Platform Staff can create/update/delete ClinicStaff

**Files Modified:**
- `src/collections/ClinicStaff.ts`
- `src/access/utils/getClinicAssignment.ts` (new)

#### **1.2 PlatformStaff Access Control Fix** ✅ **COMPLETED**
**Fixed:** `read: () => true` security hole
**Implemented:**
```typescript
access: {
  read: isPlatformBasicUser,
  create: isPlatformBasicUser,
  update: isPlatformBasicUser, 
  delete: isPlatformBasicUser,
}
```

#### **1.3 Master Data Protection** ✅ **COMPLETED**
**Collections:** `Treatments`, `MedicalSpecialties`
**Fixed:** Clinic users can no longer create/update master data
**Implemented:** Only Platform Staff can manage master data
```typescript
access: {
  read: anyone,
  create: isPlatformBasicUser,  // Only Platform!
  update: isPlatformBasicUser,  // Only Platform!
  delete: isPlatformBasicUser,
}
```

#### **1.4 Reviews Access Logic Overhaul** ✅ **COMPLETED**
**Fixed:** Proper role-based access control
**Implemented:**
- Anonymous: Only approved reviews (read)
- Platform: Full access (moderation)
- Clinic: Read only
- Patient: Only own reviews (RWA)

#### **1.5 Migration Requirements**
After collection changes:
```bash
pnpm payload migrate:create phase-1-security-fixes
pnpm payload migrate
```

---

## 🎯 **Phase 2: Scope-Based Access Control Foundation**

### **Status: ✅ COMPLETED**

#### **2.1 Reusable Access Functions** ✅ **COMPLETED**
Created `src/access/scopeFilters.ts` with:
- ✅ `platformOrOwnClinicResource`: Platform full access OR clinic scope filter
- ✅ `platformOrOwnPatientResource`: Platform full access OR patient scope filter  
- ✅ `platformOrOwnClinicProfile`: Platform full access OR own clinic profile
- ✅ `platformOrOwnClinicDoctorResource`: Platform full access OR clinic scope via doctor relationship
- ✅ `ownResourceOnly`: User-owned resource access

**Files Created:**
- `src/access/scopeFilters.ts` (new)

#### **2.2 Collections with Clinic Scope** ✅ **COMPLETED**
Updated access control for:
- ✅ **Doctors**: Clinic can only manage doctors from their clinic (`platformOrOwnClinicResource`)
- ✅ **Clinics**: Clinic can only update their own profile (`platformOrOwnClinicProfile`)
- ✅ **DoctorSpecialties**: Clinic scope for assignments via doctor relationship (`platformOrOwnClinicDoctorResource`)
- ✅ **DoctorTreatments**: Clinic scope for assignments via doctor relationship (`platformOrOwnClinicDoctorResource`)  
- ✅ **ClinicTreatments**: Clinic scope for assignments (`platformOrOwnClinicResource`)
- ✅ **ClinicStaff**: Made `clinic` field optional to allow registration flow

**Files Modified:**
- `src/collections/Doctors.ts`
- `src/collections/Clinics.ts` 
- `src/collections/DoctorSpecialties.ts`
- `src/collections/DoctorTreatments.ts`
- `src/collections/ClinicTreatments.ts`
- `src/collections/ClinicStaff.ts`

#### **2.3 Collections with Patient Scope**
- **FavoriteClinics**: Already correctly implemented
- **Reviews**: Patient scope for own reviews

---

## 🔧 **Phase 3: Advanced Features**

### **Status: ✅ COMPLETED**

#### **3.1 Automatic Assignment Hooks** 🎯 **DEFERRED** 
**Status:** Moved to GitHub Issue #259  
**Reason:** Feature documented for future implementation to focus on core security features first

#### **3.2 Field-Level Security** ✅ **COMPLETED**
Implemented granular field-level access control:
- ✅ **Reviews.status** - Only Platform Staff can moderate reviews (pending → approved/rejected)
- ✅ **Clinics.status** - Only Platform Staff can approve clinic listings (draft → pending → approved/rejected)  
- ✅ **ClinicStaff.status** - Only Platform Staff can approve staff applications (pending → approved/rejected)
- ✅ **UI Integration** - Status fields hidden from non-platform users in admin interface

**Security Benefits:**
- Prevents patients from self-approving their own reviews
- Prevents clinics from self-approving their listings  
- Prevents staff from self-approving their applications
- Ensures all moderation flows through Platform Staff only

**Files Created:**
- `src/access/fieldAccess.ts` (new) - Field-level access control utilities

**Files Modified:**
- `src/collections/Reviews.ts` - Added field-level status protection
- `src/collections/Clinics.ts` - Added field-level status protection  
- `src/collections/ClinicStaff.ts` - Added field-level status protection

#### **3.3 Validation Hooks** 🎯 **DEFERRED**  
**Status:** Moved to GitHub Issue #260  
**Reason:** Implementation complete but deferred for future deployment to focus on core permission matrix completion

Add data integrity validation:
- Prevent cross-clinic data manipulation attempts
- Ensure referential integrity (doctor belongs to clinic before assignment)
- Validate clinic staff can only access their assigned clinic's resources

---

## 📚 **Phase 4: Documentation & Testing**

### **Status: 🔴 IN PROGRESS**

#### **4.1 Documentation Creation & Translation**
- [x] **Replace German docs with English** - Convert existing German documentation to comprehensive English versions
- [x] **Permission Matrix Documentation** (`docs/permission-matrix.md`) - Complete permission matrix with implementation details ✅ **COMPLETED**
- [ ] **Access Control Implementation Guide** (`docs/access-control-guide.md`) - Technical implementation documentation
- [ ] **Security Architecture Overview** (`docs/security-architecture.md`) - High-level security design documentation

### **📋 Detailed Documentation Checklist**

#### **4.1.1 Permission Matrix Documentation** (`docs/permission-matrix.md`)
**Business Context & Overview:**
- [ ] Medical platform business model explanation
- [ ] User roles and responsibilities (Platform Staff, Clinic Staff, Patients, Anonymous)
- [ ] Permission model rationale (RWDA system explanation)
- [ ] Compliance and regulatory requirements addressed

**Technical Implementation:**
- [ ] Complete collection-by-collection permission matrix table
- [ ] Access control patterns used (scope filters, field-level security) - **conceptual explanation only**
- [ ] PayloadCMS integration approach - **architectural overview without code**
- [ ] Role detection and user assignment logic - **workflow diagrams and explanations**

**Security Features:**
- [ ] Field-level access control implementation - **business impact and security benefits**
- [ ] Scope-based filtering mechanisms - **data segregation principles**
- [ ] Data integrity validation (deferred features) - **future security enhancements**
- [ ] Authentication and authorization flow - **user journey and security checkpoints**

#### **4.1.2 Access Control Implementation Guide** (`docs/access-control-guide.md`)
**Developer Implementation Guide:**
- [ ] How to implement new collections with proper access control - **principles and patterns**
- [ ] Scope filter utility functions reference - **function signatures and usage patterns**
- [ ] Field-level access control patterns - **minimal examples with links to PayloadCMS docs**
- [ ] Common access control patterns and examples - **conceptual patterns, not full code blocks**

**Code Architecture:**
- [ ] File organization and structure (`src/access/`, `src/collections/`) - **directory structure and naming conventions**
- [ ] Utility functions documentation (`scopeFilters.ts`, `fieldAccess.ts`) - **API reference with links to source**
- [ ] Access control testing patterns - **testing approach and principles**
- [ ] Migration strategies for permission changes - **workflow and best practices**

**Best Practices & References:**
- [ ] Security considerations and common pitfalls - **conceptual guidance**
- [ ] Performance implications of access control - **optimization principles**
- [ ] Debugging access control issues - **troubleshooting methodology**
- [ ] Code review checklist for permissions - **verification points**

**Official PayloadCMS Documentation Links:**
- [ ] **Access Control Overview**: https://payloadcms.com/docs/access-control/overview
- [ ] **Collection Access Control**: https://payloadcms.com/docs/access-control/collections
- [ ] **Field-level Access Control**: https://payloadcms.com/docs/access-control/fields
- [ ] **Hooks Documentation**: https://payloadcms.com/docs/hooks/overview
- [ ] **Collection Hooks**: https://payloadcms.com/docs/hooks/collections
- [ ] **Authentication Overview**: https://payloadcms.com/docs/authentication/overview
- [ ] **Local API**: https://payloadcms.com/docs/local-api/overview (for testing)

#### **4.1.3 Security Architecture Overview** (`docs/security-architecture.md`)
**High-Level Architecture:**
- [ ] Multi-tenant security model explanation
- [ ] Clinic data segregation approach
- [ ] Profile-based assignment vs user-based assignment
- [ ] Platform staff oversight model

**Security Layers:**
- [ ] Collection-level access control
- [ ] Field-level security controls
- [ ] Scope-based data filtering
- [ ] Validation hooks for data integrity (deferred)

**Compliance & Auditing:**
- [ ] Healthcare data protection compliance
- [ ] Audit trail capabilities
- [ ] Data segregation guarantees
- [ ] Privacy protection measures

#### **4.1.4 Migration & Deployment Guide** (`docs/deployment-guide.md`)
**Database Migration:**
- [ ] Schema change migration process
- [ ] Permission system deployment steps
- [ ] Rollback procedures
- [ ] Data integrity verification

**Production Considerations:**
- [ ] Performance impact analysis
- [ ] Monitoring and alerting for permission issues
- [ ] User training requirements
- [ ] Support documentation for common issues

#### **4.2 Testing Suite**
Automated tests for each collection covering:
- Platform Staff: Full RWDA access
- Clinic Staff: Only own clinic resources
- Patient: Only own resources
- Anonymous: Only approved/published content

#### **4.3 Implementation Requirements for Codebase Verification**

Before creating comprehensive tests, the following specific requirements must be verified and implemented in the codebase:

##### **Content Publication Controls**
**Blog Posts & Pages**: All user roles except Platform Staff can only read published content. Draft or pending content must be invisible to Clinic Staff, Patients, and Anonymous users.

##### **Patient Review Modification Controls**
**Review Edit Restrictions**: Patients can only modify their reviews while they are in approved status. Once a review is approved, any modification must trigger a new approval workflow, temporarily hiding the review until re-approved by Platform Staff.

##### **Anonymous User Transparency**
**Comprehensive Public Access**: Anonymous users must have read access to all medical network data (DoctorSpecialties, DoctorTreatments, ClinicTreatments) to enable transparent healthcare decision-making without requiring account creation. The platform prioritizes transparency over user registration.

##### **Patient vs Anonymous Access Alignment**
**Similar Read Permissions**: Patients and Anonymous users have nearly identical read permissions for public data. The primary difference is that Patients have additional write permissions for their personal data (reviews, favorites) while Anonymous users have no write permissions.

### **📈 Documentation Priority Order**

**Phase 4.1 Priority Sequence:**
1. **✅ COMPLETED**: `docs/permission-matrix.md` - Core business and technical reference
2. **🟡 MEDIUM PRIORITY**: `docs/access-control-guide.md` - Developer implementation guide  
3. **🟡 MEDIUM PRIORITY**: `docs/security-architecture.md` - Architecture overview
4. **🟢 LOW PRIORITY**: `docs/deployment-guide.md` - Migration and deployment procedures

**Rationale:**
- Permission matrix serves as the primary reference for both business and technical teams
- Implementation guide is essential for developers adding new features
- Architecture overview provides context for security decisions
- Deployment guide can be created closer to production deployment

---

## 📋 **Current Permission Matrix Status**

| Collection | Platform | Clinic | Patient | Anonym | Implementation Status |
|------------|----------|--------|---------|--------|--------------------|
| BasicUsers | RWDA | – | – | – | ✅ Correct |
| PlatformStaff | RWDA | – | – | – | ✅ **FIXED** |
| ClinicStaff | RWDA | RWA *(own clinic)* | – | – | ✅ **FIXED** |
| Patients | RWDA | – | RWA *(own)* | – | ✅ Correct |
| Posts | RWDA | R *(published)* | R *(published)* | R *(published)* | ✅ **FIXED** |
| Pages | RWDA | R *(published)* | R *(published)* | R *(published)* | ✅ **FIXED** |
| Doctors | RWDA | RWA *(own clinic)* | R | R | ✅ **IMPLEMENTED** |
| Clinics | RWDA | RWA *(own profile)* | R *(approved)* | R *(approved)* | ✅ **FIXED** |
| FavoriteClinics | RWDA | – | RWDA *(own)* | – | ✅ **FIXED** |
| Treatments | RWDA | R | R | R | ✅ **FIXED** |
| MedicalSpecialties | RWDA | R | R | R | ✅ **FIXED** |
| DoctorSpecialties | RWDA | RWA *(own clinic)* | – | – | ✅ **IMPLEMENTED** |
| DoctorTreatments | RWDA | RWA *(own clinic)* | – | – | ✅ **IMPLEMENTED** |
| ClinicTreatments | RWDA | RWA *(own clinic)* | – | – | ✅ **IMPLEMENTED** |
| Media | RWDA | RWDA *(own)* | R | R | 🟡 Missing scope |
| Tags | RWDA | R | R | R | ✅ Correct |
| Categories | RWDA | R | R | R | ✅ Correct |
| Countries | RWDA | R | R | R | ✅ Correct |
| Cities | RWDA | R | R | R | ✅ Correct |
| Accreditation | RWDA | R | R | R | ✅ Correct |
| Reviews | RWDA *(mod)* | R *(approved)* | RWA *(own, approved)* | R *(approved)* | ✅ **FIXED** |

**Legend:**
- ✅ Correct: Properly implemented according to matrix
- 🟡 Missing scope: Correct permissions but missing scope filters
- 🔴 Security issue: Incorrect permissions that need immediate fix
- 🚨 Critical security issue: Major privacy/security breach

---

## 🚀 **Implementation Timeline**

### **Week 1: Phase 1 - Critical Security Fixes**
- [x] Day 1: ClinicStaff with clinic relationship
- [ ] Day 2: PlatformStaff access fix
- [ ] Day 3: Master data protection (Treatments, MedicalSpecialties)  
- [ ] Day 4: Reviews access logic overhaul
- [ ] Day 5: Testing & migration

### **Week 2: Phase 2 - Scope Implementation**
- [ ] Day 1: Utility functions and scope filters
- [ ] Day 2: Doctors, Clinics with scope
- [ ] Day 3: DoctorX, ClinicTreatments with scope
- [ ] Day 4: Media with ownership logic
- [ ] Day 5: Testing & validation

### **Week 3: Phase 3 - Advanced Features**
- [ ] Day 1: Automatic assignment hooks
- [ ] Day 2: Field-level security
- [ ] Day 3: Validation hooks
- [ ] Day 4: Performance optimization
- [ ] Day 5: Integration testing

### **Week 4: Phase 4 - Documentation**
- [ ] Day 1: English documentation
- [ ] Day 2: Implementation guide
- [ ] Day 3: Testing suite
- [ ] Day 4: Code review
- [ ] Day 5: Final validation & deployment

---

## 🔗 **Related Files**

### **Modified Files:**
- `src/collections/ClinicStaff.ts`
- `src/access/utils/getClinicAssignment.ts`

### **Files to Modify:**
- `src/collections/PlatformStaff.ts`
- `src/collections/Treatments.ts`
- `src/collections/MedicalSpecialities.ts`
- `src/collections/Reviews.ts`
- `src/access/scopeFilters.ts` (new)

### **Documentation:**
- `docs/permission-concept.md` (existing, German) → **TO BE REPLACED**
- `docs/permission-matrix.md` (to create, English)
- `docs/access-control-guide.md` (to create, English)
- `docs/security-architecture.md` (to create, English)
- `docs/deployment-guide.md` (to create, English)

---

**Last Updated:** July 23, 2025 | **Current Phase:** Phase 4 (Documentation & Testing)
