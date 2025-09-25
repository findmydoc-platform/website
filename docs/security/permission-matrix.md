# Permission Matrix (Authoritative)

Security-focused reference for roles and collection access; business narrative intentionally omitted.

---

## 👥 Roles (Condensed)
* Platform Staff: Global administrative & moderation authority (RWDA all collections; approval + master data control).
* Clinic Staff: Post-approval, manage only their clinic's operational data; scoped staff/doctor reads; self profile update.
* Patients: Read public data; manage own reviews (create-only), favorites, and profile updates.
* Anonymous: Read-only approved public content.

---

## 🔐 **Permission Model (RWDA System)**

### **Permission Types Explained**

**R - Read**: View and access data
- Browse listings and profiles
- View approved content and reviews
- Access search and discovery features

**W - Write**: Create and modify data
- Add new content and profiles
- Update existing information
- Submit forms and applications

**D - Delete**: Remove data from the platform
- Remove outdated or incorrect information
- Delete inappropriate content
- Archive completed processes

**A - Admin**: Administrative functions
- Approve pending content
- Moderate submissions
- Manage user permissions and roles

### **Access Control Principles**

**Least Privilege**: Users receive the minimum permissions necessary for their role
**Clinic Segregation**: Clinic staff can only access their own clinic's data
**Moderation Flow**: All public content requires Platform Staff approval
**Data Protection**: Personal and sensitive data is restricted to authorized users only

---

## 📊 **Complete Permission Matrix**

### **Permission Matrix Legend**

- **RWDA**: Full access (Read, Write, Delete, Admin)
- **RWA**: Read, Write, Admin (cannot delete)
- **RW**: Read and Write access
- **R**: Read-only access
- **–**: No access
- **(scoped)**: Access limited to specific data subset
- **(condition)**: Access depends on data status or approval

| **Data Collection**    | **Platform Staff**  | **Clinic Staff**                                          | **Patients**                         | **Anonymous**   |
| ---------------------- | ------------------- | --------------------------------------------------------- | ------------------------------------ | --------------- |
| **User Management**    |
| BasicUsers             | RWDA                | –                                                         | –                                    | –               |
| PlatformStaff          | RWDA †              | –                                                         | –                                    | –               |
| ClinicStaff            | RW † *(post-approval, own clinic)* + W *(own profile only)* ‡ | – *(authentication denied until approval)* | –                                    | –               |
| Patients               | RWDA                | –                                                         | R + Update *(own profile; no self-create/delete)* | –               |
| **Content Management** |
| Posts (Blog Content)   | RWDA                | R *(published)*                        | R *(published)*                      | R *(published)* |
| Pages (Static Content) | RWDA                | R *(published)*                        | R *(published)*                      | R *(published)* |
| **Medical Network**    |
| Doctors                | RWDA                | RWA *(own clinic)*                     | R                                    | R               |
| Clinics                | RWDA                | RW *(own profile; update only)*        | R                                    | R *(approved)*  |
| DoctorSpecialties      | RWDA                | RWA *(own clinic)*                     | R                                    | R               |
| DoctorTreatments       | RWDA                | RWA *(own clinic)*                     | R                                    | R               |
| ClinicTreatments       | RWDA                | RWA *(own clinic)*                     | R                                    | R               |
| **Patient Engagement** |
| FavoriteClinics        | RWDA                | –                                     | RWDA *(own list)*                    | –               |
| Reviews                | RWDA *(moderation)* | R                                     | R *(approved)*, W *(create only)*    | R *(approved)*  |
| **Master Data**        |
| Treatments             | RWDA                | R                                     | R                                    | R               |
| MedicalSpecialties     | RWDA                | R                                     | R                                    | R               |
| **Geographic Data**    |
| Countries              | RWDA                | R                                     | R                                    | R               |
| Cities                 | RWDA                | R                                     | R                                    | R               |
| **Supporting Data**    |
| PlatformContentMedia (Platform marketing assets) | RWDA | – | R *(consumed via content)* | R |
| ClinicMedia (Clinic-owned files/images) | RWDA                | RWD *(own clinic)*                     | R                                    | R *(served only when referenced)* |
| DoctorMedia (Doctor-owned images) | RWDA | RWD *(own clinic)* | R | R |
| UserProfileMedia (User & Patient avatars) | RWDA | R *(staff profiles in own clinic)* | RW *(own)* | – |
| Tags                   | RWDA                | R                                     | R                                    | R               |
| Categories             | RWDA                | R                                     | R                                    | R               |
| Accreditation          | RWDA                | R                                     | R                                    | R               |
| **Intake / Applications** |  |  |  |  |
| ClinicApplications     | RWDA *(Platform)*   | –                                     | –                                    | C *(create only)* |

### Notes on Specific Rows
* ClinicStaff: Authentication is denied entirely until the staff profile is approved. After approval, Clinic Staff can read all staff in their own clinic and update only their own profile. Create/Delete operations occur exclusively via the BasicUsers lifecycle (no direct create/delete even for Platform Staff) †‡.
* Patients: Patients can update their own profile but cannot create or delete their patient record (provisioned via Supabase/Auth).
* Reviews: Patients can create reviews. Only Platform can edit or delete reviews. Non-platform users only read approved reviews.
* PlatformContentMedia: Publicly readable marketing / page assets. Write restricted to Platform.
* ClinicMedia: Clinic Staff + Platform can mutate scoped assets; public/anonymous read only via UI references (no broad listing). Ownership immutable after create. Stored with per-clinic folder path. Future controlled public exposure can be enabled either (a) via targeted server-side fetches using `overrideAccess: true` or (b) by introducing a boolean `public` (e.g. `isPublic`) field that gates anonymous read access.
* DoctorMedia: Similar scoping to ClinicMedia; ownership derives from doctor -> clinic relationship; `clinic` denormalized for access filtering.
* UserProfileMedia: Self or Platform management of avatars; patients supported.
* Global Upload Limit: 5MB per file (configured in root Payload `upload.limits.fileSize`).
* † Provisioning and deletion of PlatformStaff & ClinicStaff profiles are performed indirectly through BasicUsers lifecycle hooks (no direct profile create/delete endpoints or UI forms).
* ‡ ClinicStaff row: RW shown is conditional; before approval there is no authentication and therefore no access.

---

## 🛡️ Security Notes
* Cross-clinic isolation enforced in access functions (Clinic Staff never read other clinics' protected data).
* Staff profile create/delete only via BasicUsers lifecycle hooks (no direct profile CRUD endpoints/forms).
* Clinic Staff authentication denied until profile approved (no partial API access pre-approval).
* Platform Staff are sole moderators (reviews, master data, approvals).
* Patients cannot self-create/delete patient record; identity originates in Supabase.

## 📋 Audit & Logging
Create/update/delete + provisioning events logged (basic logs only; advanced metrics deferred).

---

## 🔄 Key Workflows (Security-Focused)
### Clinic Onboarding
1. Anonymous submission → `clinicApplications` (status `submitted`)
2. Platform approval → provisioning hook creates Clinic (pending), BasicUser (clinic), ClinicStaff (pending)
3. Platform finalizes & approves Clinic; ClinicStaff approved → gains access

---

## 🔄 **Permission Workflows & User Journeys**

### **Clinic Onboarding Process**
1. **Platform Staff** creates clinic profile and initial configuration
2. **Platform Staff** approves clinic listing for public visibility
3. **Clinic Staff** applies / is provisioned (BasicUser + pending ClinicStaff profile) — authentication still denied
4. **Platform Staff** reviews and approves clinic staff application (status -> approved)
5. **Clinic Staff** (now approved) authenticates, completes profile, and adds doctors / service offerings

### Review Moderation
1. Patient submits review (pending)
2. Platform Staff approves → public or rejects → hidden

---

## (Deferred / Future – Tracked Elsewhere)
* Structured auth & approval metrics
* Profile recovery automation

## 🔗 **Related Documentation**

For technical implementation details, see:
* **Authentication System Guide** (`authentication-system.md`)
* **Supabase Provisioning** (`supabase-provisioning.md`)
* **Auth Flow Diagram** (`auth-flow-diagram.md`)

External reference:
* **PayloadCMS Access Control Documentation**: https://payloadcms.com/docs/access-control/overview

---

**Document Maintenance**: This permission matrix should be reviewed and updated whenever new user roles, data collections, or security requirements are introduced to the platform.
