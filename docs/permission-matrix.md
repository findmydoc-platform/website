# Permission Matrix - findmydoc Medical Platform

*Last Updated: July 24, 2025 | Version: 1.0*

---

## 🎯 **Executive Summary**

The findmydoc medical platform implements a comprehensive role-based access control (RBAC) system designed to ensure data security, regulatory compliance, and operational efficiency across multiple medical clinics. This document serves as the definitive reference for understanding user permissions, security boundaries, and access control policies within the platform.

---

## 🏥 **Business Context & Platform Overview**

### **Medical Platform Model**
findmydoc operates as a multi-tenant medical platform connecting patients with healthcare providers across multiple independent clinics. The platform facilitates:

- **Patient Discovery**: Patients can search and discover medical clinics and specialists
- **Clinic Management**: Healthcare facilities can manage their profiles, staff, and service offerings
- **Provider Networks**: Doctors and specialists can showcase their expertise and treatments
- **Quality Assurance**: Patient reviews and platform moderation ensure service quality
- **Compliance**: Healthcare data protection and regulatory compliance across all operations

### **Multi-Tenant Architecture**
Each clinic operates as an independent tenant within the platform while sharing common infrastructure:
- **Data Segregation**: Clinic data is strictly separated and protected
- **Shared Resources**: Common medical specialties, treatments, and geographic data
- **Platform Oversight**: Centralized moderation and quality control
- **Scalable Operations**: Support for unlimited clinic growth

---

## 👥 **User Roles & Responsibilities**

### **🔧 Platform Staff** (Platform Administrators)
**Primary Responsibility**: Overall platform management, moderation, and oversight

**Key Functions**:
- Approve and manage clinic listings on the platform
- Moderate patient reviews and ensure content quality
- Manage master data (medical specialties, treatments, geographic data)
- Approve clinic staff applications and credentials
- Monitor platform compliance and security
- Provide technical support and system administration

**Access Level**: Full administrative access (RWDA) across all platform data

### **🏥 Clinic Staff** (Healthcare Facility Administrators)
**Primary Responsibility**: Manage their clinic's presence and operations on the platform

**Key Functions**:
- Update clinic profile information and service offerings
- Manage doctor profiles associated with their clinic
- Define treatment offerings and pricing for their facility
- Assign medical specialties and treatments to their doctors
- Monitor their clinic's patient reviews and ratings
- Coordinate staff onboarding and credential management

**Access Level**: Full access to their clinic's data only (clinic-scoped RWDA)

### **👤 Patients** (Healthcare Consumers)
**Primary Responsibility**: Discover healthcare services and share experiences

**Key Functions**:
- Search and browse approved clinic listings
- View doctor profiles and specialties
- Read approved patient reviews and ratings
- Create and manage their own reviews and ratings
- Maintain a list of favorite clinics
- Access their personal health service history

**Access Level**: Read access to public data, full access to own data only

### **🌐 Anonymous Users** (Public Visitors)
**Primary Responsibility**: Discover healthcare services without platform commitment

**Key Functions**:
- Browse approved clinic listings
- View doctor profiles and specialties
- Read approved patient reviews and ratings
- Access general platform information and content

**Access Level**: Read-only access to approved public content

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

| **Data Collection**    | **Platform Staff**  | **Clinic Staff**     | **Patients**        | **Anonymous**   |
| ---------------------- | ------------------- | -------------------- | ------------------- | --------------- |
| **User Management**    |
| BasicUsers             | RWDA                | –                    | –                   | –               |
| PlatformStaff          | RWDA                | –                    | –                   | –               |
| ClinicStaff            | RWDA                | RWA *(own clinic)*   | –                   | –               |
| Patients               | RWDA                | –                    | RWA *(own profile)* | –               |
| **Content Management** |
| Posts (Blog Content)   | RWDA                | R *(published)*      | R *(published)*     | R *(published)* |
| Pages (Static Content) | RWDA                | R *(published)*      | R *(published)*     | R *(published)* |
| **Medical Network**    |
| Doctors                | RWDA                | RWA *(own clinic)*   | R                   | R               |
| Clinics                | RWDA                | RWA *(own profile)*  | R                   | R *(approved)*  |
| DoctorSpecialties      | RWDA                | RWA *(own clinic)*   | R                   | R               |
| DoctorTreatments       | RWDA                | RWA *(own clinic)*   | R                   | R               |
| ClinicTreatments       | RWDA                | RWA *(own clinic)*   | R                   | R               |
| **Patient Engagement** |
| FavoriteClinics        | RWDA                | –                    | RWDA *(own list)*   | –               |
| Reviews                | RWDA *(moderation)* | R                    | RWA *(own reviews, approved only)* | R *(approved)*  |
| **Master Data**        |
| Treatments             | RWDA                | R                    | R                   | R               |
| MedicalSpecialties     | RWDA                | R                    | R                   | R               |
| **Geographic Data**    |
| Countries              | RWDA                | R                    | R                   | R               |
| Cities                 | RWDA                | R                    | R                   | R               |
| **Supporting Data**    |
| Media (Files/Images)   | RWDA                | RWDA *(own uploads)* | R                   | R               |
| Tags                   | RWDA                | R                    | R                   | R               |
| Categories             | RWDA                | R                    | R                   | R               |
| Accreditation          | RWDA                | R                    | R                   | R               |

---

## 🛡️ **Security Features & Implementation**

### **Security Architecture Principles**

**1. Role-Based Access Control**
Different user roles have distinct permission levels designed to match their responsibilities. Platform Staff have oversight capabilities, while Clinic Staff focus on their own facility's data management.

**2. Data Scoping & Filtering**
Users automatically see only data relevant to their role and responsibilities. This prevents information overload and reduces the risk of accidental cross-clinic operations.

**3. Administrative Field Protection**
Certain fields require administrative approval to maintain data quality and platform standards. Status fields for reviews, clinics, and staff applications are restricted to Platform Staff to ensure proper moderation workflows.

**4. Transparency Through Public Access**
Anonymous users can access comprehensive clinic and doctor information to make informed healthcare decisions without requiring an account, supporting platform transparency and trust.

### **Data Segregation Principles**

**Clinic Independence**: Each clinic operates within its own data boundary, preventing access to competitor information while maintaining operational efficiency.

**Personal Data Control**: Patients maintain full control over their personal information, reviews, and preferences, with no external access to private data.

**Centralized Standards**: Master data and platform-wide information remain consistent through centralized management while allowing clinic-specific customization.

---

## 📋 **Compliance & Regulatory Alignment**

### **Healthcare Data Protection**
The permission system supports compliance with healthcare data protection regulations:

**Data Minimization**: Users access only necessary data for their role
**Purpose Limitation**: Data access aligned with specific business functions
**Access Controls**: Comprehensive logging and audit capabilities
**Data Segregation**: Physical separation of clinic and patient data

### **Privacy Protection Measures**
**Consent Management**: Patients control their own review and favorite data
**Right to Access**: Users can view all data associated with their account
**Right to Rectification**: Users can update their own information
**Right to Erasure**: Platform Staff can remove data when required

### **Audit Trail Capabilities**
**User Actions**: All create, update, and delete operations are logged
**Access Patterns**: User login and data access is monitored
**Permission Changes**: Role and permission modifications are tracked
**Data Flows**: Cross-system data movement is documented

---

## 🚀 **Business Impact & Benefits**

### **Operational Efficiency**
**Streamlined Workflows**: Users see only relevant data for their role
**Reduced Errors**: Scope limitations prevent accidental cross-clinic operations
**Faster Onboarding**: Clear role definitions accelerate user training

### **Risk Mitigation**
**Data Breach Prevention**: Multi-layer security reduces exposure risk
**Compliance Assurance**: Built-in regulatory alignment
**Competitive Protection**: Clinic data isolation prevents information leakage

### **Scalability & Growth**
**Unlimited Clinic Growth**: Architecture supports infinite clinic addition
**Consistent User Experience**: Standardized permissions across all tenants
**Maintainable Security**: Centralized permission management

---

## 🔄 **Permission Workflows & User Journeys**

### **Clinic Onboarding Process**
1. **Platform Staff** creates clinic profile and initial configuration
2. **Platform Staff** approves clinic listing for public visibility
3. **Clinic Staff** receives access and begins profile completion
4. **Clinic Staff** adds doctors and defines service offerings
5. **Platform Staff** reviews and approves clinic staff applications

### **Content Moderation Flow**
1. **Patients** submit reviews and ratings for clinic services
2. **Reviews** enter pending status, invisible to public users
3. **Platform Staff** moderates content for appropriateness and accuracy
4. **Approved reviews** become visible to **Anonymous** and **Patient** users
5. **Rejected reviews** are removed or returned for revision

### **Doctor Profile Management**
1. **Clinic Staff** creates doctor profiles within their clinic
2. **Clinic Staff** assigns medical specialties and treatment capabilities
3. **Doctor profiles** inherit clinic approval status for public visibility
4. **Platform Staff** can review and moderate doctor credentials if needed

---

## 📈 **Future Security Enhancements**

### **Planned Advanced Features**
The permission system is designed to accommodate future security enhancements:

**Data Integrity Validation**: Automatic cross-clinic data manipulation prevention
**Automated Assignment Workflows**: Streamlined clinic staff and doctor onboarding
**Enhanced Audit Logging**: Real-time security monitoring and alerting
**Role-Based UI Customization**: Dynamic interface adaptation based on permissions

### **Compliance Evolution**
**Regulatory Updates**: System designed to accommodate changing healthcare regulations
**International Expansion**: Permission framework supports multi-jurisdiction compliance
**Advanced Privacy Controls**: Enhanced patient consent and data control mechanisms

---

## 🔗 **Related Documentation**

For technical implementation details, see:
- **Access Control Implementation Guide** (`docs/access-control-guide.md`)
- **Security Architecture Overview** (`docs/security-architecture.md`)
- **Migration & Deployment Guide** (`docs/deployment-guide.md`)

For platform-specific information, see:
- **PayloadCMS Access Control Documentation**: https://payloadcms.com/docs/access-control/overview
- **Authentication System Guide** (`docs/authentication-system.md`)
- **Testing Setup Documentation** (`docs/testing-setup.md`)

---

**Document Maintenance**: This permission matrix should be reviewed and updated whenever new user roles, data collections, or security requirements are introduced to the platform.
