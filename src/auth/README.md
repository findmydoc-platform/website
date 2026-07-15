# Authentication System

A modular authentication system integrating Supabase Auth with Payload CMS for multi-tenant healthcare platform management.

## Architecture Overview

The authentication system separates token validation, user lookup, user creation, access validation, and Supabase provisioning into focused utilities under `src/auth`.

## User Types

| User Type      | Collection      | Profile Collection | Admin Access | Approval Required |
| -------------- | --------------- | ------------------ | ------------ | ----------------- |
| Clinic Staff   | `clinicStaff`   | None               | No           | Yes               |
| Platform Staff | `platformStaff` | None               | Yes          | No                |
| Patients       | `patients`      | None               | No           | No                |

## Platform Admin Provisioning

Public first-admin bootstrap is disabled. Platform staff, including the first admin, must be provisioned through the private `ops` repository workflow.

The website runtime must not expose a public endpoint that creates platform admins. Public first-admin bootstrap routes return `404`.

Platform staff accounts must use `@findmydoc.eu` email addresses. Payload rejects `platformStaff` writes outside that domain, and Supabase platform-user login attempts outside that domain are denied before Payload lookup. The password reset route stays available through the public platform reset flow and keeps neutral responses; staff eligibility is enforced by the platform staff account boundary.

The current staff login sequence is documented in `docs/security/auth-flow-diagram.md`.

## Runtime Admin Recovery

If no platform staff exists, `/admin/login` remains visible without public bootstrap guidance and emits a warning log for operators. Missing platform admin roles and platform staff without linked Supabase IDs are logged as separate operator warnings. Production log messages must not name the private `ops` workflow or expose remediation steps. The public login page does not perform Supabase Admin API validation; deeper reconciliation belongs in the private `ops` repository workflow.

## Supabase Metadata Boundary

Authorization-critical user type comes from Supabase `app_metadata.user_type`, not user-editable metadata. Server-side provisioning and invite flows are responsible for setting that value.
