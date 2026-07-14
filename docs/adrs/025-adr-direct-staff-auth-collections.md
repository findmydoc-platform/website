# ADR: Direct Staff Authentication Collections

## Status

| Name | Content |
| --- | --- |
| Author | Sebastian Schütze |
| Version | 1.1 |
| Date | 14.07.2026 |
| Status | Approved |

## Background

The platform authenticates platform staff for Payload Admin, clinic staff for a standalone Clinic Dashboard, and
patients for portal-facing services. Supabase owns identity and browser sessions. Payload validates the Supabase
identity, resolves it to a business record, and enforces current authorization for Admin and API requests.

The previous staff architecture used one auth-enabled `basicUsers` collection for platform and clinic staff, with
separate `platformStaff` and `clinicStaff` profile collections. That structure reflected an earlier requirement that
both staff groups use Payload Admin. Clinic staff no longer use Payload Admin; their authenticated product surface is
the standalone Clinic Dashboard.

The portal does not provide clinic authentication or account management, although it may link to the Dashboard.
Platform staff continue to sign in through Payload Admin; patient authentication and public clinic registration remain
portal responsibilities. Payload continues to authenticate and authorize Clinic Dashboard API requests.

## Problem Description

The shared staff collection no longer matches the product boundary. It adds a second lookup between an authenticated
identity and the record that owns its permissions, keeps clinic identities structurally close to the Admin login path,
and makes actor relationships less precise than the domain requires.

The architecture must determine how staff identities are represented after clinic access moves out of Payload Admin.
It must preserve a strict Admin boundary, resolve identities unambiguously, derive current permissions from Payload,
retain the established patient behavior, and avoid replacing `basicUsers` with another identity-only collection.

## Decision Drivers

- Only platform staff may enter Payload Admin.
- A validated Supabase identity must resolve to one collection-qualified Payload principal or fail closed.
- Current Payload data, rather than identity claims, must determine roles, clinic assignment, and approval.
- Staff authentication must not require a second profile lookup.
- Existing business relationships must retain their actor meaning during the transition.
- Patient authentication behavior should remain unchanged.
- The model should not introduce an identity registry without independent business value.

## Considerations

| Option | Tradeoff |
| --- | --- |
| Keep `basicUsers` and linked profiles | Minimizes schema change but preserves obsolete indirection and imprecise actors. |
| Use one universal auth collection | Simplifies lookup but weakens separation and expands classification risk. |
| Add an identity registry | Adds one uniqueness constraint but creates another identity-only lifecycle and lookup. |
| Use direct auth collections with one dispatcher | Creates the required boundary but needs application-enforced uniqueness and relationship migration. Chosen. |

## Decision with Rationale

### Login and application boundary

The Clinic Dashboard is the only clinic authentication and account-management interface. The portal provides no clinic
login, role selection, invitation completion, password reset, or account management. A Dashboard link performs no
authentication and transfers no session. Payload Admin remains available to platform staff; patient login and public
clinic registration retain their portal surfaces; Payload still accepts authenticated Dashboard API requests.

### Direct authenticated principals

Payload uses three direct auth collections:

| Collection | Purpose | Payload Admin |
| --- | --- | --- |
| `platformStaff` | Platform operations and content administration | Allowed |
| `clinicStaff` | Clinic Dashboard and clinic-scoped API access | Denied |
| `patients` | Patient-facing API access | Denied |

`platformStaff` is the only configured Payload Admin user collection. All three collections use Supabase for identity
and browser sessions; Payload local passwords and sessions remain disabled.

One Supabase strategy validates the external identity and dispatches it to exactly one collection. The trusted
classification selects only that collection; current Payload data still grants roles, clinic assignment, approval, and
record permissions. Missing, invalid, duplicate, or conflicting identities fail closed without fallback.

One Supabase identity may belong to only one direct auth collection. Provisioning and staff-category changes are
serialized across application instances and verify that invariant before and after mutation. Category changes are
explicit lifecycle operations, not role edits. No central identity registry is introduced.

### Authorization and lifecycle

Platform access starts with the least-privileged role. Only an authorized platform administrator or trusted system
provisioning path may bind a staff identity or change a platform role. Self-promotion is always denied.

Clinic business access requires current approval and clinic assignment. Every other state is denied. The server derives
the clinic from the principal and never trusts a caller-provided clinic identifier for authorization.

Staff records must exist before authentication. Staff are created through controlled platform or clinic-onboarding
provisioning, not during login. Patients retain their established ensure-on-auth behavior. This narrows the automatic
record-creation behavior described in
[ADR 004](./004-adr-custom-authentication-strategy-supabase-payloadcms.md) for staff identities only.

### Relationships, public authors, and media privacy

Relationships target the narrowest valid direct principal collection. Shared actor relationships store the principal
collection with its document identity. Server-side creator logic derives both from the authenticated principal and
ignores caller-provided actor identities.

Legacy staff-profile links to `basicUsers` are removed. No generic Actor or identity-registry collection replaces them.

Profile media is private by default, including metadata and file bytes. Public access is limited to the safe
platform-author representation required by posts. Clinic and patient media remain private even when an object URL is
known.

Post authors reference `platformStaff` directly. Their public projection remains `id`, `name`, and `avatar`, preserving
the shape and meaning defined by
[ADR 017](./017-adr-payload-virtual-fields-post-populated-authors.md).

### Cache boundary

Authentication, sessions, staff records, roles, clinic assignments, and approval states remain private live data and
never enter a shared public cache.

The public post-author projection continues to use the existing post cache and revalidation architecture. Changes to a
public author or referenced profile media invalidate affected post surfaces. No new cache class, tag family,
invalidation owner, or storage layer is introduced; the model remains within
[ADR 023](./023-adr-public-website-cache-and-revalidation-strategy.md).

### Pre-production transition

The platform contains schema, fixtures, and business content, but it has not launched with active clinic users or
sessions that require compatibility. Non-production clinic identities and sessions may be rebuilt.

This is not a from-scratch replacement. Existing platform identities and business relationships are inventoried before
destructive removal, then preserved, remapped to direct principals, or verified as disposable. Seeds do not substitute
for migrating required platform identities and relationships.

Removing `basicUsers`, legacy profile links, and obsolete fields is an isolated review step after the target model is
active, relationship migration is verified, and no required legacy references remain. No dual-read, dual-write, or
clinic-session bridge is required.

### Integration gate

Dashboard origin, token transport, refresh, CORS, CSRF protection, and callbacks require a separate application-boundary
decision. Production Dashboard API integration, CORS expansion, and clinic invitation callbacks remain blocked until
that decision is approved.

## Consequences

- **Positive:** Collection membership expresses staff type, isolates clinic identities from Payload Admin, and keeps
  current authorization in Payload without a second durable Dashboard data store.
- **Positive:** Actor relationships identify valid principal types and public author behavior remains stable.
- **Negative:** Authentication utilities must support three collection-qualified principals, while identity uniqueness
  requires serialized application logic rather than one table constraint.
- **Negative:** Polymorphic actors, platform relationship migration, and public-author cache symmetry add implementation
  obligations.
- **Neutral:** The Dashboard owns clinic account interfaces; the portal retains patients and public registration.
- **Neutral:** Staff-category changes require reprovisioning, and live Dashboard integration awaits a separate browser
  session and cross-origin decision.

## Relationship to Existing Decisions

- This ADR narrows [ADR 004](./004-adr-custom-authentication-strategy-supabase-payloadcms.md) by prohibiting automatic
  staff creation during authentication.
- This ADR supersedes [ADR 006](./006-adr-supabase-payloadcms-multi-user-auth-strategy.md), whose shared staff auth
  collection depended on clinic access to Payload Admin.
- This ADR preserves the public projection defined by
  [ADR 017](./017-adr-payload-virtual-fields-post-populated-authors.md).
- This ADR applies the cache classes and invalidation ownership defined by
  [ADR 023](./023-adr-public-website-cache-and-revalidation-strategy.md).

## Superseded by

Not superseded.
