# Authentication System

A modular authentication system integrating Supabase Auth with Payload CMS for multi-tenant healthcare platform management.

## Architecture Overview

The authentication system separates token validation, user lookup, user creation, access validation, and Supabase provisioning into focused utilities under `src/auth`.

## User Types

| User Type      | Collection   | Profile Collection | Admin Access     | Approval Required |
| -------------- | ------------ | ------------------ | ---------------- | ----------------- |
| Clinic Staff   | `basicUsers` | `clinicStaff`      | Yes, if approved | Yes               |
| Platform Staff | `basicUsers` | `platformStaff`    | Yes              | No                |
| Patients       | `patients`   | None               | No               | No                |

## Platform Admin Provisioning

Public first-admin bootstrap is disabled. Platform staff, including the first admin, must be provisioned through the private `ops` repository workflow.

The website runtime must not expose a public endpoint that creates platform admins. Public first-admin bootstrap routes return `404`.

## Preview Runtime Admin Recovery

Preview runtime may reconcile an authenticated Supabase platform session to an existing Payload platform user by email when allowed by runtime policy. This is limited to login/session recovery and is not a public provisioning path.

If no platform staff exists, `/admin/login` remains visible without public bootstrap guidance and emits a warning log for operators. Missing platform admin roles and platform staff without linked Supabase IDs are logged as separate operator warnings. The public login page does not perform Supabase Admin API validation; deeper reconciliation belongs in private internal workflows.

## Supabase Metadata Boundary

Authorization-critical user type comes from Supabase `app_metadata.user_type`, not user-editable metadata. Server-side provisioning and invite flows are responsible for setting that value.
