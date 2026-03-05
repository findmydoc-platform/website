# Supabase Authentication Flow

This diagram shows the business process for user authentication and account setup in the healthcare platform.

```mermaid
sequenceDiagram
    participant User as 👤 User
    participant Frontend as 🌐 Next.js Frontend
    participant Supabase as 🔐 Supabase Auth
    participant Strategy as 🎯 Auth Strategy
    participant PayloadDB as 🗄️ PayloadCMS DB

    Note over User, PayloadDB: User Login Process

    User->>Frontend: 1. Enters email/password
    Frontend->>Supabase: 2. Sign in with credentials

    alt Login Success
        Supabase-->>Frontend: 3. Returns JWT token + user data
        Frontend->>Strategy: 4. Calls authenticate()

        Note over Strategy: Extract & Validate User Data
        Strategy->>Supabase: 5. Get user session & decode JWT
        Supabase-->>Strategy: 6. User metadata (email, user_type, names)

        Note over Strategy: Determine User Type & Collection
        Strategy->>Strategy: 7. Check user_type (clinic/platform/patient)
        Strategy->>Strategy: 8. Map to collection (basicUsers/patients)

        Note over Strategy, PayloadDB: Find or Create User
        Strategy->>PayloadDB: 9. Search for existing user by supabaseUserId
        Strategy->>PayloadDB: 9b. If not found, search by normalized email
        Strategy->>PayloadDB: 9c. If matched by email, reconcile supabaseUserId

        alt User Exists
            PayloadDB-->>Strategy: 10a. Return existing user

        else User Doesn't Exist
            Note over Strategy, PayloadDB: Two-step Creation
            %% Transaction removed – user created first, profile via hook/secondary step
            Strategy->>PayloadDB: 10b. Create user record
            PayloadDB-->>Strategy: 11b. User created (ID: X)
            alt Staff User Needs Profile
                Strategy->>PayloadDB: 12b. (Deferred) profile creation via lifecycle hook
                PayloadDB-->>Strategy: 13b. Profile created
            end
            alt Concurrent create conflict
                Strategy->>PayloadDB: 14b. Re-lookup user after conflict
                PayloadDB-->>Strategy: 15b. Recovered existing user
            end
            Note right of Strategy: Two-phase create (no DB transaction)
        end

        Note over Strategy: Additional Checks for Clinic Users
        alt Clinic User
            Strategy->>PayloadDB: 17. Check if clinic staff is approved
            PayloadDB-->>Strategy: 18. Return approval status

            alt Not Approved
                Strategy-->>Frontend: 19a. Deny access (null user)
            else Approved
                Strategy-->>Frontend: 19b. Allow access
            end
        else Platform/Patient User
            Strategy-->>Frontend: 19c. Allow access
        end

        Frontend-->>User: 20. Redirect to dashboard/admin (read-only gate on /admin/login)

    else Login Failed
        Supabase-->>Frontend: 3b. Authentication error
        Frontend-->>User: 4b. Show error message
    end

    Note over User, PayloadDB: Key Features
    Note right of Strategy: ✅ Two-phase create<br/>✅ Email normalization + reconciliation
    <br/>✅ Conflict recovery by re-lookup<br/>✅ Structured error logging + user type validation
```

## Business Logic Concepts

### User Types & Collections

The system supports three distinct user roles with different data storage patterns:

- **Platform Staff** → Stored in `basicUsers` with `platformStaff` profile
- **Clinic Staff** → Stored in `basicUsers` with `clinicStaff` profile
- **Patients** → Stored directly in `patients` collection (no separate profile)

### Profile Management Strategy

**Staff Users (Clinic & Platform)**:
- Main user record stores authentication data
- Separate profile record stores role-specific information
- Records are created in two phases: user first, profile shortly after (non-transactional)

**Patient Users**:
- Single record contains both authentication and profile data
- Simpler data model for end-user management

### Approval Workflow

**Clinic Staff Access Control**:
- New clinic users can authenticate but cannot access admin features
- Platform administrators must manually approve clinic staff
- Approved status controls admin interface access only
- API access remains available regardless of approval status

**Platform Staff & Patients**:
- Immediate access upon successful authentication
- No additional approval workflow required

### Consistency & Recovery

**Email Reconciliation**:
- If lookup by Supabase id misses, the strategy performs a normalized-email fallback lookup.
- If a trusted match is found, the internal record is reconciled to the current Supabase user id.

**Creation Semantics**:
- User and profile creation are not wrapped in a single transaction; a temporary gap can exist if profile creation fails.
- Concurrent create conflicts are handled by re-querying and reusing the already-created record.

## Authentication Flow Stages

### Stage 1: Token Processing
- Extract JWT token from authorization headers
- Validate token signature against Supabase secrets
- Parse user metadata from token claims

### Stage 2: User Type Resolution
- Identify user type from Supabase metadata
- Map user type to appropriate PayloadCMS collections
- Apply user-type-specific configuration rules

### Stage 3: User Management
- Search for existing user by Supabase identifier
- Fallback to normalized email lookup for legacy/unsynced records
- Reconcile Supabase identifier on trusted email match
- Create new user if not found (with profile if applicable)
- Recover from concurrent create conflicts by re-lookup

### Stage 4: Access Authorization
- Validate user permissions based on type and approval status
- Apply collection-level and field-level access controls
- Return authenticated user or deny access

### Stage 5: Session Establishment
- Provide authenticated user context to PayloadCMS
- Enable API access based on user permissions
- Log authentication events for monitoring

## Error Handling Philosophy

### Graceful Degradation
- Authentication failures result in access denial, not system errors
- Users receive appropriate feedback without exposing system internals
- Failed operations are logged for administrator review
- Admin login page remains read-only for provisioning to avoid retry/redirect loops on failures

### Creation Integrity
- User persistence precedes profile creation (non-atomic). Failures in profile creation are logged; recovery may require manual or future automated repair.

### Security Boundaries
- Invalid tokens are rejected without revealing validation details
- User enumeration attacks are prevented through consistent response timing
- Error messages provide minimal information to unauthorized users

## Monitoring & Operations

### Business Metrics
- **User Onboarding**: Track new user creation by type
- **Approval Workflow**: Monitor clinic staff approval rates and timing
- **Authentication Success**: Measure login success rates by user type
- **Profile Consistency**: Track profile creation and recovery events

### Operational Considerations
- **Performance**: Authentication operations optimized for healthcare platform scale
- **Reliability**: Idempotent lookups and conflict recovery improve consistency under concurrency
- **Security**: Comprehensive logging enables security monitoring and audit trails
- **Scalability**: Stateless design supports horizontal scaling requirements

---

*This authentication flow is designed specifically for healthcare platform requirements, balancing security, usability, and operational efficiency.*
