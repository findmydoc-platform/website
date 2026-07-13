# Clinic Dashboard Capability Matrix

> **Historical design record — snapshot 2026-07-13.** This document records the planning contract produced by
> [website#1523](https://github.com/findmydoc-platform/website/issues/1523). It is useful for implementation order and
> provenance, but it is not an authoritative engineering source. Current ADRs, issue acceptance criteria, the
> permission matrix, and runtime code take precedence.

## Executive Outcome

`website#1523` is the correct first task. The prototype contains enough product detail to expose backend assumptions,
but not enough contract detail to safely start runtime integration. The first runtime gate is the staff-auth refactor
currently duplicated across [website#1484](https://github.com/findmydoc-platform/website/issues/1484) and
[website#1532](https://github.com/findmydoc-platform/website/issues/1532), because the current staff identity, tenant
helpers, actor relationships, and Payload Admin ownership still depend on `basicUsers` and ADR 006. The owner must
select one canonical execution issue before runtime work starts.

[website#1522](https://github.com/findmydoc-platform/website/issues/1522) can start its application-boundary analysis in
parallel with the canonical auth ADR slice, but it cannot be finalized until the replacement staff-auth decision exists.
No work in #1524–#1531 should be merged against the outgoing `basicUsers` identity model.

The standalone app shell in
[clinic-dashboard#1](https://github.com/findmydoc-platform/clinic-dashboard/issues/1) can proceed in parallel using only
the rescued stories and fixtures. Its backend wiring remains blocked by the canonical auth refactor, #1522, and #1524.

## Decision Evidence

| Evidence | Snapshot |
| --- | --- |
| Visual truth | [Google Stitch project](https://stitch.withgoogle.com/projects/7627258445295331531), with seven screen IDs preserved in the prototype QA manifest |
| Prototype implementation | Website commit [`be9efd19c98cf1461cb87dc5294c09a35d881f9d`](https://github.com/findmydoc-platform/website/commit/be9efd19c98cf1461cb87dc5294c09a35d881f9d) on `feature/rescue-clinic-dashboard-prototype` |
| Backend implementation | Website `origin/main` at [`99b7534f49a8def0bdea0ba10689b100e126ce4a`](https://github.com/findmydoc-platform/website/commit/99b7534f49a8def0bdea0ba10689b100e126ce4a) (`fix(seeding): preserve seed reset operator (#1517)`) |
| Auth architecture | [ADR 006](../../adrs/006-adr-supabase-payloadcms-multi-user-auth-strategy.md), accepted for the current runtime but explicitly due to be superseded by #1532 |
| Cache architecture | [ADR 023](../../adrs/023-adr-public-website-cache-and-revalidation-strategy.md), the [runtime guide](../../engineering/cache-revalidation-runtime.md), policy catalog, planner, and executor |
| Issue contract | website#1522–#1533, the overlapping open website#1484, and clinic-dashboard#1, read on 2026-07-13; no issues were created or rewritten by this record |

Decision status: the capability classification and dependency order are ready for execution planning. Product choices
called out as data gaps remain intentionally unresolved.

Authoritative implementation destinations:

- Website backend, schema, access, cache, and public surfaces: `findmydoc-platform/website`
- Standalone shell and dashboard UI: `findmydoc-platform/clinic-dashboard`
- Architecture decisions: accepted ADRs in the repository that owns the affected boundary

## Scope

### Must

- Cover all seven prototype screens, their visible actions, and the shared shell.
- Map every action to one of the four issue-defined statuses.
- Identify current collections, access helpers, API behavior, cache boundaries, hooks, tests, and owning issues.
- Keep private-live and public-cached behavior separate.
- Expose false assumptions and stop conditions before runtime work begins.

### Should

- Allow the app-shell transfer to proceed without inventing backend behavior.
- Give each backend issue a narrow dependency contract and a safe parallelization point.
- Preserve source links so later implementation can re-check drift against current main.

### Must Not

- Decide a new schema, public visibility rule, metric definition, auth flow, or cache vocabulary inside this record.
- Treat fixture values as production data or acceptance criteria.
- Treat `clinicStaff` login identities as public clinic-team profiles.
- Give the dashboard direct database access, a Supabase service-role key, or client-side analytics provider secrets.

### Out of Scope

- Runtime code, migrations, seeds, dashboard repository changes, deployments, and issue rewrites.
- Appointment booking, realtime presence, push notifications, support tooling, and exports unless a later issue owns them.

## Status Semantics

The status describes the **website backend contract**, not whether the standalone dashboard has already wired the UI.
Pure client-side navigation or dialog state is therefore `existing` when it needs no backend capability; its transfer is
still owned by clinic-dashboard#1.

| Status | Meaning |
| --- | --- |
| `existing` | The current website model, access rule, hook/test coverage, or a backend-free UI behavior is sufficient for this action. Global #1532/#1524 integration gates still apply. |
| `Access/API gap` | The data model is sufficient, but clinic staff lacks the required tenant-safe access, cross-origin transport, bootstrap, query, or mutation contract. |
| `Schema gap` | Required state cannot be represented safely in the current model and an identified follow-up owns the domain. This status takes precedence over an additional access gap. |
| `later scope` | The prototype exposes the action, but no backend contract is part of the current issue set. This status also applies when a new schema would be needed but no approved follow-up owns it. The action must remain fixture-only or disabled until explicitly scoped. |

Every `later scope` row is assigned to clinic-dashboard#1 only for safe fixture, disabled, or hidden UI behavior. This
does not add backend scope to that issue. The corresponding backend contract remains deliberately unowned, and no new
issue was created because the project owner explicitly prohibited issue creation for this task.

Cache labels used below:

- `private-live`: authenticated, tenant-bound, draft, preview, or request-bound; no public cache invalidation.
- `public-cached`: writes can affect a public cached surface and require policy, read tags, an invalidation owner, planner
  output, old/new identity handling, and focused tests.
- `no-public-impact`: no public output changes; for collections this still requires an explicit policy-catalog entry.
- `n/a`: client-only behavior or deferred scope with no current data write.

## Current Architecture Baseline

| Boundary | Current repository fact | Consequence for the dashboard |
| --- | --- | --- |
| Staff identity | [`basicUsers`](../../../src/collections/BasicUsers/index.ts) is auth-enabled; [`clinicStaff`](../../../src/collections/ClinicStaff.ts) and `platformStaff` are profile collections. `payload.config.ts` points Payload Admin at `basicUsers`. | #1532 must replace the actor and tenant model before later runtime work is merged. |
| Clinic authorization | [`getClinicAssignment`](../../../src/access/utils/getClinicAssignment.ts), [`scopeFilters`](../../../src/access/scopeFilters.ts), and role helpers expect authenticated `basicUsers` records and approved `clinicStaff` relationships. | Reusing these helpers unchanged would preserve the wrong identity boundary. |
| Bearer auth | The Supabase strategy already extracts and validates bearer tokens, but resolves staff through the current unified user model. | Token transport is reusable evidence, not a ready target contract. |
| External browser API | [`payload.config.ts`](../../../src/payload.config.ts) configures CORS only for `getServerSideURL()`. There is no clinic self/capability endpoint. | #1524 owns the environment allowlist, preflight behavior, and private-live bootstrap after #1532. |
| Payload API | Current collections expose Payload REST according to collection access rules; Payload remains the intended business API and authorization boundary. | The dashboard must not query Postgres directly or bypass collection/endpoint access. |
| Public freshness | Clinic detail and listing reads use canonical cache tags; clinic-related hooks normalize events into the central planner/executor. | New or changed public data in #1527–#1529 must prove read/write symmetry under ADR 023. |
| Deployment | Website and Payload share the current website deployment boundary; the external dashboard origin is not configured. | Exact preview/production origins and responsibility belong to #1522/#1524, not this matrix. |

## Global Integration Gates

These gates apply even to rows marked `existing`:

1. **Canonical auth work order — #1484 versus #1532.**
   [#1484](https://github.com/findmydoc-platform/website/issues/1484) and #1532 are both open and describe effectively
   the same staff-auth refactor. This record references #1532 because it belongs to the Clinic Dashboard deliverable;
   it does not declare either issue canonical. Runtime work must stop until the owner selects one execution issue and
   prevents duplicate implementation/closure behavior.
2. **Final staff principal — canonical auth issue.** `clinicStaff` becomes the direct auth collection, `basicUsers` is removed, tenant
   helpers and actor relationships are migrated, and ADR 006 is superseded.
3. **Application and trust boundary — #1522.** The standalone app, Payload, Supabase, website, Preview/Production
   origins, token transport, and failure behavior receive one accepted architecture contract.
4. **Browser/API bootstrap — #1524.** Fail-closed CORS and preflight behavior plus a private-live self/capability
   response expose user, clinic, status, and allowed actions.
5. **Typed dashboard actions — clinic-dashboard#1.** The rescued prototype currently emits only a string union. Target
   actions need IDs and typed payloads before they can call any mutation safely.

For traceability, later rows continue to cite #1532 because it is the Clinic Dashboard deliverable sub-issue. Those
references do not resolve the #1484/#1532 ownership gate.

## Visible UI Contract

Prototype source abbreviations:

- `P-Stories`: [ClinicDashboardPrototype.stories.tsx](https://github.com/findmydoc-platform/website/blob/be9efd19c98cf1461cb87dc5294c09a35d881f9d/src/stories/templates/ClinicDashboardPrototype.stories.tsx)
- `P-Fixtures`: [clinicDashboardPrototype.ts](https://github.com/findmydoc-platform/website/blob/be9efd19c98cf1461cb87dc5294c09a35d881f9d/src/stories/fixtures/clinicDashboardPrototype.ts)
- `P-Actions`: [prototype action types](https://github.com/findmydoc-platform/website/blob/be9efd19c98cf1461cb87dc5294c09a35d881f9d/src/components/templates/ClinicDashboardPrototype/types.ts)
- `P-QA`: [design QA manifest](https://github.com/findmydoc-platform/website/blob/be9efd19c98cf1461cb87dc5294c09a35d881f9d/output/playwright/stitch-clinic-dashboard/design-qa.md)

Anything not listed in this section is outside the implementation contract.

### Shared Shell

| Visible action or state | Current capability and allowed behavior | Status | Owner or dependency | Cache impact |
| --- | --- | --- | --- | --- |
| Navigate to Dashboard, Messages, Reviews, or Profile | Client routing only. The prototype closes mobile navigation but does not change screens in Storybook. | `existing` | clinic-dashboard#1 | `n/a` |
| Open and close mobile navigation | Implemented as local prototype state and covered by responsive stories. | `existing` | clinic-dashboard#1 | `n/a` |
| Render signed-in user and clinic identity | Fixture-only. Final values must come from a server-authorized self/capability response, never request-provided clinic IDs. | `Access/API gap` | #1532 → #1524 | `private-live` |
| Sign out | The dashboard can end its Supabase session client-side, but final redirect/session failure behavior depends on the target auth ADR. | `Access/API gap` | #1532, #1522, clinic-dashboard#1 | `private-live` |
| Open notifications | No notification model or endpoint is in the current issue set. | `later scope` | Unowned; keep disabled/fixture-only | `n/a` |
| Contact support | No support destination or case contract is in the current issue set. | `later scope` | Unowned; external link is a later product decision | `n/a` |

### Screen 1 — Dashboard Overview

Stitch screen `402f5f9f449145448cb341ace9c8a7cc`; prototype evidence in `P-Stories` and `P-Fixtures`.

| Visible action or state | Current capability and allowed behavior | Status | Owner or dependency | Cache impact |
| --- | --- | --- | --- | --- |
| Select 7, 30, or 90 days | UI controls exist, but the fixture remains fixed at 30 days. The reporting contract must accept only the three defined periods. | `Access/API gap` | #1531 after #1532/#1524 | `private-live` |
| Render profile views, inquiries, conversion, reviews, profile completeness, chart, funnel, and comparisons | `clinic_profile_viewed` and `patient_inquiry_created` events exist; no tenant-safe server aggregation exists. There is no impression or booking source. | `Access/API gap` | #1531; inquiry access/completeness depend on #1526/#1528. Existing reviews already support the review overview; #1529 is needed only for future response metrics. | `private-live` |
| Activate doctor profile | Doctors are clinic-scoped, but no `active` field or activation lifecycle exists despite `active` appearing in admin columns. | `later scope` | No owning backend issue; #1531 may only surface a source-backed remediation code | `public-cached` if later activated publicly |
| Upload certificate | `accreditation` is public master data and platform-writable; no clinic-owned credential document/upload lifecycle exists. | `later scope` | No owning backend issue; do not map to platform accreditation implicitly | `public-cached` only if a later public credential model is approved |
| Check certificate | There is no clinic-visible verification state or review contract for submitted credentials. | `later scope` | No owning backend issue | `private-live` until an explicit public visibility decision |
| Fix a profile-completeness task | Deterministic completeness is not implemented. Tasks need stable source-backed codes; arbitrary fixture labels are not contracts. | `Schema gap` | #1528 defines calculation; target action depends on the owning domain | `private-live` for the task list; target write may be `public-cached` |
| Download profile views | Raw provider access must stay server-side, and #1531 does not define an export format or download endpoint. | `later scope` | No owning backend issue | `private-live` if later approved |
| Open clinic preview | The allowed implementation is the existing approved public clinic profile. A clinic-staff draft preview is not implied. | `existing` | clinic-dashboard#1 opens the public URL; a draft preview would be later scope | `public-cached` read |
| Edit profile | Base clinic fields can be updated for the assigned clinic. Opening the editor is client routing; missing fields are classified on Screen 5. | `existing` | clinic-dashboard#1; global #1532/#1524 gates apply | Depends on the field written |
| Open public profile | Approved clinic detail is an existing public route backed by cached server data. | `existing` | clinic-dashboard#1 supplies the URL/navigation | `public-cached` read |

### Screen 2 — Messages

Stitch screen `b4e343c4f5cc4ea8b3bbe5144e6e97ec`.

| Visible action or state | Current capability and allowed behavior | Status | Owner or dependency | Cache impact |
| --- | --- | --- | --- | --- |
| List, search, and select conversations | `patientClinicInquiries` stores single submissions, not threads. The prototype selection carries no conversation ID and does not switch data. | `Schema gap` | #1526 establishes inquiry access; #1530 establishes threads | `private-live` |
| Open conversation menu | No menu commands or server contract are defined. | `later scope` | clinic-dashboard#1 may hide the menu until commands are scoped | `n/a` |
| Type a message draft | Local input state requires no backend. Draft persistence is not implied. | `existing` | clinic-dashboard#1 | `n/a` |
| Send message | No conversation/message collection, sender model, delivery state, or tenant-safe mutation exists. | `Schema gap` | #1530 after #1526 | `private-live` |
| Attach a file | No private thread-bound upload collection exists. Existing clinic media collections can be publicly served and must not be reused. | `Schema gap` | #1530 | `private-live` |
| Add internal note | No separate internal-note model or patient-hidden field contract exists. | `Schema gap` | #1530 | `private-live` |
| Use message template | Templates are not part of #1530 or another current backend issue. | `later scope` | Unowned; keep fixture-only | `n/a` |
| Show persisted read-receipt state | Read state is explicitly part of #1530. | `Schema gap` | #1530 | `private-live` |
| Show online or typing presence | Realtime presence/typing is explicitly outside #1530. | `later scope` | No owning backend issue | `private-live` if later approved |
| Open inquiry contact summary | A direct `patients` read by clinic staff is forbidden. The allowed panel is a purpose-limited projection of inquiry/conversation data. | `Access/API gap` | #1526 for inquiry contact; #1530 for conversation context | `private-live` |
| Open clinic profile editor or public profile | Same contracts as Dashboard Overview. | `existing` | clinic-dashboard#1 with Screen 5 dependencies | Field-dependent / public read |
| Emoji button | Prototype bug: it emits `add-internal-note`. No emoji-message contract is in scope. | `later scope` | clinic-dashboard#1 must correct or remove it | `n/a` |

### Screen 3 — Patient Profile Dialog

Stitch screen `b704e3e6c44b493f87d977fa0cb33f76`.

| Visible action or state | Current capability and allowed behavior | Status | Owner or dependency | Cache impact |
| --- | --- | --- | --- | --- |
| Open and close dialog with focus return | Local dialog behavior exists in the story. | `existing` | clinic-dashboard#1 | `n/a` |
| Show patient name, email, phone, and treatment interest | These fields exist on the inquiry, but clinic staff cannot currently read the own-clinic projection. The prototype phone row has no value. | `Access/API gap` | #1526; clinic-dashboard#1 fixes blank rendering | `private-live` |
| Show age, gender, and last visit | No justified source or approved clinic-facing projection exists. | `later scope` | No owning backend issue | `private-live` if later approved |
| Show medical notes | No source, consent scope, retention rule, or clinic permission exists. Internal notes in #1530 must not be repurposed as a patient medical record. | `later scope` | No owning backend issue | `private-live` if later approved |

### Screen 4 — Reviews Management

Stitch screen `ea6de0f88c9e44fd97b003b4bff0a39b`.

| Visible action or state | Current capability and allowed behavior | Status | Owner or dependency | Cache impact |
| --- | --- | --- | --- | --- |
| List, filter, refresh, and paginate own-clinic reviews | Approved reviews are publicly readable, but clinic staff cannot access a management projection or moderation states for its clinic. Prototype callbacks omit filter/page values. | `Access/API gap` | #1529; typed query contract in clinic-dashboard#1 | `private-live` management read |
| Render rating total and distribution | Current reviews maintain public rating aggregates, but the fixture total/distribution is not tied to repository data. A tenant-safe management projection is missing. | `Access/API gap` | #1529 for review read; #1531 for dashboard aggregate | Public aggregate is `public-cached`; management view is `private-live` |
| Respond to or edit a clinic response | Reviews have no clinic-response fields and clinic staff cannot update reviews. | `Schema gap` | #1529 | Approved response `public-cached`; draft/moderation `private-live` |
| Add internal review note | No clinic-private review-note model exists, and #1529 does not include a general clinic note feature. | `later scope` | No owning backend issue | `private-live` if later approved |
| Show response/review history | Current platform edit audit does not provide the prototype's clinic-visible response history. | `Schema gap` | #1529 | `private-live` |
| Appeal or flag a review | No appeal reason, status, platform decision, or own-clinic mutation exists. | `Schema gap` | #1529 | `private-live` |
| Export reviews | No export contract is in the current issue set. | `later scope` | Unowned | `n/a` |
| Create appointment | No appointment or booking domain exists; #1528 and #1530 explicitly exclude it. | `later scope` | Unowned | `n/a` |

### Screen 5 — Clinic Profile Editor

Stitch screen `42ffc21e25c74fe3be7b7f6317d12436`.

| Visible action or state | Current capability and allowed behavior | Status | Owner or dependency | Cache impact |
| --- | --- | --- | --- | --- |
| Edit clinic name, description, address, phone, coordinates, and thumbnail | Fields and own-clinic update rules exist in `clinics`; approved writes already revalidate public clinic surfaces. | `existing` | #1532/#1524 for external access | `public-cached` |
| Change an existing thumbnail or before/after gallery item | Clinic-owned media and published before/after gallery entries exist. Direct media changes still have the deferred #1468 revalidation gap. | `existing` | #1468 blocks complete public freshness | `public-cached` |
| Add or reorder a generic clinic gallery | The prototype assumes a generic ordered gallery that the current before/after model does not provide. | `later scope` | No owning backend issue | `public-cached` if later approved |
| Add or remove clinic specialties | Applications capture `medicalSpecialties`, clinics expose only generic tags, and doctor specialties belong to doctors. Approval does not materialize an equivalent clinic field. | `later scope` | No owning target model; #1525 must explicitly preserve or deliberately decline the application data, and the UI must not silently reuse tags | `public-cached` if later approved |
| Add or edit a doctor profile/photo | The visible team fixtures include doctors. `doctors` and `doctorMedia` already support own-clinic create/update, but the generic dialog does not provide all required doctor fields. | `existing` | A dedicated clinic-dashboard#1 doctor editor is required; #1468 blocks complete photo freshness | `public-cached` |
| Remove a doctor | Doctor deletion is platform-only. No current issue authorizes clinic-side removal or defines whether deactivation should replace deletion. | `Access/API gap` | Unowned permission/product decision; clinic-dashboard#1 keeps the action disabled | `public-cached` if later allowed |
| Add, edit, remove, or photograph a non-doctor team member | No public clinic-team collection exists. `clinicStaff` must remain auth-only and doctors remain separate. | `Schema gap` | #1527 | `public-cached` |
| Add a treatment | `clinictreatments` supports clinic-scoped create/update against platform-owned treatment master data, but the full dialog schema does not exist. | `Schema gap` | #1528 | `public-cached` |
| Reorder treatments | `clinictreatments` has no ordering field or reorder contract, and #1528 does not include ordering. | `later scope` | No owning backend issue | `public-cached` if later approved |
| Edit map position | Address, latitude, and longitude already exist and can be updated for the assigned clinic. | `existing` | #1532/#1524 for external access | `public-cached` |
| Edit opening hours | No structured opening/closing-time model exists. | `Schema gap` | #1528 | `public-cached` |
| Cancel or discard local edits | Client form-state behavior; no backend write should occur. | `existing` | clinic-dashboard#1 | `n/a` |
| Save local draft | Clinics have no versions/draft workflow. Updating an approved clinic is immediately live and revalidates public surfaces. The prototype's “saved locally” label is not a backend contract. | `later scope` | No owning backend issue; clinic-dashboard#1 may keep unsaved client state only | `private-live` only if a real draft model is approved |
| Publish profile changes | There is no separate profile publish transition. Current approved-clinic writes are immediately public. | `later scope` | No owning backend issue; do not expose this command against current writes | `public-cached` if later approved |

### Screen 6 — New Treatment Dialog

Stitch screen `4403f6cc252e441783ae584fd7e38eaf`.

| Visible action or state | Current capability and allowed behavior | Status | Owner or dependency | Cache impact |
| --- | --- | --- | --- | --- |
| Open and cancel dialog with focus return | Local dialog behavior exists. The declared `cancel-treatment` action is not emitted, but no backend call is needed. | `existing` | clinic-dashboard#1 | `n/a` |
| Enter free treatment name and category | Treatment names and medical-specialty relationships are platform-owned master data. Free clinic creation would contradict the current model and #1528's scope. | `later scope` | clinic-dashboard#1 must use existing master selection or keep the control disabled; a master-data redesign has no owner | `public-cached` if a later master-data change is approved |
| Enter duration, price, currency, description, and active state | Price and relationship exist; duration, ISO currency, description, and active state do not. | `Schema gap` | #1528 | `public-cached` |
| Save treatment | Prototype submit sends no values or target IDs. Target mutation must validate clinic ownership and master-data relationships. | `Schema gap` | #1528 plus typed clinic-dashboard#1 payload | `public-cached` |

### Screen 7 — Add Team Member Dialog

Stitch screen `df09d7542d1e4be8b3ae1b9165a2a584`.

| Visible action or state | Current capability and allowed behavior | Status | Owner or dependency | Cache impact |
| --- | --- | --- | --- | --- |
| Open and cancel dialog with focus return | Local dialog behavior exists. The declared `cancel-team-member` action is not emitted, but no backend call is needed. | `existing` | clinic-dashboard#1 | `n/a` |
| Enter a doctor through the generic team form | The role fixtures can imply a doctor, but current Doctors requires additional identity, gender, qualification, and language fields. The generic team form cannot create a valid doctor contract. | `later scope` | clinic-dashboard#1 must route doctors to a dedicated editor; no backend redesign is owned here | `public-cached` |
| Enter non-doctor name, role, and biography | No public non-doctor clinic-team model exists. Prototype role options are fixtures, not taxonomy decisions. | `Schema gap` | #1527 | `public-cached` |
| Choose non-doctor team photo | No public-team-owned upload relationship exists; media ownership and deletion behavior must be explicit. | `Schema gap` | #1527; #1468 applies if existing public media infrastructure is reused | `public-cached` |
| Save non-doctor team member | Prototype submit sends no values. Target record must be bound server-side to the authenticated staff member's clinic and must never reuse clinicStaff identity fields. | `Schema gap` | #1527 plus typed clinic-dashboard#1 payload | `public-cached` |

## Data and Permissions

| Collection or source | Fields or capability | Relationship | Current permission | Provenance or freshness | Status |
| --- | --- | --- | --- | --- | --- |
| `basicUsers` + `clinicStaff` | Staff identity, approval, clinic assignment | `clinicStaff.profile → basicUsers`; `clinicStaff.clinic → clinics` | `basicUsers` is the auth principal; approved clinic profile resolves tenant scope | Private live through Supabase strategy and Payload lookup | `Access/API gap` — replace through #1532 |
| `clinics` | Name, rich description, address, phone, coordinates, thumbnail, status, tags | One clinic is assigned through clinic staff | Clinic staff can update only its assigned clinic; approved reads are public | Approved public detail/listing is cached; write hooks exist | `existing` for current fields; missing fields remain #1528 |
| `clinicMedia`, `clinicGalleryMedia`, `clinicGalleryEntries` | Clinic-owned uploads and published before/after gallery entries | Media/entry belongs to one clinic | Clinic-scoped writes; published assets/entries can be public | Public clinic detail is cached; direct media invalidation is deferred | `existing` for the current model; prototype generic gallery remains `later scope` |
| `treatments` + `clinictreatments` | Platform master treatment plus clinic price/relationship | Clinic treatment belongs to one clinic and one master treatment | Master writes are platform-only; clinic may create/update own relationship but not delete | Public clinic detail/listing is cached and clinic-treatment hooks exist | `Schema gap` for duration, description, currency, active, order |
| `doctors`, `doctorspecialties`, `doctortreatments` | Public doctor profiles and their clinic-scoped relationships | Doctor belongs to one clinic | Clinic may create/update own doctor and relationships; delete is platform-only | Public clinic detail is cached; related hooks exist | `existing` for doctor profiles; activation semantics are a `Schema gap` |
| `accreditation` | Public accreditation master data | No clinic credential/submission relationship | Anyone may read; only platform may write | Public clinic-related output is cached | `Schema gap` for certificate submission/verification |
| `patientClinicInquiries` | Contact submission, treatment interest, status, evidence, assignment | Inquiry belongs to a clinic | Current collection access is platform-only; public route writes with controlled override | Explicit private-live policy | `Access/API gap` — #1526 |
| `clinicApplications` | Registration data including requested medical specialties | Application may later materialize a clinic and first clinicStaff account | Public route creates controlled applications; platform owns review/provisioning | Private-live until an approved public clinic is created | `Access/API gap` for provisioning — #1525; clinic-specialty target remains `later scope` |
| `patients` | Patient identity/profile | Patient owns its profile | Clinic staff has no direct read access | Private live | `Access/API gap`; direct clinic read must remain forbidden |
| `reviews` | Patient review, moderation status, aggregate updates, edit audit | Review relates to clinic, doctor, treatment | Approved public read; patient/platform create; update/delete platform-only | Approved reviews affect cached clinic detail/listing | `Schema gap` for responses/appeals and own-clinic management — #1529 |
| Public non-doctor clinic team | Name, role, biography, photo, order, visibility | Must belong to one clinic, separate from auth staff | No collection or permission exists | Must be public-cached when approved/active | `Schema gap` — #1527 |
| Conversations/messages/private attachments | Thread, sender, message, read state, internal note, upload | Must derive clinic and participants from inquiry/auth context | No collections or permission rules exist | Must remain private-live/no-public-impact | `Schema gap` — #1530 |
| PostHog + Payload reporting projection | Profile views, inquiries, conversion, reviews, completeness | Must be aggregated for authenticated clinic only | Events exist, but no server reporting contract exists | Private live; no client provider key | `Access/API gap` — #1531 |

## Cache Impact Contract

### Decision

The #1523 documentation change itself is `no-public-impact`: it changes no route, loader, hook, schema, or public data.

For the planned implementation slices, the decision is domain-specific:

| Domain | Cache-impact decision | Reason |
| --- | --- | --- |
| Private auth, session, invitation, application, and clinic bootstrap state | `no-public-impact` | Identity, approval workflow, sessions, and capabilities are private-live. |
| #1532 actor-relation migration on public documents | `public-cached` | `posts.authors` currently references `basicUsers`; relation rewrites must assess public reader output plus migration/seed flush behavior. |
| Approved clinic materialization from onboarding | `public-cached` | The application remains private, but creation or approval of a public clinic must pass through the clinic hook/planner boundary or an explicit terminal flush. |
| Inquiries | `no-public-impact` | Tenant-bound operational data; never public cached. |
| Conversations, messages, attachments, internal notes | `no-public-impact` | Patient- and clinic-bound private data. |
| Dashboard analytics | `no-public-impact` | Tenant-scoped server aggregation; private-live unless a later ADR decides otherwise. |
| Approved clinic fields and opening hours | `public-cached` | Rendered on public clinic detail and potentially listing surfaces. |
| Active clinic treatments | `public-cached` | Rendered on public clinic detail and listing comparison. |
| Approved/active public team members | `public-cached` | New public clinic-detail dependency. |
| Approved clinic review responses | `public-cached` | Public review presentation changes; draft, appeal, and moderation state remain private-live. |

### Dependency Map

| Source/write | Public read/output | Current owner/event | Excluded private input |
| --- | --- | --- | --- |
| `clinics` update/status/slug change | Clinic detail, listing comparison, sitemap-related surface | Clinic hooks → clinic-surface planner event | Draft/preview and staff bootstrap |
| `clinictreatments` change/delete | Clinic detail and listing comparison | Clinic-treatment hooks resolve current/previous clinic relations | Internal edit form state |
| `clinicGalleryEntries` publish/change/delete | Clinic detail | Gallery-entry hooks → clinic-surface event | Unpublished entries |
| `clinicMedia`, `clinicGalleryMedia`, `doctorMedia` change/delete | Clinic/detail imagery when referenced | Deferred; no complete dependency invalidation | Private upload metadata |
| New public team record | Clinic detail | No owner/event exists yet | Authenticated `clinicStaff` identity and roles |
| Approved review change | Clinic detail, listing comparison, rating output | Review hooks cover current review visibility | Appeals, internal notes, moderation drafts |
| Approved clinic response change | Clinic detail is the only evidenced target surface; the response model/reader is absent | Model choice determines whether the existing review hook or a new owner/event applies | Draft response, appeal, and moderation state |
| Inquiry/message/reporting writes | None | Private-live policy; no public revalidation | All patient/contact/message/analytics details |

### Read/Write Symmetry

| Domain | Cache class/policy | Read tags and key | Write event and owner | Old/new identity and bounded paths | Status |
| --- | --- | --- | --- | --- | --- |
| Clinic profile | `critical-public` clinic detail + `aggregated-public` listing | Clinic-detail identity tags are slug + surface; data tags are entity + slug + surface + instance + related collections. `collection:clinics` belongs to listing reads, not the clinic-detail loader. | `Clinics` hooks → `revalidateClinicSurfaces` → planner/executor | Planner handles current/previous slug and status; clinic detail paths are bounded | Existing runtime symmetry for current fields; policy catalog still declares a clinic-detail collection family that the loader does not use |
| Clinic treatments | Same clinic/listing classes | Clinic detail tags `clinictreatments`; listing dependency tags | Treatment hooks resolve current and previous clinics | Bounded affected clinic slugs/IDs plus listing surface | Existing for relation writes; nested master-data tag gap remains |
| Gallery entries | `critical-public` clinic detail | Clinic detail collection/surface/instance tags | Entry hooks resolve clinic relation and publish state | Current/previous clinic identities and clinic path | Existing for entries; media-file gap remains #1468 |
| Public team | Must join `critical-public` clinic detail | New collection tag plus clinic-detail surface/instance tags required | New collection hook and normalized planner event required | Current/previous clinic and visibility state; bounded clinic path | Missing — #1527 |
| Review responses | Existing clinic-detail public class if stored on review; otherwise explicit new policy entry | Public reader must tag the response source and clinic-detail surface. Listing is not a proven response consumer. | Review hook can be extended only if the response lives on review; separate collection needs a new owner/event | Current/previous clinic and response visibility; bounded clinic path | Missing — #1529 and a model decision |
| Private domains | `private-live`, non-taggable policy entry for each new collection | No public cache key or tags | No public revalidation event | No public paths | Required classification in #1530 and any new private collection |

Known symmetry gaps that later work must not conceal:

1. Direct changes to `clinicMedia`, `clinicGalleryMedia`, and `doctorMedia` do not invalidate all public consumers. The
   policy deliberately defers media dependency handling to
   [website#1468](https://github.com/findmydoc-platform/website/issues/1468).
2. Clinic detail renders nested treatment and medical-specialty names, but its read tags do not include
   `collection:treatments` or `collection:medical-specialties`. #1528 must address this if those master values can change
   public clinic output.
3. Listing comparison renders clinic tags but does not read with `collection:tags`, and the tag collection has no
   revalidation hook. Clinic specialties must not be mapped to generic tags without resolving this boundary.

### Tests

Current evidence includes:

- [`cachePolicy.test.ts`](../../../tests/unit/utilities/cachePolicy.test.ts) for fail-closed taggable/private policy
  behavior.
- [`plannerExecutor.test.ts`](../../../tests/unit/utilities/cacheRevalidation/plannerExecutor.test.ts) for normalized
  plan execution.
- [`revalidateClinicSurfaces.test.ts`](../../../tests/unit/hooks/revalidateClinicSurfaces.test.ts) and
  [`revalidateClinicRelatedCollections.test.ts`](../../../tests/unit/hooks/revalidateClinicRelatedCollections.test.ts)
  for clinic-related events, tags, and paths.
- [`clinicDetailServerData.contract.test.ts`](../../../tests/unit/utilities/clinicDetailServerData.contract.test.ts) and
  [`listingComparisonServerData.contract.test.ts`](../../../tests/unit/utilities/listingComparisonServerData.contract.test.ts)
  for read tags and public filtering.
- [`cacheArchitectureCoverage.test.ts`](../../../tests/integration/contracts/cacheArchitectureCoverage.test.ts) for
  policy-catalog coverage of collections and globals.

Each `public-cached` follow-up must add focused read-tag, hook/planner, old/new relation or visibility, and bounded-path
tests. Each new private collection must prove a non-taggable private-live catalog entry and tenant-isolation tests.

### Stop Conditions

Stop implementation and obtain an ADR or explicit work order when any slice requires:

- a new cache class, tag family, owner type, freshness expectation, route family, remote cache, custom cache handler,
  Cache Components, or changed invalidation semantics;
- public review responses without an explicit draft/approved visibility and moderation contract;
- media dependency invalidation without the bounded resolver owned by #1468;
- treatment/specialty master-data invalidation without explicit read tags, affected clinic resolution, and bounded paths;
- a public output whose previous clinic, slug, relation, or visibility cannot be recovered safely.

## Known Bugs, Gaps, and False Assumptions

| Finding | Why it blocks later work | Owner or disposition |
| --- | --- | --- |
| The prototype is Storybook-only; all business actions use `noAction`. | It is visual truth, not an application or integration proof. | clinic-dashboard#1 transfers the shell; backend issues own behavior. |
| `ClinicDashboardAction` carries only a string, no ID, form values, filter, page, order, or relation payload. | Mutations cannot identify a target or validate intent. | clinic-dashboard#1 must introduce typed action/command payloads before API wiring. |
| Conversation selection has no ID and does not change the active thread. | Thread isolation cannot be tested or enforced. | clinic-dashboard#1 + #1530. |
| The emoji button emits `add-internal-note`. | A visible control triggers the wrong semantic action. | clinic-dashboard#1. |
| Treatment/team submits send no values and do not close; declared cancel actions are unused. | Forms cannot produce validated commands or reliable state transitions. | clinic-dashboard#1 before integration. |
| `add-clinic`, `add-gallery-image`, `open-profile-views-menu`, and `toggle-settings` are declared but have no visible implementation. | Treating the action union as a complete feature inventory would invent scope. | clinic-dashboard#1 removes dead variants or adds them only after explicit product scope. |
| Patient phone renders blank; medical notes and last visit have no source. | Encourages unsupported sensitive-data exposure. | clinic-dashboard#1 rendering fix; #1526 permits only the inquiry projection, while extra sensitive fields remain later scope. |
| Profile “saved locally”, discard, and publish controls imply a draft workflow. | Current approved clinic writes are immediately public and revalidated. | Unowned later scope; no implicit persistence. |
| Free treatment name/category implies clinic-owned master data. | Current treatment master is platform-owned; accepting free text would bypass taxonomy rules. | clinic-dashboard#1 must select existing master data; redesign remains unowned later scope. |
| Generic ordered gallery is not the current before/after gallery model. | Existing media endpoints do not prove the intended UI contract. | Unowned later scope plus #1468 freshness gate for current media. |
| The generic team action conflates doctor cards with the future non-doctor public team. | Doctors, public team profiles, and auth staff have different required fields, permissions, and cache behavior. | clinic-dashboard#1 separates doctor UI; #1527 owns only non-doctor public team records. |
| `active` appears in Doctors admin columns, but no field/lifecycle exists. | “Activate doctor profile” cannot be implemented from current data. | Later scope; no backend issue was created by this matrix. |
| Review fixtures claim 1,248 reviews and pagination while only three records exist. | Fixture totals cannot seed reporting or acceptance expectations. | #1529/#1531 must return source-backed empty/real states. |
| Prototype funnel language conflates inquiries with bookings/reservations. | The repository has inquiry events but no booking domain. | #1531 must define conversion only from available sources; appointments remain later scope. |
| Clinic application approval does not materialize clinic/auth/staff records and partial profile creation errors can be swallowed. | No reproducible first clinic account exists for dashboard use. | #1525 after the selected #1484/#1532 auth refactor. |
| #1484 and #1532 are both open with effectively the same staff-auth target. | Two runtime work orders could produce duplicate PRs, conflicting relationships, or ambiguous closure. | Owner must select one canonical execution issue before auth implementation; this document changes neither issue. |
| Current CORS and self/bootstrap behavior is website-only. | An external browser app cannot safely discover tenant/capabilities. | #1524 after the selected #1484/#1532 auth refactor. |
| Public media and nested master-data cache dependencies are incomplete. | Public profile updates can appear stale after otherwise successful dashboard writes. | #1468 and the #1528 read/write-symmetry work. |

## Issue Impact and Dependency Matrix

| Issue | Primary work | Schema | Auth/session | Permission/API | Public cache/revalidation | Hard dependency or gate |
| --- | --- | --- | --- | --- | --- | --- |
| [#1484](https://github.com/findmydoc-platform/website/issues/1484) | Staff-auth refactor overlapping #1532 | Yes, broad migration | Primary change | Rewrites actor/tenant helpers | Private auth plus public actor-relation assessment | Ownership stop-gate: select one canonical execution issue with #1532 |
| [#1522](https://github.com/findmydoc-platform/website/issues/1522) | Application/API architecture ADR | No | Defines transport boundary | Defines ownership/trust boundary | References, does not implement | #1523 input; final text needs the selected auth ADR |
| [#1523](https://github.com/findmydoc-platform/website/issues/1523) | Historical capability contract | No | No | No | Classification only | First task |
| [#1524](https://github.com/findmydoc-platform/website/issues/1524) | CORS, preflight, bearer bootstrap | No | Yes, at external API edge | Yes | No public impact | #1532 principal; #1522 boundary |
| [#1525](https://github.com/findmydoc-platform/website/issues/1525) | Provisioning, invites, lifecycle | Yes, auth/lifecycle fields and migration | Yes | Platform-only privileged transitions | No public impact until an approved clinic is materialized | #1532; dashboard destinations from #1522 |
| [#1526](https://github.com/findmydoc-platform/website/issues/1526) | Own-clinic inquiry access/status | Existing schema with protected field rules | Uses final principal | Yes, tenant and field-level | No public impact/private-live | #1532; #1524 for browser integration |
| [#1527](https://github.com/findmydoc-platform/website/issues/1527) | Public non-doctor clinic team | Yes, new collection | Must remain separate from auth staff | Yes, own-clinic writes | Yes, new policy/read/hook/planner coverage | #1532 principal; #1522/#1524 for dashboard writes |
| [#1528](https://github.com/findmydoc-platform/website/issues/1528) | Clinic fields, treatments, completeness | Yes, migrations | Uses final principal | Own-clinic writes | Yes, clinic/listing symmetry | #1532; current Treatment master remains authoritative |
| [#1529](https://github.com/findmydoc-platform/website/issues/1529) | Review responses, appeals, audit | Yes | Uses final principal | Yes, own-clinic vs platform moderation | Yes for approved responses only | #1532; public response visibility contract |
| [#1530](https://github.com/findmydoc-platform/website/issues/1530) | Conversations, messages, private attachments | Yes, new private domain | Uses final principal and patient identity | Yes, participant/tenant/field isolation | Explicit private-live policy only | #1526 inquiry ownership; #1532 |
| [#1531](https://github.com/findmydoc-platform/website/issues/1531) | Tenant-safe reporting contract | Undecided; no persistence may be assumed | Uses final principal | Yes, server aggregation | No public impact/private-live | Existing reviews plus source definitions from #1526/#1528; #1529/#1530 only if their data is explicitly reported |
| [#1532](https://github.com/findmydoc-platform/website/issues/1532) | Replace staff auth collections and ADR 006; overlaps #1484 | Yes, broad migration | Primary change | Rewrites actor/tenant helpers | Private auth; public author relations must be checked | Resolve canonical ownership with #1484; then runtime gate for #1524–#1531 |
| [#1533](https://github.com/findmydoc-platform/website/issues/1533) | Remove website clinic auth paths | No expected domain schema | Removes old routes/targets | Redirect/cutover checks | No public data impact | Verified dashboard login/invite/reset/logout cutover |
| [clinic-dashboard#1](https://github.com/findmydoc-platform/clinic-dashboard/issues/1) | Deployable fixture-backed app shell | No backend schema | Explicitly out of scope | Explicitly out of scope | None | Can run after #1523; API wiring waits for #1532/#1522/#1524 |

## Recommended Work Order and Parallelism

| Phase | Work | Parallelism and gate |
| --- | --- | --- |
| 0 | **#1523 capability matrix** | First. It prevents architecture and schema work from treating fixture assumptions as contracts. |
| 1 | **Resolve #1484/#1532, then execute the canonical auth ADR and identity refactor** | Ownership and runtime gate. #1522 research and schema design notes for #1527–#1530 may proceed in parallel, but runtime changes must target the final principal. |
| 2 | **Finalize #1522**, then implement **#1524** | #1522 consumes the auth decision; #1524 implements the approved origin/token/bootstrap boundary. clinic-dashboard#1 can continue fixture-only throughout. |
| 3 | **#1525, #1526, #1527, #1528, #1529** | Backend slices can run in parallel once #1532 and shared API rules are stable. #1527–#1529 share cache/revalidation surfaces and need coordination to avoid conflicting planner/catalog edits. End-to-end dashboard calls also require #1524. |
| 4 | **#1530 conversations/messages** | Requires the inquiry tenant/ownership contract from #1526. UI shell work may prepare empty/loading/error states earlier. |
| 5 | **#1531 reporting** | Metric definitions can be drafted earlier; implementation waits until each reported source is real and source-backed. It must not label inquiries as bookings. |
| 6 | **Dashboard integration and cutover evidence** | Wire typed UI commands to the available capability contract; verify tenant, auth expiry, forbidden origin, and empty states. |
| 7 | **#1533 website auth-path removal** | Last. Requires proven dashboard login, refresh, logout, invite, reset, and redirect behavior. |

Hard dependencies are narrower than the recommended sequence:

- The owner must first resolve the open #1484/#1532 duplicate; the selected auth issue is then a hard runtime dependency
  for #1524–#1531 because current actor and tenant helpers are being removed.
- #1522 can be drafted alongside #1532, but its accepted target must reference the final auth ADR.
- #1530 requires #1526's inquiry ownership and tenant rules.
- #1531 requires source-backed metric definitions; unavailable sources must return stable empty states.
- #1533 requires successful dashboard cutover evidence.
- clinic-dashboard#1 has no backend dependency while it remains fixture-only.

## Component and Implementation Ownership Plan

| Feature | Reuse, change, or new | Candidate owner/module | Notes |
| --- | --- | --- | --- |
| Prototype screens and responsive states | Reuse visual structure | clinic-dashboard#1 | Preserve seven stable states; remove website runtime dependency. |
| Typed commands and routing | Change | clinic-dashboard app shell | Replace string-only callbacks with IDs and validated payload types. |
| Staff principal and tenant resolution | Change | #1532 in website auth/access modules | Supersede ADR 006; no Payload Admin access for clinic staff. |
| Self/capability bootstrap | New endpoint/contract | #1524 under website API boundary | Private-live, fail-closed, derived server-side. |
| Inquiry management | Change existing collection/access | #1526 | Protect evidence/internal fields; no direct patient collection read. |
| Public team | New collection and public reader dependency | #1527 | Separate doctors, public team, and auth staff. |
| Clinic profile/treatment fields | Change existing collections | #1528 | Reuse current Sources of Truth and revalidation architecture. |
| Review response/appeal | New review-domain state | #1529 | Separate public approved response from private moderation. |
| Conversation domain | New private collections/uploads | #1530 | Never reuse partially public media collections. |
| Reporting projection | New private endpoint/service | #1531 | Provider secrets and patient-level data remain server-side. |

## Source and Test Map

### Auth, Access, and API

- [`payload.config.ts`](../../../src/payload.config.ts)
- [`supabaseStrategy.ts`](../../../src/auth/strategies/supabaseStrategy.ts)
- [`userLookup.ts`](../../../src/auth/utilities/userLookup.ts)
- [`ClinicStaff.ts`](../../../src/collections/ClinicStaff.ts)
- [`scopeFilters.ts`](../../../src/access/scopeFilters.ts)
- [`getClinicAssignment.ts`](../../../src/access/utils/getClinicAssignment.ts)
- [`permission-matrix.config.ts`](../../../src/security/permission-matrix.config.ts)
- [`collectionContractRegistry.ts`](../../../tests/integration/contracts/collectionContractRegistry.ts)
- [`supabaseStrategy.test.ts`](../../../tests/unit/auth/strategies/supabaseStrategy.test.ts)
- [`clinicStaff-access.test.ts`](../../../tests/integration/access/clinicStaff-access.test.ts)

### Domain Collections and Contracts

- [`Clinics.ts`](../../../src/collections/Clinics.ts)
- [`ClinicTreatments`](../../../src/collections/ClinicTreatments/index.ts)
- [`ClinicGalleryEntries`](../../../src/collections/ClinicGalleryEntries/index.ts)
- [`ClinicMedia`](../../../src/collections/ClinicMedia/index.ts)
- [`Doctors.ts`](../../../src/collections/Doctors.ts)
- [`Accreditation.ts`](../../../src/collections/Accreditation.ts)
- [`PatientClinicInquiries.ts`](../../../src/collections/PatientClinicInquiries.ts)
- [`Reviews.ts`](../../../src/collections/Reviews.ts)
- [`patientClinicInquiries.lifecycle.test.ts`](../../../tests/integration/patientClinicInquiries.lifecycle.test.ts)
- [`reviews-access.test.ts`](../../../tests/integration/access/reviews-access.test.ts)
- [`clinictreatments.permission.test.ts`](../../../tests/unit/access-matrix/clinictreatments.permission.test.ts)
- [`clinicGalleryEntries.lifecycle.test.ts`](../../../tests/integration/clinicGalleryEntries.lifecycle.test.ts)

### Public Cache and Revalidation

- [`cachePolicy/index.ts`](../../../src/utilities/cachePolicy/index.ts)
- [`cacheRevalidation/planner.ts`](../../../src/utilities/cacheRevalidation/planner.ts)
- [`cacheRevalidation/executor.ts`](../../../src/utilities/cacheRevalidation/executor.ts)
- [`revalidateClinicSurfaces.ts`](../../../src/hooks/revalidateClinicSurfaces.ts)
- [`getClinicDetailServerData.ts`](../../../src/utilities/clinicDetail/serverData/getClinicDetailServerData.ts)
- [`getListingComparisonServerData.ts`](../../../src/utilities/listingComparison/serverData/getListingComparisonServerData.ts)

## Acceptance Criteria

- [x] All seven prototype screens and their visible actions/states are represented.
- [x] Every listed action/state has exactly one of `existing`, `Access/API gap`, `Schema gap`, or `later scope`.
- [x] Existing collections, access helpers, hooks, public loaders, and representative tests are linked.
- [x] Known backend and prototype bugs are mapped to existing issues or explicitly held as unowned later scope; no new
  issue was created.
- [x] Hard dependencies, recommended order, and parallel work lanes are documented.
- [x] Private-live/no-public-impact and public-cached flows are separated, with current symmetry gaps and stop conditions.
- [x] The document makes no schema, auth, metric, visibility, or cache decision beyond accepted repository contracts.

Verification evidence for this documentation slice is `pnpm format` plus `pnpm docs:check`. Runtime, schema, auth, cache,
and browser tests belong to the owning implementation issues.

## Assumptions and Data Gaps

### Assumptions

- The rescued prototype commit and Stitch project remain design evidence, not production source code.
- Payload remains the only business API and permission boundary, as required by #1522.
- Current issue bodies remain aligned between FounderOps and GitHub, as stated by the project owner.
- The target dashboard uses the final #1532 clinicStaff principal; this record does not prescribe implementation details
  before the ADR exists.

### Data Gaps

- No approved product contract exists for doctor activation, clinic credential submission/verification, generic clinic
  specialties, generic gallery ordering, persisted profile drafts, notifications, support cases, exports, templates, or
  appointments.
- No lawful/source-backed contract exists for patient age, gender, last visit, or medical notes in the clinic dialog.
- No source exists for impressions, bookings, or reservations. Conversion must not be defined from fixture wording.
- Public response visibility/model choice, draft/publish semantics, and media dependency resolution remain explicit stop
  conditions.
- The committed prototype QA manifest references comparison images that are not present in the rescued Git tree. Stable
  evidence is the Stitch project plus reproducible stories/fixtures, not committed raster comparisons.

## Review Handoff

- Expected implementation surfaces: auth/access/API, Payload collections and migrations, cache policy/planner/hooks,
  public clinic loaders, private tenant-bound endpoints, and the standalone dashboard app shell.
- Required reviewers when each implementation slice is ready:
  - Security reviewer for #1532, #1524, #1525, #1526, #1529, #1530, and #1531 because they change authentication,
    tenant isolation, sensitive fields, or trust boundaries.
  - Cache architecture reviewer for #1527, #1528, and public response work in #1529 because they change collections,
    public reads, hooks, or revalidation.
  - Accessibility, mobile UI, and Storybook reviewers for the clinic-dashboard app-shell/UI PR, not for this docs-only
    website change.
- Re-check current main, accepted ADRs, issue acceptance criteria, and the permission/cache catalogs before each runtime
  implementation. This historical record must not override drift.
