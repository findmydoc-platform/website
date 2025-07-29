# User Management System Documentation

## Overview

The FindMyDoc platform implements a comprehensive user management system that integrates **Supabase Authentication** with **PayloadCMS** collections. This system handles three types of users: patients, clinic staff, and platform administrators.

## Architecture Overview

```
Supabase Auth (Identity) ←→ PayloadCMS (Data & Business Logic) ←→ Frontend (UI)
```

### Key Principles

1. **Supabase as Identity Provider**: Handles authentication, password management, and user sessions
2. **PayloadCMS as Data Layer**: Stores user profiles, permissions, and business data
3. **Hook-Based Architecture**: All business logic lives in PayloadCMS hooks
4. **Just-In-Time Provisioning**: Users are created in PayloadCMS when they sign in
5. **Type Safety**: Comprehensive TypeScript interfaces ensure data consistency

## File Structure & Responsibilities

### Core Files

```
src/auth/utilities/
├── userManagement.ts      # Registration & manual operations
├── userCreation.ts        # Authentication flow user creation
├── userLookup.ts          # User discovery & validation
├── userTypes.ts           # TypeScript type definitions
└── supaBaseServer.ts      # Supabase admin client

src/hooks/userLifecycle/
├── createUserHooks.ts     # User creation lifecycle hooks
└── deleteUserHooks.ts     # User deletion lifecycle hooks

src/auth/types/
└── authTypes.ts           # Authentication-specific types

src/auth/config/
└── authConfig.ts          # Authentication configuration
```

## Detailed File Explanations

### 1. `userManagement.ts` - Registration & Manual Operations

**Purpose**: Handles user registration and manual user operations.

**Key Functions**:
- `createSupabaseUser()` - Creates users in Supabase with error handling
- `createSupabaseUserConfig()` - Builds Supabase user configuration
- `createPatientRecord()` - Creates patient records in PayloadCMS
- `createClinicStaffRecords()` - Creates clinic staff and basic user records
- `validateFirstAdminCreation()` - Ensures only one admin exists
- `deleteSupabaseUser()` - Safely deletes users from Supabase

**Used By**:
- Public registration API endpoints
- PayloadCMS admin panel operations
- Manual user creation workflows
- Password reset processes

### 2. `userCreation.ts` - Authentication Flow Creation

**Purpose**: Handles user creation during authentication (JIT provisioning).

**Key Functions**:
- `prepareUserData()` - Maps Supabase auth data to PayloadCMS fields
- `createUser()` - Creates users in appropriate collections during sign-in

**Used By**:
- Supabase authentication strategy
- First-time user sign-in flows
- Automatic user synchronization

### 3. `userLookup.ts` - User Discovery & Validation

**Purpose**: Provides user lookup and permission validation utilities.

**Key Functions**:
- `findUserBySupabaseId()` - Locates users across collections
- `isClinicUserApproved()` - Validates clinic user approval status

**Used By**:
- Authentication strategy
- Access control functions
- Permission validation middleware
- Admin panel authorization checks

### 4. `userTypes.ts` - Type Definitions

**Purpose**: Centralized TypeScript interfaces for user management.

**Key Types**:
- `BaseRegistrationData` - Common registration fields
- `PatientRegistrationData` - Patient-specific registration
- `ClinicRegistrationData` - Clinic-specific registration
- `SupabaseUserConfig` - Supabase user creation configuration
- `UserCreationOptions` - User creation behavior flags

### 5. `createUserHooks.ts` - User Creation Lifecycle

**Purpose**: PayloadCMS hooks that handle user creation when staff records are created.

**Key Hooks**:
- `createUserHook()` - Generic user creation hook factory
- `schedulePasswordCleanupHook()` - Temporary password cleanup
- `createPlatformUserHook` - Pre-configured platform user creation
- `createClinicUserHook` - Pre-configured clinic user creation

**Process Flow**:
1. Admin creates staff record in PayloadCMS
2. Hook generates temporary password
3. Creates user in Supabase with metadata
4. Creates BasicUser record in PayloadCMS
5. Links staff record to BasicUser
6. Schedules password cleanup after 24 hours

### 6. `deleteUserHooks.ts` - User Deletion Lifecycle

**Purpose**: PayloadCMS hooks that handle cascading user deletion.

**Key Hooks**:
- `createDeleteUserHook()` - Generic deletion hook factory
- `deletePlatformStaffHook` - Pre-configured platform deletion
- `deleteClinicStaffHook` - Pre-configured clinic deletion
- `deletePatientHook` - Pre-configured patient deletion

**Process Flow**:
1. Admin deletes user record in PayloadCMS
2. Hook sets context flags to prevent loops
3. Deletes user from Supabase
4. Cascades deletion to related records
5. Logs all operations for audit trail

## User Types & Collections

### Patient Users
- **Authentication Collection**: `patients`
- **Supabase Metadata**: `user_type: 'patient'`
- **Registration**: Public API endpoint
- **Approval**: Not required

### Clinic Staff Users
- **Authentication Collection**: `basicUsers`
- **Profile Collection**: `clinicStaff`
- **Supabase Metadata**: `user_type: 'clinic'`
- **Registration**: Public API endpoint
- **Approval**: Required (pending → approved)

### Platform Staff Users
- **Authentication Collection**: `basicUsers`
- **Profile Collection**: `platformStaff`
- **Supabase Metadata**: `user_type: 'platform'`
- **Registration**: Admin panel only
- **Approval**: Not required

## Authentication Flow

### User Registration Flow
```
1. User submits registration form
2. Frontend calls public registration API
3. API uses userManagement.ts utilities
4. Creates user in Supabase
5. Creates profile in PayloadCMS
6. Returns success/error response
```

### User Sign-In Flow
```
1. User signs in with Supabase
2. Supabase authentication strategy activates
3. userLookup.ts finds existing user
4. If not found, userCreation.ts creates records
5. User is authenticated and can access app
```

### Admin User Creation Flow
```
1. Admin creates staff record in PayloadCMS
2. createUserHooks.ts triggers
3. Generates temporary password
4. Creates Supabase user
5. Creates BasicUser record
6. Links staff to BasicUser
7. Admin shares temp password with user
```

## Security Features

### Password Management
- **Temporary Passwords**: Auto-generated for admin-created users
- **Automatic Cleanup**: Temp passwords removed after 24 hours
- **Secure Generation**: 12-character passwords with special characters

### Access Control
- **Collection-Level**: Different permissions per user type
- **Field-Level**: Sensitive fields restricted to admins
- **Override Access**: Server-side operations bypass restrictions

### Deletion Safety
- **Context Flags**: Prevent infinite deletion loops
- **Graceful Handling**: Handle already-deleted users
- **Cascade Logic**: Properly clean up related records
- **Audit Logging**: Track all operations

## Configuration

### User Type Configuration (`authConfig.ts`)
```typescript
export const USER_CONFIG = {
  clinic: {
    collection: 'basicUsers',
    profileCollection: 'clinicStaff',
    requiresProfile: true,
    requiresApproval: true,
  },
  platform: {
    collection: 'basicUsers',
    profileCollection: 'platformStaff',
    requiresProfile: true,
    requiresApproval: false,
  },
  patient: {
    collection: 'patients',
    profileCollection: null,
    requiresProfile: false,
    requiresApproval: false,
  },
}
```

## Usage Examples

### Creating a Patient (Public Registration)
```typescript
import { createSupabaseUser, createPatientRecord } from '@/auth/utilities/userManagement'

const registrationData = {
  email: 'patient@example.com',
  password: 'userPassword',
  firstName: 'John',
  lastName: 'Doe',
  dateOfBirth: '1990-01-01',
  phone: '+1234567890'
}

// Create in Supabase
const config = createSupabaseUserConfig(registrationData, 'patient')
const supabaseUser = await createSupabaseUser(config)

// Create in PayloadCMS
const patient = await createPatientRecord(payload, supabaseUser.id, registrationData)
```

### Admin Creating Staff User
```typescript
// Admin creates record in PayloadCMS admin panel
// Hook automatically:
// 1. Generates temp password
// 2. Creates Supabase user
// 3. Creates BasicUser record
// 4. Links staff to BasicUser

const staffData = {
  firstName: 'Jane',
  lastName: 'Smith',
  email: 'jane@clinic.com',
  // user field is automatically populated by hook
}
```

### Looking Up a User
```typescript
import { findUserBySupabaseId } from '@/auth/utilities/userLookup'

const authData = {
  supabaseUserId: 'abc123',
  userEmail: 'user@example.com',
  userType: 'clinic',
  firstName: 'Jane',
  lastName: 'Smith'
}

const user = await findUserBySupabaseId(payload, authData)
```

## Error Handling

### Common Error Scenarios
1. **Duplicate Users**: Handled by unique constraints
2. **Missing Required Fields**: Validated before creation
3. **Supabase API Errors**: Graceful error messages
4. **Deletion Loops**: Prevented by context flags
5. **Already Deleted Users**: Handled gracefully

### Logging Strategy
- **Info**: Successful operations and state changes
- **Warn**: Non-critical issues (user already deleted)
- **Error**: Critical failures that need investigation

## Migration Considerations

When modifying user collections:

1. **Always use PayloadCMS migrations**: Never edit schema directly
2. **Test hooks thoroughly**: User creation/deletion affects multiple systems
3. **Update type definitions**: Keep TypeScript interfaces in sync
4. **Consider data migration**: Existing users may need updates

### Migration Commands
```bash
pnpm payload migrate:create user-schema-update
pnpm payload migrate
pnpm generate  # Update type definitions
```

## Testing

### Unit Tests
- Test individual utility functions
- Mock Supabase and PayloadCMS dependencies
- Validate error handling scenarios

### Integration Tests
- Test complete user lifecycle flows
- Verify hook behavior in collections
- Test authentication strategy integration

### Example Test Structure
```typescript
describe('User Management', () => {
  describe('createSupabaseUser', () => {
    it('should create user with correct metadata')
    it('should handle duplicate email errors')
    it('should validate required fields')
  })

  describe('createUserHook', () => {
    it('should create BasicUser and link to staff')
    it('should generate temporary password')
    it('should handle Supabase creation failures')
  })
})
```

## Troubleshooting

### Common Issues

**Issue**: User creation fails with "duplicate email"
**Solution**: Check if user already exists in Supabase admin panel

**Issue**: Infinite deletion loops
**Solution**: Verify context flags are set properly in hooks

**Issue**: Temp password not cleared
**Solution**: Check that setTimeout is working in production environment

**Issue**: User can't sign in after creation
**Solution**: Verify `email_confirm: true` is set in Supabase config

### Debug Commands
```bash
# Check TypeScript compilation
pnpm check

# Run with detailed logging
pnpm dev

# Check database state
# Use Supabase dashboard or PayloadCMS admin panel
```

## Performance Considerations

### Optimization Strategies
1. **Batch Operations**: Group related database operations
2. **Lazy Loading**: Only fetch user data when needed
3. **Caching**: Cache user lookup results
4. **Index Management**: Ensure supabaseUserId fields are indexed

### Monitoring
- Track user creation/deletion times
- Monitor Supabase API response times
- Watch for failed operations in logs

## Future Enhancements

### Potential Improvements
1. **Bulk User Operations**: Import/export multiple users
2. **User Update Hooks**: Handle profile changes
3. **Audit Trail**: Comprehensive user action logging
4. **Role-Based Permissions**: More granular access control
5. **Email Notifications**: Notify users of account changes

### Considerations
- Maintain backward compatibility
- Follow existing architectural patterns
- Update documentation with changes
- Add comprehensive tests for new features

---

This user management system provides a robust foundation for handling authentication and user data in the FindMyDoc medical platform, ensuring security, scalability, and maintainability.
