# Authentication System

A modular authentication system integrating Supabase Auth with PayloadCMS, designed for multi-tenant healthcare platform management.

## 🏗️ Architecture Overview

The authentication system follows a **utility-based architecture** that separates concerns into focused, testable modules:

```
src/auth/
├── config/           # Configuration and constants
├── strategies/       # PayloadCMS authentication strategies
├── types/           # Shared TypeScript interfaces
└── utilities/       # Core authentication logic
    ├── jwtValidation    # Token & user validation
    ├── userLookup       # User search operations
    ├── userCreation     # User creation logic
    └── accessValidation # Permission checking
```

### **Key Design Principles**

1. **Single Responsibility**: Each utility handles one specific aspect of authentication
2. **Testability**: 100% unit test coverage with comprehensive mocking
3. **Type Safety**: Strong TypeScript interfaces prevent runtime errors
4. **Modularity**: Easy to extend, modify, or replace individual components
5. **Configuration-Driven**: Centralized config supports multiple user types

## 🚀 Authentication Concepts

### User Types & Access Patterns

The system supports three user types with different access patterns:

| User Type          | Collection   | Profile Collection | Admin Access     | API Access    | Approval Required |
| ------------------ | ------------ | ------------------ | ---------------- | ------------- | ----------------- |
| **Clinic Staff**   | `basicUsers` | `clinicStaff`      | ✅ (if approved) | ✅            | Yes               |
| **Platform Staff** | `basicUsers` | `platformStaff`    | ✅               | ✅            | No                |
| **Patients**       | `patients`   | None               | ❌               | ✅ (own data) | No                |

### Authentication Flow Stages

1. **Token Validation**: Extract and verify JWT from authorization headers
2. **User Data Extraction**: Parse user metadata from Supabase session
3. **User Resolution**: Find existing user or create new user with profile
4. **Access Authorization**: Validate permissions based on user type and approval status
5. **Session Establishment**: Return authenticated user for PayloadCMS

## Preview Runtime Admin Recovery Flow

This flow is active when runtime resolves to `preview` (`VERCEL_ENV` -> `DEPLOYMENT_ENV` fallback).

### Key Rules

- Supabase is the source of truth for login-capable admin users.
- Platform user reconcile by email (`allowEmailReconcile=true`) is enabled only in preview runtime.
- If a platform Supabase session exists but no Payload user exists yet, `/admin/login` redirects to `/admin` to trigger strategy provisioning.
- In preview runtime, first-admin unlock checks require a local Payload platform user that is also valid in Supabase.
- In preview runtime, first-admin registration can recover an existing local user by email and convert/update it to a platform user with a fresh `supabaseUserId`.

### Step-by-Step Branch Map (Works vs Blocked)

1. Enter `/admin/login` in preview runtime.
2. Branch: Supabase session exists?
3. If no session:
4. Branch: `hasLocalAdminUsers()` is true?
5. If yes, staff login form is shown (login can proceed with valid credentials).
6. If no, redirect to `/admin/first-admin` (login blocked until first admin is provisioned).
7. If session exists:
8. Branch: session `user_type` is `platform`?
9. If no (`clinic`/other), preview guard blocks admin frontend access.
10. If yes, redirect to `/admin` to run strategy-based provisioning.
11. In strategy: find Payload user by `supabaseUserId`.
12. If found, login succeeds.
13. If missing, preview-only reconcile by email runs.
14. If email match is found, `supabaseUserId` is updated and login succeeds.
15. If email match is missing, Payload platform user + profile is created and login succeeds.
16. If strategy fails (Supabase/Payload error), login is blocked with an auth error state.

First-admin branch (preview):

1. POST `/admin/first-admin`.
2. Branch: login-capable admin already exists?
3. If yes, request is rejected (`400`), no second first-admin provisioning.
4. If no, create Supabase platform account first.
5. Branch: Payload user with same email exists?
6. If no, create new Payload platform admin record.
7. If yes, recover existing record by updating it to platform + new `supabaseUserId`.
8. Result: first admin is provisioned and can authenticate via Supabase.

### Decision Flow (Preview)

```mermaid
flowchart TD
  A["Request enters preview runtime"] --> B{"Path is /admin/login?"}
  B -- "No" --> Z["Normal route logic"]
  B -- "Yes" --> C{"Supabase session present?"}
  C -- "No" --> D{"hasLocalAdminUsers()?"}
  D -- "Yes" --> E["Show staff login form"]
  D -- "No" --> F["Redirect to /admin/first-admin"]

  C -- "Yes, platform user" --> G{"Payload user by supabaseUserId?"}
  G -- "Yes" --> H["Redirect /admin"]
  G -- "No" --> I["Redirect /admin (strategy path)"]

  I --> J["Supabase strategy runs"]
  J --> K{"Find by supabaseUserId"}
  K -- "Found" --> L["Login succeeds"]
  K -- "Missing" --> M{"Find by email (preview only reconcile)"}
  M -- "Found" --> N["Update Payload supabaseUserId, then login"]
  M -- "Missing" --> O["Create Payload user + profile, then login"]

  C -- "Yes, clinic user" --> P["Preview Guard keeps platform-only restriction"]
  P --> Q["Clinic user does not pass preview guard"]
```

### First Admin Recovery Decision (Preview)

```mermaid
flowchart TD
  A["/admin/first-admin POST"] --> B{"Login-capable admin exists?"}
  B -- "Yes" --> C["Reject first-admin creation (400)"]
  B -- "No" --> D["Create Supabase platform account first"]
  D --> E{"Payload user with same email exists?"}
  E -- "No" --> F["Create Payload basicUsers platform record"]
  E -- "Yes" --> G["Update existing Payload user to platform + new supabaseUserId"]
  F --> H["First admin ready"]
  G --> H
```

### Profile Management Strategy

- **Staff Users**: Automatically create both user record and corresponding profile
- **Atomic Operations**: User + profile creation happens in single transaction
- **Profile Recovery**: Missing profiles are automatically created during login
- **Approval Workflow**: Clinic staff require explicit approval for admin access

## 🔧 Configuration Concepts

### Environment Requirements

The system requires three Supabase environment variables for JWT validation and API communication.

### User Type Configuration

Each user type has specific configuration defining:

- Target collection for user records
- Profile collection (if applicable)
- Whether profile creation is required
- Whether approval is needed for access

### Access Control Strategy

- **Collection-Level**: Broad access defined in PayloadCMS collection configurations
- **Field-Level**: Granular field access based on user roles
- **Admin Interface**: Restricted to approved staff users only
- **API Access**: All authenticated users can access APIs with appropriate scope

## 📊 Business Logic

### User Creation Workflow

**New Staff Users**:

1. Create user record in `basicUsers` collection
2. Simultaneously create profile in appropriate staff collection
3. Both operations succeed together or fail together (atomic)

**New Patients**:

1. Create user record directly in `patients` collection
2. No additional profile creation needed

### Approval Process

**Clinic Staff Approval**:

- New clinic users created but marked as unapproved
- Platform administrators manually approve clinic staff
- Unapproved users cannot access admin interface
- API access remains available regardless of approval status

**Platform Staff**:

- Automatically approved upon creation
- Immediate access to all platform features

### Session Management

- **Token Lifecycle**: JWT tokens validated on each request
- **User Resolution**: Supabase ID used as permanent user identifier
- **Profile Consistency**: Missing profiles automatically restored
- **Access Validation**: Real-time permission checking

## 🧪 Testing Strategy

### Test Coverage Philosophy

- **Unit Testing**: Each utility module independently tested
- **Mock Strategy**: External dependencies (Supabase, PayloadCMS) fully mocked
- **Error Scenarios**: All failure modes and edge cases covered
- **Type Validation**: Interface contracts verified through tests

### Test Organization

The test suite covers four main areas:

- **JWT Processing**: Token extraction and validation logic
- **User Operations**: Lookup, creation, and profile management
- **Access Control**: Permission validation and approval workflows
- **Configuration**: User type mapping and environment validation

## 🛠️ Development Workflow

### Adding New User Types

1. **Update Configuration**: Define collection mappings and requirements
2. **Update Type Definitions**: Extend interfaces to include new user type
3. **Create Tests**: Verify new user type behavior
4. **Update Documentation**: Reflect new user type in business logic

### Debugging Strategy

- **Development Logging**: Enhanced logging in development environment
- **Error Classification**: Structured error handling with appropriate log levels
- **Performance Tracking**: Authentication timing and success metrics
- **Security Monitoring**: Failed authentication attempts and suspicious activity

## 🔐 Security Principles

### Token Security

- **JWT Verification**: All tokens validated against Supabase secret
- **Expiration Handling**: Expired tokens automatically rejected
- **Header Validation**: Secure Bearer token format required

### Access Boundaries

- **Principle of Least Privilege**: Users receive minimum necessary access
- **Role Separation**: Clear boundaries between clinic, platform, and patient access
- **Approval Gates**: Additional authorization layer for sensitive roles

### Error Handling Philosophy

- **Graceful Degradation**: Authentication failures result in access denial, not system errors
- **Information Hiding**: Error messages reveal minimal information to unauthorized users
- **Audit Trail**: All authentication events logged for security monitoring

## 📈 Operational Considerations

### Monitoring Metrics

- Authentication success and failure rates by user type
- User creation patterns and approval workflow efficiency
- System performance during authentication operations
- Error frequency and categorization

### Scalability Design

- **Stateless Authentication**: No server-side session storage required
- **Database Efficiency**: Optimized queries for user lookup operations
- **Caching Strategy**: Configuration and user data caching opportunities
- **Load Distribution**: Authentication workload distributed across utilities

## 🔄 Migration Considerations

### Architecture Evolution

The current modular design replaces a previous monolithic approach, providing:

- **Maintainability**: Easier to modify individual authentication aspects
- **Testability**: Comprehensive testing of isolated components
- **Extensibility**: Simple addition of new user types and workflows
- **Reliability**: Reduced complexity and improved error handling

### Integration Points

- **PayloadCMS Integration**: Seamless integration with collection access controls
- **Supabase Integration**: Leverages Supabase Auth without vendor lock-in
- **Frontend Compatibility**: Works with any client capable of JWT authentication
- **API Consistency**: Uniform authentication across all API endpoints

---

_This authentication system provides enterprise-grade security and reliability for the findmydoc healthcare platform, focusing on maintainable business logic rather than implementation details._
