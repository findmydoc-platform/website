# ClinicStaff Collection - External Authentication Strategy

## Overview

The ClinicStaff collection is designed to manage staff members associated with medical clinics in the platform. This collection uses external authentication through the `authId` field.

## Authentication Strategy

### External Auth Integration

The ClinicStaff collection links to external authentication systems through the `authId` field:

- **Field**: `authId`
- **Type**: Text
- **Constraints**: 
  - `unique: true` - Ensures each external auth ID is unique in the system
  - `index: true` - Creates database index for fast lookups
  - `required: true` - Every staff member must have an external auth ID

### Implementation Pattern

The authentication strategy follows the same pattern as PlattformStaff but with ClinicStaff-specific considerations:

1. **External Auth Provider**: The system can integrate with various external authentication providers (Supabase, Auth0, Firebase Auth, etc.)
2. **Auth ID Mapping**: The `authId` field stores the unique identifier from the external auth system
3. **User Lookup**: When a user authenticates, the system looks up the ClinicStaff record using the `authId`
4. **Auto-creation**: If needed, new ClinicStaff records can be created automatically during first login

### Auth Strategy Configuration

To implement the external auth strategy, create a custom strategy similar to the existing Supabase strategy:

```typescript
// Example implementation for ClinicStaff auth strategy
export function createClinicStaffAuthStrategy(config: { 
  collection: 'clinicStaff',
  defaultRole: 'clinic_staff' 
}) {
  return {
    name: 'clinic-staff-auth',
    authenticate: async ({ payload }: { payload: any }) => {
      // Get external auth user (from JWT, session, etc.)
      const externalUser = await getExternalAuthUser()
      
      if (!externalUser) {
        return { user: null }
      }

      // Find existing ClinicStaff by authId
      const staffQuery = await payload.find({
        collection: 'clinicStaff',
        where: {
          authId: { equals: externalUser.id },
        },
      })

      if (staffQuery.docs.length > 0) {
        return {
          user: {
            collection: 'clinicStaff',
            ...staffQuery.docs[0],
          },
        }
      }

      // Create new staff member if not found
      const newStaff = await payload.create({
        collection: 'clinicStaff',
        data: {
          email: externalUser.email,
          authId: externalUser.id,
          firstName: externalUser.firstName || 'First',
          lastName: externalUser.lastName || 'Last',
          role: config.defaultRole,
        },
      })

      return {
        user: {
          collection: 'clinicStaff',
          ...newStaff,
        },
      }
    },
  }
}
```

### Security Considerations

1. **Read-Only Auth ID**: The `authId` field is configured as read-only in the admin panel to prevent manual tampering
2. **Hidden Field**: The field is hidden from the admin interface to reduce confusion
3. **Unique Constraint**: Database-level uniqueness prevents duplicate auth mappings
4. **Index Performance**: Database index ensures fast authentication lookups

### Integration Points

The ClinicStaff collection integrates with:

1. **Clinics**: Many-to-many relationship allowing staff to be associated with multiple clinics
2. **Primary Contact**: The `isPrimary` field designates primary contacts for clinics
3. **Role-based Access**: Different roles provide different access levels within the platform
4. **Profile Management**: Staff can have profile images and personal information

### Migration Considerations

When implementing this collection:

1. Run `payload migrate:create` to create the database migration
2. Run `payload generate:types` to update TypeScript types
3. Run `payload generate:importmap` to update import maps
4. Ensure external auth provider is configured before enabling authentication
5. Test authentication flow with external provider integration