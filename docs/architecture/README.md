# Website architecture

## Context and scope

The Website runs the public findmydoc portal, patient account flows, and Payload Admin for platform staff. It owns the
Payload data model and business authorization for Website and Clinic Dashboard requests. The Clinic Dashboard owns
its frontend, clinic staff sessions, and backend for frontend (BFF). The shared arc42 view covers how both applications
work together. [Shared platform architecture](https://github.com/findmydoc-platform/platform-architecture)

## Building blocks

See the [Website container diagram](https://github.com/findmydoc-platform/platform-architecture/blob/main/05_building_block_view.md#website-containers) for the runtime, data store, and external systems.

- The Next.js App Router hosts the public portal and Payload Admin in one application. Server-side loaders and route
  adapters read Payload and prepare data for reusable UI components. [Frontend data access](../frontend/content-data-access.md)
- Payload registers collections, globals, and business endpoints in its [configuration](../../src/payload.config.ts).
  It stores managed data in PostgreSQL. For fields, relationships, validation, and indexes, read the owning
  [collection](../../src/collections) or [global](../../src/globals). Use the [generated Payload types](../../src/payload-types.ts)
  for TypeScript document shapes. The [domain model](../datamodel/er-current-model.md) explains the main business relationships.
- Supabase supplies identity and sessions. Payload resolves the current principal and applies role, clinic scope, and
  record-level rules. See the [authentication model](../security/authentication-system.md),
  [collection permission matrix](../security/permission-matrix.md), and [access helpers](../../src/access).

## Runtime and constraints

- The Dashboard BFF calls Website's private Payload endpoints server to server. Payload checks current business access
  before returning data or accepting a command. Route behavior, request and response shapes, and error semantics live in
  the [Website provider contract](../integrations/clinic-dashboard-api.md).
- Cacheable public reads have named invalidation owners so publication changes can refresh the affected content.
  Private, draft, and preview reads stay live. [Cache revalidation runtime](../engineering/cache-revalidation-runtime.md)
- Clinic notifications have their own [v1 wire contract](./clinic-notifications-v1.md), with separate explanations for
  [inquiry moderation capture](./clinic-notification-inquiry-moderation.md) and [retention](./clinic-notification-retention.md).

## Architecture decisions

- Direct Payload auth collections keep platform staff, clinic staff, and patient lifecycles distinct. A single Supabase
  strategy dispatches the external identity to its matching collection. [ADR 025](../adrs/025-adr-direct-staff-auth-collections.md)
- Public cache policy assigns freshness and invalidation ownership before choosing storage. [ADR 023](../adrs/023-adr-public-website-cache-and-revalidation-strategy.md)
- The standalone Dashboard and its BFF boundary follow the approved platform decision. [ADR 026](https://github.com/findmydoc-platform/platform-architecture/blob/main/decisions/026-adr-standalone-clinic-dashboard-bff-architecture.md)

See the [Website ADR index](../adrs/README.md) for other decisions.

## Changes across repositories

A change to a shared contract, such as a Dashboard response shape, needs updates to the owner documentation and a linked
platform architecture issue or pull request. An internal refactor that preserves the shared relationships stays local.
Check the relevant arc42 chapter and use the owner document for contract details.
[Platform maintenance guide](https://github.com/findmydoc-platform/platform-architecture/blob/main/MAINTENANCE.md)
