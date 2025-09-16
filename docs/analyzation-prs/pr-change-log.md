## PR Change Log (Chronological)

Authoritative, code‑sourced ledger of structural and behavioral changes. Every entry maps a merged PR → affected file groups → categorized impact surface. No speculation—only what is observable in the repository history.

## Index
Summary table of processed substantive PRs (excludes pure dependency-only exclusion tables). Reverse chronological ordering.

| PR | Title (Condensed) | Primary Tags | Key Impact Surfaces |
|----|-------------------|--------------|---------------------|
| 207 | CI: Conventional Commit PR title check | infra, quality | New workflow enforcing PR title standard |
| 195 | Multi-user auth architecture (patients, clinic staff, platform) | auth, schema, frontend, seed, infra | New collections, auth utilities/routes, migrations, seeding, pages |
| 191 | Dependabot payloadcms pattern adjustment | infra, deps-meta | Dependabot config tweaks for payloadcms grouping |
| 186 | Fix S3 storage: type/schema mismatch + migration | schema, infra | Media schema alignment; migration and plugin config coherence |
| 184 | CI build: PostgreSQL service + migration handling | infra, ops | Build job DB service; migration execution reliability |
| 177 | Deploy workflow: manual trigger | infra, ops | Adds workflow_dispatch + inputs; manual production deploy path |
| 176 | Reviews + Medical Specialties revamp + seeding | schema, content-model, seed, admin-ux | Reviews collection validation/hooks; average ratings calc; review/specialty seed units |
| 175 | Slug generation: uniqueness + admin UX | content-model, admin-ux | Slug hook refactor, UI behavior, optional uniqueness checks |
| 174 | Doctor full name generation (with title) | content-model, admin-ux, dx | beforeValidate naming hook, admin field visibility, VS Code settings |
| 173 | DoctorSpecialties join (doctor ↔ medical specialty) | schema, content-model, integrity | New join collection; enum + unique pair index; migrations & types |
| 168 | DoctorTreatments join (doctor ↔ treatment) | schema, content-model, performance | New join collection; unique index; migrations & types |
| 166 | ClinicTreatments join (clinic ↔ treatment w/ price) | schema, content-model, performance, seed, infra | New join collection; migrations, seeding & workflow tweaks |
| 88 | Rename Treatments → Medical Specialties | naming-churn, schema, refactor, content-model | New collection, relationships, migrations, types |
| 126 | CI & CD refactor with Vercel script | infra, ops, quality, dx | Workflow restructure; Vercel deploy script; VS Code DX |
| 57 | Supabase Storage Integration | infra, ops, deps | External media storage configuration |
| 52 | Admin (Staff) Collection & Supabase Auth Consolidation | auth, schema, refactor | New Staff schema, auth strategy, migration squash |
| 49 | Clinic & Doctor Seed Data + Slug Routing | schema, seed, content-model | Slug fields, seeding endpoints, baseline migration rename |
| 42 | VSCode Extension Recommendations | infra, quality | DX tooling recommendations |
| 40 | Clinics on Home + Login Integration | frontend, content-model, auth | Homepage clinics listing + auth UI integration |
| 38 | Authentication Forms (Login & Registration UI) | auth, frontend | UI components for auth flows |
| 33 | DX Editor Extensions & Tooling Enhancements | infra, quality | Developer workflow improvements |
| 31 | Deployment Workflow (CD) Introduction | infra, ops | Adds deploy workflow pipeline |
| 29 | Node Runtime & Deployment Alignment | infra, ops, quality | Node image bump, dockerignore, workflow trigger |
| 21 | Template Cleanup & pnpm Migration | infra, refactor, deps | Package manager switch, cleanup |
| 14 | pgAdmin Service Addition | ops, infra | Local DB admin tooling |
| 13 | Migration Artifacts Re-introduction | schema, content-model | Ensures base migration presence |
| 12 | Initial Schema Bootstrap | schema, content-model, performance | Foundational tables & indices |
| 9  | CI/CD & Linting Foundation | infra, quality, deps | Workflows & lint configuration |

Note: Dependency-only grouped exclusions (e.g., PRs 36–37, 41) are intentionally summarized minimally above or omitted.

### Excluded (Dependency-only) PRs 32, 34, 35
Rationale: Pure dependency bumps with no accompanying source logic, schema, or infrastructure changes beyond lockfile/config version increments.
| PR | Status (implied by merge commit) | Title (abridged) | Disposition |
|----|----------------------------------|------------------|-------------|
| 32 | merged | bump npm_and_yarn group (2 updates) | Excluded (dependency-only) |
| 34 | merged | bump react-hook-form 7.45.4→7.54.2 | Excluded (dependency-only) |
| 35 | merged | bump autoprefixer 10.4.20→10.4.21 | Excluded (dependency-only) |



### Excluded (Dependency-only) PRs 181–183
Rationale: Automated dependency updates only (package.json + pnpm-lock.yaml) with no source/schema/config logic.
| PR | Status | Title (abridged) | Disposition |
|----|--------|------------------|-------------|
| 181 | merged | chore(deps): bump lucide-react, payload, react-hook-form | Excluded (dependency-only) |
| 182 | merged | build(deps-dev): bump @types/node/react/react-dom | Excluded (dependency-only) |
| 183 | merged | chore(deps): bump payloadcms group to 3.38.0 | Excluded (dependency-only) |

### Excluded (Dependency-only) PR 187
Rationale: Runtime-only dependency bump of base Node image; no application, schema, or workflow logic.
| PR | Status | Title (abridged) | Disposition |
|----|--------|------------------|-------------|
| 187 | merged | chore(deps): bump node 22.15.1-alpine → 22.16.0-alpine | Excluded (dependency/runtime only) |

### Excluded (Dependency-only) PRs 193–194, 196
Rationale: Automated dependency bumps only (package.json + pnpm-lock.yaml) with no source/schema/config logic.
| PR | Status | Title (abridged) | Disposition |
|----|--------|------------------|-------------|
| 193 | merged | chore(deps): bump dependencies group (22 updates) | Excluded (dependency-only) |
| 194 | merged | build(deps-dev): bump dev-dependencies group (5 updates) | Excluded (dependency-only) |
| 196 | merged | build(deps-dev): bump dev-dependencies group (2 updates) | Excluded (dependency-only) |

### Excluded (Dependency-only) PR 198
### Excluded (Dependency-only) PR 203
Rationale: Dependabot-style grouped bump of PayloadCMS packages; package.json and lockfile only.
| PR | Status | Title (abridged) | Disposition |
|----|--------|------------------|-------------|
| 203 | merged | chore(deps): bump payloadcms group (13 updates) | Excluded (dependency-only) |
Rationale: Single dependency bump (react-hook-form) with only package.json and lockfile changes.
| PR | Status | Title (abridged) | Disposition |
|----|--------|------------------|-------------|
| 198 | merged | chore(deps): bump react-hook-form 7.56.4→7.57.0 | Excluded (dependency-only) |

---

## PRs to process (work queue)
The following PR numbers were supplied as the current work queue. Create or resolve placeholders for each and remove the entry from this list when the PR has been processed (placeholder replaced or marked ignored).

The current unprocessed placeholders (detected in the document):

- 188
- 189
- 190
- 191
- 191
- 192
- 193
- 194
- 195
- 196
- 197
- 198
- 201
- 202
- 203
- 204
- 205
- 206
- 207


### Objectives
1. Enable reverse lookup: given a PR, what domains, schema objects, or infra layers did it affect?
2. Support reconciliation with `docs/epic-analysis.md` (forward trace: Epic → PRs; reverse trace here: PR → Files / Impact / (Epic Links placeholder)).
3. Highlight schema & permission surface changes distinctly (future audit & migration safety).

### Inclusion Rules
Included: Added/removed/modified source files, config, workflows, migrations, schema definitions, seeds, hooks, access control, auth strategies, test harness infra. Excluded: Pure lockfile diffs (only summarized when materially tied to dependency category), formatting-only mass changes (batched note), generated artifacts.

### Tag Taxonomy (multi‑select per PR)
| Tag | Meaning |
|-----|---------|
| infra | CI/CD, environment, runtime orchestration, deployment workflows |
| deps | Dependency add/update/remove with functional impact |
| schema | Database / migration (table, enum, index, FK) addition/removal/change |
| content-model | Payload collection/global structural definition surfaced through migrations |
| auth | Authentication or access control logic elements |
| permissions | Role / access rule surfaces (access functions, scope filters) |
| seed | Data seeding scripts or baseline content loaders |
| refactor | Non‑functional structural reorganization / naming churn |
| naming-churn | Domain terminology shifts (tracked separately in appendix) |
| performance | Indexing, query optimization, resource efficiency changes |
| ops | Operational config (Docker, compose, environment wiring) distinct from CI |
| test-infra | Test harness, fixtures, configuration |

### Entry Template (applied below)
PR <number>: <concise title/purpose>
Date: (to be populated later if needed for temporal analytics)
Tags: comma-separated
Affected Areas:
  - Schema: (tables/enums/indexes) or (None)
  - Application Logic: (hooks/access/auth etc.) or (None)
  - Infrastructure / Tooling: (workflows/docker/etc.) or (None)
  - Frontend/UI: (blocks/components/pages) or (None)
Notable Files (grouped): bullet list of representative paths (not exhaustive when large).
Impact Assessment: Framed in terms of platform capabilities unlocked / risk surface introduced.
Linked Epics: placeholder until explicit mapping required (keep empty if not asserted).

---

## Chronological Entries

### PR #9: (Existing Entry – Leave As-Is)
Tags: infra, quality, deps, ops, refactor
Summary: Establishes initial CI/CD (deploy + lint workflows), introduces super-linter configuration, local developer quality gates (husky pre-commit + lint-staged), normalizes formatting across large migration artifacts, and aligns dependency/engine declarations.
Affected Areas:
  - Schema: None (structural migration content only reformatted; no substantive SQL/model delta inferred).
  - Application Logic: None.
  - Infrastructure / Tooling: Added GitHub Actions (`.github/workflows/deploy.yml`, `.github/workflows/linter.yml`), super-linter environment file, husky hook.
  - Frontend/UI: None.
Notable Files:
  - Workflows: `.github/workflows/deploy.yml`, `.github/workflows/linter.yml`
  - Tooling: `.github/super-linter.env`, `package.json` (scripts, dev deps, husky, lint-staged), `.editorconfig`
  - Ops: `docker-compose.yml` (indent / consistency normalization)
  - Formatting Refactors: `src/migrations/20250224_215508.(json|ts)` (whitespace/compression only)
Linked Epics: (pending)

---

### PR #184: CI Build — PostgreSQL Service + Migration Handling
Tags: infra, ops
Summary: Enhances deploy workflow to run with a PostgreSQL service available, and improves migration execution/reliability. Removes now-unneeded bits from `deploy-vercel.sh`.
Evidence (commit dc267ba feat: Update deployment workflow ... (#184)):
  - 3 files; 77 insertions / 55 deletions.
  - `.github/workflows/deploy.yml` substantial changes; minor `payload-types.ts` bump; removed 20 lines from `deploy-vercel.sh`.
Affected Areas: Infrastructure only; no schema/runtime logic.
Impact: More reliable CI builds with database context; safer migrations.
Linked Epics: (pending)

---

### PR #186: S3 Storage Type/Schema Mismatch Fix (Media)
Tags: schema, infra
Summary: Aligns `Media` collection configuration with S3 storage plugin expectations and database schema. Introduces a new migration (renamed pair) adjusting columns to match types.
Evidence (commit 9b433f2 Fix S3 storage plugin type and schema mismatch (#186)):
  - 4 files; 20 insertions / 5 deletions.
  - `src/collections/Media.ts` updated; migration rename `20250515_084912` → `20250521_143232` and index edit.
Affected Areas: Schema (yes), Infrastructure (storage plugin coherence).
Impact: Prevents runtime/type mismatches when persisting media via S3; low risk, targeted.
Linked Epics: (pending)

---

### PR #191: Dependabot PayloadCMS Pattern Adjustment
Tags: infra, deps-meta
Summary: Tweaks Dependabot config to adjust grouping/patterns for PayloadCMS updates.
Evidence: `.github/dependabot.yml` +1 LOC.
Impact: PR hygiene only; no runtime impact.
Linked Epics: (pending)

---

### PR #122: Update Dependabot Configuration & Ignore in Deploy Workflow
Tags: infra, quality
Summary: Refreshes `.github/dependabot.yml` schema, fixes duplicate settings and scope inclusion, and adjusts deploy workflow to ignore dependabot-only changes.
Evidence (commit 7eaf09f chore: updated dependabot schema (#122)):
  - 2 files; 32 insertions / 5 deletions in dependabot config; +1 LOC in deploy workflow.
Affected Areas: CI/dependency management ergonomics; no runtime impact.
Linked Epics: (pending)

---

### Excluded (Dependency-only) PR #124
Rationale: Group dependency bumps across many Payload packages and minor libs; no app or schema changes.
Evidence (commit 03b0275 chore(deps): bump dependencies group (#124)):
  - Lockfile and package.json churn only.
Disposition: Excluded (dependency-only).

---

### Excluded (Dependency-only) PR #125
Rationale: Dev dependency bumps for `@types/node` and `@types/react`.
Evidence (commit 823af6f build(deps-dev): bump dev-dependencies group (#125)).
Disposition: Excluded (dependency-only, dev-only).

---

### PR #126: CI/CD Workflow Refactor and Vercel Integration Improvements
Tags: infra, ops, quality, dx
Summary: Refactors deploy workflow, introduces `.github/scripts/deploy-vercel.sh`, switches to `vercel env pull` for environment variables, enhances preview deployments, adds telemetry disable, pins workflows in VS Code settings, and updates editor extension recommendations.
Evidence (commit 9b9cd17 build: refactor ci cd (#126)):
  - 4 files; 116 insertions / 88 deletions.
  - Adds deploy script; substantial edits to `.github/workflows/deploy.yml`.
Affected Areas:
  - Schema: None.
  - Application Logic: None.
  - Infrastructure / Tooling: Significant — CI pipeline and Vercel deploy flow.
  - Frontend/UI: None.
Notable Files: `.github/scripts/deploy-vercel.sh`, `.github/workflows/deploy.yml`, `.vscode/*`.
Impact Assessment: Streamlines deployment with clearer environment handling and preview behavior; improves reliability and developer guidance.
Linked Epics: (pending)

---

### Excluded (Dependency-only) PR #117
Rationale: Dependency version bump for `tailwind-merge` with only `package.json` and lockfile changes.
Evidence (commit 306bcd9 chore: bump tailwind-merge 2.6.0→3.2.0 (#117)):
  - 2 files; +6 / -6 LOC.
Disposition: Excluded (dependency-only).

---

### PR #118: Add Permissions to Deploy Workflow (Security Alert #4)
Tags: infra, quality, security
Summary: Adds explicit `permissions` to `.github/workflows/deploy.yml` to satisfy code scanning alert.
Evidence: 1 file; +2 LOC.
Impact: Security hardening with negligible risk.
Linked Epics: (pending)

---

### PR #119: Fix ESLint Warnings and Update Ignores
Tags: quality, infra (lint), refactor (minor)
Summary: Cleans up ESLint warnings, adjusts ignores (notably excluding migrations), and applies trivial refactors across several files.
Evidence: 10 files; 7 insertions / 24 deletions.
Affected Areas: None schema; minimal UI/logic edits for lint compliance.
Linked Epics: (pending)

---

### PR #120: Add Permissions to Deploy Workflow (Security Alert #3)
Tags: infra, quality, security
Summary: Adds explicit `permissions` to deploy workflow.
Evidence: 1 file; +2 LOC.
Linked Epics: (pending)

---

### PR #121: Add Permissions to Deploy Workflow (Security Alert #2)
Tags: infra, quality, security
Summary: Adds explicit `permissions` to deploy workflow.
Evidence: 1 file; +2 LOC.
Linked Epics: (pending)

---

### PRs #112, #113, #114, #116: No Repository Evidence
Status: No commit subjects in `main` reference these PR numbers (search over `(#112)`–`(#116)` returned only #115). Presumed unmerged/abandoned or squashed.
Linked Epics: (pending)

---

### Excluded (Dependency-only) PR #115
Rationale: Single-line Docker base image version bump (Node 22.14.0-alpine → 22.15.0-alpine) with no accompanying application, schema, or infra logic changes.
Evidence (commit db6b447 chore(deps): bump node ... (#115)):
  - 1 file (`Dockerfile`); +1 / -1 LOC.
Disposition: Excluded (dependency/runtime patch only).

---

### PRs #108, #111: No Repository Evidence
Status: No commit subjects in `main` reference these numbers. Presumed unmerged/abandoned/squashed. Logged for transparency.
Linked Epics: (pending)

---

### PR #107: Add Tags Collection & Cross-Entity Tag Relationships
Tags: schema, content-model, refactor
Summary: Introduces `Tags` collection; augments `Clinics`, `Posts`, and `Treatments` (and related entities) with tagging relationships. Migration (`20250503_192052`) replaces prior baseline (`20250429_210634`) via rename/edit pattern. Updates database reset docs and import map.
Evidence (commit 469b7d9 feat: Add Tags collection ... (#107)):
  - 12 files; 848 insertions / 365 deletions.
  - Added `src/collections/Tags.ts` (60 LOC) + relationships in multiple collections.
  - Migration rename & edits (450 JSON changes; 79 TS changes) + index update.
  - Payload types regenerated (558 insertions / deletions mix reflecting new Tag relations).
Affected Areas:
  - Schema: Yes — new collection + relation fields.
  - Application Logic: None (no access/auth changes).
  - Infrastructure / Tooling: None.
  - Frontend/UI: None.
Notable Files: `src/collections/Tags.ts`, migrations `20250503_192052.*`, updated collection files.
Impact Assessment: Adds tagging taxonomy enabling future content & clinic categorization; continues migration rewrite pattern (audit caution).
Linked Epics: (pending)

---

### PR #109: Organize Admin Groups for Collections & Plugins
Tags: content-model, quality, dx
Summary: Adjusts `admin.group` metadata across many collections to improve Payload CMS admin navigation; updates plugin admin grouping under "Settings" and rebrands plugin title generator to "findmydoc". Also fixes a typo by renaming the exported collection constant from `Accredition` to `Accreditation` (file name unchanged) and updates `payload.config.ts` imports accordingly. Pure configuration/editorial improvements without schema impact.
Evidence (commit 6d42875 Organize admin groups ... (#109)):
  - 16 files; 29 insertions / 4 deletions (metadata edits only).
Affected Areas:
  - Schema: None (field/group metadata only, no structural migration).
  - Application Logic: None.
  - Infrastructure / Tooling: None.
  - Frontend/UI: Admin UI configuration improvement (editorial UX).
Notable Files:
  - Collections: `src/collections/*` (Categories, Cities, Clinics, Countries, Doctors, Media, MedicalSpecialities, Pages, PlattformStaff, Posts, Reviews, Tags, Treatments) — added `admin.group`.
  - Accreditation export rename: `src/collections/Accredition.ts` (`export const Accredition` → `export const Accreditation`); `src/payload.config.ts` import updated accordingly.
  - Plugins: `src/plugins/index.ts` (set admin group to "Settings" for redirects/forms/search; title generator now "findmydoc").
Impact Assessment: Improves editorial usability and naming correctness; zero runtime risk.
Linked Epics: (pending)

---

### PRs #101, #102, #104: No Repository Evidence
Status: No commit subjects in `main` match these PR numbers; presumed unmerged/abandoned or squashed. Left as a grouped transparency note.
Linked Epics: (pending)

---

### Excluded (Dependency-only) PR #103
Rationale: Pure dependency/version updates and plugin reorder without schema, logic, or feature changes beyond config ordering.
Evidence (commit 8c86264 chore: Update dependencies and re-order plugins in config (#103)):
  - 3 files; 2,289 insertions / 2,200 deletions (lockfile + `package.json` churn, minor `postcss.config.js` edit).
Disposition: Excluded from detailed entry (tag: deps).

---

### PR #105: Add Explicit Permissions to Deploy Workflow (Security Hardening)
Tags: infra, quality, security
Summary: Adds explicit `permissions` stanza to `.github/workflows/deploy.yml` addressing code scanning alert recommending least-privilege specification.
Evidence (commit 983e87a Potential fix for code scanning alert no.5 (#105)):
  - 1 file; +2 LOC.
Affected Areas:
  - Schema: None.
  - Application Logic: None.
  - Infrastructure / Tooling: CI workflow security improvement.
  - Frontend/UI: None.
Notable File: `.github/workflows/deploy.yml`
Impact Assessment: Improves supply chain / workflow security posture with negligible operational risk.
Linked Epics: (pending)

---

### PRs #58–#62: No Repository Evidence
Status: No commit subjects in `main` reference these PR numbers. They are presumed unmerged, abandoned, or squashed into later PRs. Omitted from detailed logging pending future forensic evidence.
Linked Epics: (pending)

---

### PR #86: Remove Languages Collection & Enforce Required Language Fields
Tags: schema, content-model, refactor, seed
Summary: Deletes standalone `Languages` collection; moves language capture into required fields on `Clinics` and `Doctors`. Refactors selection options and updates seeding scripts to supply language data inline. Introduces new migration (`20250419_113738`) via rename from prior baseline `20250403_194203`, altering schema artifact lineage.
Evidence (commit a37e549 feat: Remove languages collection ... (#86)):
  - 13 files changed; 324 insertions / 504 deletions.
  - Removed `src/collections/Languages.ts` (64 LOC deleted).
  - Migration rename & edits: `20250403_194203.*` → `20250419_113738.*` (524 JSON modifications, 81 TS modifications) plus index update.
  - Added/modified required language fields in `Clinics.ts`, `Doctors.ts` (field diffs ~24 LOC combined) and selection options centralization.
  - Seed scripts updated to populate language arrays/fields.
Affected Areas:
  - Schema: Yes — removal of table/collection; migration rewrite with renaming.
  - Application Logic: None (no access/auth function changes).
  - Infrastructure / Tooling: None.
  - Frontend/UI: None.
  - Seeding: Adjusted to new inline language model.
Notable Files: `src/collections/Clinics.ts`, `src/collections/Doctors.ts`, `src/collections/Languages.ts` (deleted), `src/migrations/20250419_113738.*`, seed scripts under `src/endpoints/seed/clinics/*`.
Impact Assessment: Simplifies language model (denormalization) reducing join overhead at cost of losing centralized language catalog; migration rename again compresses historical trace.
Linked Epics: (pending)

---

### PR #89: Rename Procedures Collection to Treatments
Tags: naming-churn, schema, refactor, content-model
Summary: Renames `Procedures` to `Treatments` across collection file, imports, and migrations; updates payload types and fixes timestamp typo. Adds new migration pair `20250420_213625` (renamed from `20250419_194950`). Minor package/import map adjustments.
Evidence (commit 403aa58 Rename Procedures collection ... (#89)):
  - 9 files; 142 insertions / 220 deletions (net rename churn).
  - Deleted `src/collections/Procedures.ts`; added `src/collections/Treatments.ts` (44 LOC).
  - Migration rename / modifications (178 JSON changes, 42 TS changes) + index updates.
Affected Areas:
  - Schema: Yes — table/collection rename via migration rewrite.
  - Application Logic: None.
  - Infrastructure / Tooling: None.
  - Frontend/UI: None.
Notable Files: `src/collections/Treatments.ts`, migrations `20250420_213625.*`, `src/payload.config.ts` (import path update).
Impact Assessment: Terminology alignment; repeated migration rewriting increases audit complexity; no functional logic change.
Linked Epics: (pending)

---

### PR #90: Rename Staff to PlattformStaff & Adjust Fields
Tags: naming-churn, schema, refactor, auth
Summary: Renames `Staff` collection to `PlattformStaff` (spelling preserved from commit), updating access modules, collections referencing staff, seeds, and auth forms. Migration pair renamed `20250420_213625` → `20250421_234812` with additional field adjustments. Payload types and auth utilities updated accordingly.
Evidence (commit cc46574 chore: renamed collection staff to plattformStaff (#90)):
  - 17 files; 252 insertions / 286 deletions.
  - Collection file path change `{Staff => PlattformStaff}/index.ts` (72 modified lines) plus related import updates.
  - Migration rename and modifications (263 JSON changes; 66 TS changes) with index updates.
  - Adjusted `authenticated.ts`, `authenticatedAndAdmin.ts` for renamed collection references.
Affected Areas:
  - Schema: Yes — collection rename & possible field tweaks.
  - Application Logic: Minor — access control modules updated (logic stable, references changed).
  - Infrastructure / Tooling: None.
  - Frontend/UI: Minimal (AdminBar/Auth UI path adjustments).
Notable Files: `src/collections/PlattformStaff/index.ts`, migrations `20250421_234812.*`, access modules.
Impact Assessment: Further identity model term churn; risk of confusion with previous Staff naming; functional model stable otherwise.
Linked Epics: (pending)

---

### PR #92: Add Countries Collection & Related Schema Adjustments
Tags: schema, content-model, refactor, seed
Summary: Introduces `Countries` collection and integrates it with `Clinics` and `Accredition` (country field usage). Performs extensive migration consolidation by deleting large prior migration files (`20250421_234812` and new intermediate sets) and reconstituting baseline under `20250424_210117` after transient large migration artifacts are removed. Adjusts seed typing and selection removal in favor of text fields.
Evidence (commit 1ab8411 feat: add countries collection (#92)):
  - 14 files; 320 insertions / 22,314 deletions (massive deletion from removed migration JSON).
  - Added `src/collections/Countries.ts` (34 LOC).
  - Deleted large migration JSONs (`20250421_234812.json`, `20250424_193057.json`) and TS scripts; rewrote baseline to `20250424_210117.*` (124 JSON modifications, 90 TS additions).
  - Updated `Accredition.ts`, `Clinics.ts` to include country references/fields; seed typing adjusted.
Affected Areas:
  - Schema: Significant — new collection + migration reset.
  - Application Logic: None.
  - Infrastructure / Tooling: None.
  - Frontend/UI: None.
  - Seed: Adjusted to use countries.
Notable Files: `src/collections/Countries.ts`, migrations `20250424_210117.*`, removed large migrations, `src/endpoints/seed/types.ts`.
Impact Assessment: Adds geographic dimension; continued migration squashing erodes historical evolution fidelity; functional enrichment outweighs audit loss short-term.
Linked Epics: (pending)

---

### PR #93: Adapt Posts/Pages/Media to New Data Model & Content Enhancements
Tags: schema, content-model, refactor, infra, docs, seed, auth (minor)
Summary: Large model adaptation PR introducing updated migrations (`20250424_193057`, `20250424_193619`) with huge schema JSON additions, adding excerpt field to posts, extending platform staff attributes (firstName, lastName), updating pages integration plugins, refining deployment workflow (environment variable abstraction), and enriching documentation (features, setup). Adds multiple seed posts and updates environment examples.
Evidence (commit 0fdf059 feat: verifyadapt posts pages media collections ... (#93)):
  - 24 files; 22,865 insertions / 220 deletions (dominant migration JSON additions).
  - Two massive migration JSON/TS pairs added (`20250424_193057`, `20250424_193619`).
  - Posts collection updated (excerpt field); seeds updated to include excerpt.
  - Supabase strategy minor enhancement (+2 LOC) adding name fields to user provisioning.
  - Docs expansions: `README.md` rewrite sections, `docs/features.md`, `docs/setup.md`, updates to `docs/database-reset.md`.
  - Workflow tweak in `.github/workflows/deploy.yml` (11 changes) and environment variable consistency improvements.
Affected Areas:
  - Schema: Extensive — large new migration sets.
  - Application Logic: Minor — auth strategy field mapping.
  - Infrastructure / Tooling: Moderate — workflow & env adjustments.
  - Frontend/UI: Minimal (DeveloperDashboard small tweak).
  - Seed: Additional post seeds.
  - Documentation: Significant additions.
Notable Files: Migrations `20250424_193057.*`, `20250424_193619.*`, `src/collections/Posts/index.ts`, seeds `src/endpoints/seed/post-*.ts`, `src/auth/supabaseStrategy.ts`, docs files.
Impact Assessment: Broad content model expansion and documentation uplift; introduces large migration artifacts increasing repository weight; incremental auth enhancement improves user profile richness.
Linked Epics: (pending)

---

### PR #12: Initial Schema Bootstrap (Foundational Migration Introduction)
Tags: schema, content-model, performance
Summary: Adds the first full relational schema migration set registering core content model: pages, posts, media, categories (hierarchical), users (local auth scaffolding), redirects, forms + submissions, search index scaffolding, job queue tables, header/footer navigation, preferences, and comprehensive versioning tables with indices.
Affected Areas:
  - Schema: Extensive (tables, enums, FK constraints, ~hundreds of indexes). Migration `20250224_215508` introduced.
  - Application Logic: None (pure structural layer).
  - Infrastructure / Tooling: Migration index registration (`src/migrations/index.ts`).
  - Frontend/UI: None directly (enables future block/content rendering).
Notable Files:
  - Migrations: `src/migrations/20250224_215508.json`, `src/migrations/20250224_215508.ts`, `src/migrations/index.ts`
  - Enums: Multiple Payload/Postgres enum types for hero types, statuses, links, block variants, job tasks.
  - Tables: Content (pages, posts, media, categories, redirects, forms, form_submissions, search), Versioning (`_pages_v*`, `_posts_v*`), Queue (`payload_jobs*`), Preferences, Navigation (header/footer + rels), System (locked documents, migrations record).
Impact Assessment: Establishes minimum viable content persistence & version control backbone required for subsequent domain expansion (later clinical/medical entities). Rich indexing strategy suggests forward planning for query performance and editorial workflows.
Linked Epics: (pending)

---

### PR #13: (Duplicate / Re-introduction of Migration Artifacts) – Consolidation Pass
Tags: schema, content-model, performance, refactor
Summary: Adds the same foundational migration set (`20250224_215508`) plus migration index in a standalone PR context (likely sequencing / repository bootstrap ordering). Ensures schema objects (tables, enums, FKs, indexes) are present—mirrors PR #12 content.
Affected Areas:
  - Schema: Same structural footprint as PR #12 (no new entities beyond that set).
  - Application Logic: None.
  - Infrastructure / Tooling: Migration registry (`src/migrations/index.ts`).
Notable Files:
  - Migrations: `src/migrations/20250224_215508.ts`, `src/migrations/20250224_215508.json`, `src/migrations/index.ts`
Impact Assessment: Represents either chronological correction or branch merge alignment ensuring the canonical migration pair is committed. Risk: potential duplication history requiring vigilance against divergent edits; functionally idempotent given matching definitions.
Linked Epics: (pending)

---

### PR #14: Add pgAdmin Service & Database Configuration Adjustments
Tags: ops, infra
Summary: Introduces a pgAdmin management UI service alongside existing database container(s) by extending Docker Compose; adjusts database environment/configuration to facilitate local inspection and administrative workflows. No application schema or code logic modifications detected in current repository snapshot (entry constrained to infra artifacts).
Affected Areas:
  - Schema: None.
  - Infrastructure / Tooling: Docker Compose augmentation (pgAdmin service, related environment variables / ports), potential `.env` variable alignment (if present in PR diff; not observable post-merge beyond compose changes).
  - Frontend/UI: None.
Notable Files:
  - Ops: `docker-compose.yml` (service additions/updates), possibly `docker-compose.test.yml` if mirrored (not asserting absent modifications without diff visibility).
Impact Assessment: Enhances operational visibility into PostgreSQL through a browser-based admin console, reducing friction for manual data inspection and early debugging. Low production risk (dev-time tooling) but introduces need to manage credentials / network exposure in non-local contexts.
Linked Epics: (pending)

---

### PR #21: Remove Unused Template Artifacts & Switch to pnpm Lockfile
Tags: infra, ops, refactor, deps, quality
Summary: Cleans legacy template/UI scaffolding (removes obsolete `BeforeLogin` component and related import map entries), migrates project package manager artifacts from Yarn to pnpm (adds `pnpm-lock.yaml`, removes `yarn.lock`), introduces local environment bootstrap file (`.env.local`), refines `docker-compose.yml` (interactive flags), prunes / restructures README content and import map noise, and drops an unused before-login hook registration from `payload.config.ts`.
Affected Areas:
  - Schema: None (no collection or migration changes; `payload-types.ts` delta limited to empty `blocks: {}` structural placeholder—no functional schema difference).
  - Application Logic: Minor: removal of obsolete hook/component wiring (deleted `BeforeLogin` component and associated config reference in `payload.config.ts`).
  - Infrastructure / Tooling: Package manager transition (lockfile swap), Compose runtime tweak (adds `tty`, `stdin_open`), developer DX environment file `.env.local` introduced.
  - Frontend/UI: Removal of unused pre-auth layout component (`BeforeLogin`) and related import map entries—reduces build surface.
Notable Files:
  - Tooling/Ops: `pnpm-lock.yaml` (added), `yarn.lock` (removed), `docker-compose.yml`
  - Config: `payload.config.ts` (hook reference removal), `importMap.js` (pruned mappings)
  - UI Cleanup: `src/components/BeforeLogin/*` (removed)
  - Env: `.env.local` (added for local development defaults)
  - Docs: `README.md` (streamlined / reduced template prose)
Impact Assessment: Reduces unused code and cognitive load, standardizes dependency management to pnpm (performance & consistency benefits), and slightly simplifies admin boot sequence by removing a no-op pre-login wrapper. Low risk; primarily DX and cleanliness improvements.
Linked Epics: (pending)

---

### Excluded (Dependency-only) PRs 22–25
Rationale: Pure dependency version bumps (package.json / lockfile only) or closed without merge; per inclusion rules these are omitted from full ledger detail to avoid noise.
| PR | Status | Title (abridged) | Disposition |
|----|--------|------------------|-------------|
| 22 | merged | bump @payloadcms/* 3.25.0→3.27.0 cluster | Excluded (dependency-only)
| 23 | merged | bump payload-admin-bar 1.0.6→1.0.7 | Excluded (dependency-only)
| 24 | closed (unmerged) | bump @payloadcms/live-preview-react | Ignored (not merged)
| 25 | closed (unmerged) | bump @payloadcms/plugin-search | Ignored (not merged)

---
### Excluded (Dependency-only) PRs 26–28
Rationale: Pure dependency version bumps (single `package.json` + lockfile deltas) with no accompanying source, config, or schema changes.
| PR | Status | Title (abridged) | Disposition |
|----|--------|------------------|-------------|
| 26 | closed (unmerged) | bump @payloadcms/ui 3.25.0→3.27.0 | Ignored (dependency-only, not merged)
| 27 | closed (unmerged) | bump payload + prismjs versions batch | Ignored (dependency-only, not merged)
| 28 | merged | bump prismjs 1.29.0→1.30.0 | Excluded (dependency-only)

---

### PR #29: Bump Node Runtime & Align Deployment / Local Dev Tooling
Tags: infra, ops, quality
Summary: Upgrades Node runtime base images from 18/22.12.0 to 22.14.0 across Dockerfile and compose; introduces a dedicated `.dockerignore`; refines deploy workflow triggers (adds pull_request on `main`); expands `.gitignore` (ignores yarn.lock post-pnpm migration); performs minor README rendering consistency adjustments. No application logic or schema modifications.
Affected Areas:
  - Schema: None.
  - Application Logic: None.
  - Infrastructure / Tooling: Docker base image upgrade (`Dockerfile`), compose service image version bump (`docker-compose.yml`), new `.dockerignore`, CI workflow trigger refinement (`.github/workflows/deploy.yml`).
  - Frontend/UI: None.
Notable Files:
  - Runtime: `Dockerfile` (FROM node:22.12.0-alpine → 22.14.0-alpine)
  - Orchestration: `docker-compose.yml` (service image updated; commentary for local build path)
  - CI: `.github/workflows/deploy.yml` (pull_request trigger on main added)
  - Ignore/Context Control: `.dockerignore` (new), `.gitignore` (adds `yarn.lock`), `.dockerignore` improves build context size & cache efficiency
  - Docs: `README.md` (markdown list normalization)
Impact Assessment: Standardizes on a consistent, current Node 22.14.0 runtime enhancing alignment with ecosystem security patches & potential performance gains; adds CI coverage for PR validation prior to merge; reduces Docker build context (faster, leaner builds). Low risk—pure infra adjustments.
Linked Epics: (pending)

---

### Excluded (Tooling Sweep – Closed Unmerged) PR 30
Rationale: Large-scale formatting and tooling introduction (super-linter workflow, husky hook, lint-staged, widespread whitespace & quote style normalization, dependency version escalations, migration & generated type reformat) but PR was closed without merge—no persistent effect on mainline code; recorded here only for historical completeness.
| PR | Status | Title (abridged) | Disposition |
|----|--------|------------------|-------------|
| 30 | closed (unmerged) | Feature/add linter (super-linter + formatting sweep) | Ignored (unmerged)

---

### PR #31: Add GitHub Actions workflow for Vercel deployment
Tags: infra, ops, quality
Summary: Adds a consolidated CI & CD GitHub Actions workflow that installs dependencies with pnpm (store caching), runs migrations and tests against a PostgreSQL service (PostGIS image), builds the app, and deploys preview and production builds to Vercel. Adds `workflow_dispatch` for manual production deploys with an optional `reset_database` input.
Affected Areas:
  - Schema: None (workflow-only), but the build job runs migrations as a pre-step in CI.
  - Application Logic: None.
  - Infrastructure / Tooling: Yes — adds `.github/workflows/deploy.yml` implementing multi-job pipeline (ci, build, Deploy-Preview, Deploy-Production), pnpm caching, PostgreSQL service for migration/test run, and Vercel deploy steps.
  - Frontend/UI: None.
Notable Files:
  - `.github/workflows/deploy.yml` (new; multi-job CI & CD with DB service, pnpm cache, Vercel deploy steps)
Impact Assessment: Significant DX and ops improvement — brings reliable CI checks, local DB-backed migration verification, and automated Vercel deployments (preview + production). Operational risk is low but worth monitoring (secrets, Vercel token usage, DB service startup flakiness). Recommend monitoring first deploys and ensuring secrets (VERCEL_TOKEN, VERCEL_ORG_ID/PROJECT_ID, PAYLOAD_SECRET) are stored in repo secrets.
Linked Epics: (pending)

---

### Excluded (Dependency-only) PRs 32, 34, 35
Rationale: Pure dependency version bumps (package manager lockfile and/or `package.json` only) with no source, schema, config, or infra logic changes; consolidated to minimize ledger noise.
| PR | Status | Title (abridged) | Disposition |
|----|--------|------------------|-------------|
| 32 | merged | bump @payloadcms/* & lexical & @babel/runtime | Excluded (dependency-only)
| 34 | merged | bump react-hook-form 7.45.4→7.54.2 | Excluded (dependency-only)
| 35 | merged | bump autoprefixer ^10.4.20→^10.4.21 | Excluded (dependency-only)

---

---

### PR #33: Expand VS Code Recommended Extensions (DX Tooling)
Tags: infra, quality
Summary: Updates the workspace recommendations to include additional VS Code extensions (GitHub PR integration, React snippets, Next.js TypeScript support, etc.) improving contributor onboarding & consistency; no runtime or schema changes.
Affected Areas:
  - Schema: None.
  - Application Logic: None.
  - Infrastructure / Tooling: Developer environment curation via `.vscode/extensions.json` additions.
  - Frontend/UI: None.
Notable Files:
  - DX: `.vscode/extensions.json` (extended recommendations array)
Impact Assessment: Enhances standardized local development ergonomics (linting, PR review, framework snippets) without altering application behavior. Zero operational risk.
Linked Epics: (pending)

---


### Excluded (Dependency-only) PRs 36–37
Rationale: Pure dependency upgrades with no accompanying source, schema, or infra logic modifications beyond version bumps / lockfile changes.
| PR | Status | Title (abridged) | Disposition |
|----|--------|------------------|-------------|
| 36 | closed (unmerged) | bump @payloadcms/next 3.27.0→3.28.1 | Ignored (dependency-only, unmerged)
| 37 | merged | bump eslint 9.21.0→9.22.0 | Excluded (dependency-only)

---

### PR #38: Implement Authentication Forms (Login & Registration)
Tags: auth, frontend
Summary: Introduces UI components and related assets for user login and registration flows; modifies/creates form components, styling, and route-level integration scaffolding. No observable schema or backend access rule adjustments in this PR.
Affected Areas:
  - Schema: None.
  - Application Logic: None (no access control or auth strategy changes—UI layer only).
  - Infrastructure / Tooling: None.
  - Frontend/UI: Added/modified pages and form components for login & registration (15 files changed; +702 / -168 LOC) establishing initial auth interaction surface.
Notable Files (representative):
  - Pages/Routes: (login & registration related Next.js route files)
  - Components: Auth form components (inputs, submission handling UI)
  - Styles: Associated CSS/utility additions if present in diff
Impact Assessment: Establishes user-facing authentication entry points enabling future wiring to Supabase / Payload-backed identity flows. Purely presentational at this layer—no security model change by itself.
Linked Epics: (pending)

---

### PR #40: Clinics on Home Page + Integrated Login Section & Branding
Tags: frontend, content-model, auth
Summary: Large UI integration adding clinic listing/rendering to the home page alongside an embedded login section and branding (logo); substantial addition of components/assets (32 files, +11,945 / -715 LOC) consolidating prior sandbox/template work into mainline.
Affected Areas:
  - Schema: None (presentation of existing clinic data only; no collection changes in this diff set).
  - Application Logic: Minimal / none beyond UI data fetching or props wiring (no new hooks or access functions detected—classification reserved to UI layer).
  - Infrastructure / Tooling: None.
  - Frontend/UI: Extensive—home page layout, clinic cards/listing, shared logo/branding component, reused login UI from earlier auth work.
Notable Files (representative):
  - Pages: Home page layout modifications (app route) integrating clinics & auth section
  - Components: Clinic listing/card components, logo asset/component, shared layout updates
  - Assets: Image / SVG logo additions
Impact Assessment: Delivers first composite user-facing experience combining domain (clinics) visibility with authentication entry point—advances platform usability without altering backend model.
Linked Epics: (pending)
Linked Epics: (pending)

---

### PR #41: Group Dependency Bump (next 15.2.0→15.2.3, payload 3.28.1→3.29.0)
Tags: deps
Summary: Consolidated dependency upgrade for Next.js and Payload core (plus associated lockfile adjustments). No application, schema, or infra logic changes.
Affected Areas:
  - Schema: None.
  - Application Logic: None.
  - Infrastructure / Tooling: None (version bumps only).
  - Frontend/UI: None (framework internal updates only).
Notable Files:
  - `package.json` (version updates)
  - `pnpm-lock.yaml` (resolved dependency graph changes)
Impact Assessment: Internal runtime/library improvements only; no surface-level feature or behavior changes traced in repository code.
Linked Epics: (pending)

---

### PR #42: Add VSCode Extension Recommendations (Collaboration & Tailwind)
Tags: infra, quality
Summary: Extends `.vscode/extensions.json` recommendations adding GitHub PR review, Live Share, and Tailwind CSS IntelliSense extensions to standardize contributor tooling.
Affected Areas:
  - Schema: None.
  - Application Logic: None.
  - Infrastructure / Tooling: Developer environment metadata (editor hints) only.
  - Frontend/UI: None.
Notable Files:
  - `.vscode/extensions.json` (+GitHub.vscode-pull-request-github, +ms-vsliveshare.vsliveshare, +bradlc.vscode-tailwindcss)
Impact Assessment: Improves collaboration (PR reviews & Live Share) and UI dev productivity (Tailwind IntelliSense) with zero runtime risk.
Linked Epics: (pending)

---

### PRs #46, #47, #48, #50: No Repository Evidence
Status: No commits in current `main` branch history reference these PR numbers (searched commit subjects for `(#46)` `(#47)` `(#48)` `(#50)`).
Disposition: Cannot document—likely unmerged, squashed into later work, or abandoned before merge. Retained here as a transparency note; will be removed if future evidence (branch merges, tags) appears.
Impact: Not assessed (no diff available).
Linked Epics: (pending)

---

### PR #49: Add Clinic & Doctor Seed Data + Slug Routing & Developer Dashboard
Tags: schema, content-model, seed, auth, frontend, dx
Summary: Introduces structured seeding capability for clinics and doctors (factory & dataset files), adds slug fields to `Clinics` and `Doctors` collections, replaces name-based dynamic clinic route with slug-based `[slug]` page, implements a Developer Dashboard (with seeding UI) and removes legacy `BeforeDashboard` component. Adjusts Supabase auth strategy (role assignment fix) and updates environment example. Consolidates/renames initial migration (`20250330_201946` → `20250403_194203`) effectively rewriting baseline schema migration.
Evidence (commit 7e7ed9d feat: add clinic and doctors seed data (#49)):
  - 26 files changed; 612 insertions / 237 deletions.
  - Added seeding endpoints & helper modules under `src/endpoints/seed/**` (clinic & doctor factories, predefined datasets, helpers, types).
  - Added/modified `src/app/(frontend)/clinic/[slug]/page.tsx` (renamed from `[name]`).
  - Added slug fields to `src/collections/Clinics.ts` & `src/collections/Doctors.ts` (+2 LOC each) accompanied by migration + regenerated `payload-types.ts`.
  - Removed `src/components/BeforeDashboard/` and introduced `src/components/DeveloperDashboard/` including seeding button & styles.
  - Modified `src/auth/supabaseStrategy.ts` (role assignment correction—3 line change).
  - Migration baseline file pair renamed & edited: `20250330_201946.*` → `20250403_194203.*` (64 additions / minor edits) plus updates to `src/migrations/index.ts`.
Affected Areas:
  - Schema: Yes — addition of slug fields (clinics, doctors) and baseline migration rewrite (migration file rename & edits).
  - Application Logic: Minor — auth role assignment fix in Supabase strategy.
  - Infrastructure / Tooling: Minimal — import map tweak (`admin/importMap.js`) for dashboard component resolution.
  - Frontend/UI: Yes — slug-based clinic detail route; new Developer Dashboard UI; card component adjustments.
  - Seeding / Data Ops: New endpoints & factory/dataset pattern enabling repeatable local domain population.
Notable Files:
  - `src/endpoints/seed/clinics/clinic-doctor-seed.ts` (orchestrates combined seeding)
  - `src/endpoints/seed/clinics/clinic-factory.ts`, `doctor-factory.ts`
  - `src/endpoints/seed/plastic-surgery-clinics.ts`, `plastic-surgeons.ts`
  - `src/components/DeveloperDashboard/index.tsx`
  - `src/app/(frontend)/clinic/[slug]/page.tsx`
  - Migration: `src/migrations/20250403_194203.{json,ts}` (renamed from prior baseline)
  - `src/auth/supabaseStrategy.ts`
Impact Assessment: Establishes foundational developer seeding workflow and stable slug routing for clinic pages improving URL semantics & future SEO. Baseline migration rewrite may complicate historical migration traceability (note for future audit). Minor auth role fix increases correctness of user provisioning flow.
Linked Epics: (pending)

---

### PR #52: Admin (Staff) Collection Introduction & Supabase-Only Auth Consolidation
Tags: auth, schema, refactor, infra, quality, content-model
Summary: Overhauls authentication & user model by introducing a dedicated `Staff` collection and deprecating standalone `Users` collection usage for admin contexts. Refactors relationships to point to `Staff`, updates Supabase auth strategy (configurability + role handling), and consolidates migrations by removing earlier large migration files and rewriting baseline (`20250330_201946`). Adds supporting utilities (`getMeStaffUser`), adjusts access control modules, and restructures admin login route under `/admin/login`. Removes obsolete registration & social login components (shift to Supabase-only provisioning) and updates CI workflow plus database reset documentation.
Evidence (commit 16b28f0 feat: make admin user collection to get authentication and login only from supabase (#52)):
  - 35 files changed; 1,128 insertions / 20,221 deletions (large net deletion from migration squashing and removal of unused auth UI/components).
  - Added `src/collections/Staff/index.ts` (new admin user model) & removed heavy `Users` usage (file persists but repurposed/trimmed—64 deletions in summary lines).
  - Massive migration cleanup: deletion of `20250224_215508.json` (9,283 LOC) & `20250322_221350.json` (9,839 LOC) plus related TS migration scripts; consolidation into updated `20250330_201946.{json,ts}` (renamed & heavily modified, 293 changes & 719 changes respectively) and deletion of intermediate migration scripts (`20250322_221350.ts`, `20250328_144956.ts`).
  - Auth strategy: `src/auth/supabaseStrategy.ts` +64 LOC enhancement (configurable interface, role(s) normalization, staff integration).
  - Access control: Adjustments in `authenticated.ts`, `authenticatedAndAdmin.ts` (role/admin gating logic updated for staff model).
  - Frontend route restructure: `src/app/(frontend)/admin/login/page.tsx` (moved from generic login path) to reflect staff-only login surface; removed `RegisterForm.tsx` and social login buttons (Supabase-managed identity only).
  - Infrastructure / Workflow: `.github/workflows/deploy.yml` edited (22 changes) adding conditional database reset logic; `docs/database-reset.md` added (53 LOC) codifying reset procedure.
  - ESLint rule relaxation (explicit any) & dependency additions (`@supabase/ssr`, `react-icons`) in `package.json`.
  - Utilities added: `supabase/{client,server}.ts`, `getMeStaffUser.ts`; removed `getMeUser.ts` aligning naming & responsibility.
Affected Areas:
  - Schema: Yes — new `Staff` collection; relationship rewiring; migration baseline rewrite & deletion of earlier migrations.
  - Application Logic: Significant — auth strategy overhaul, access control updates, role normalization.
  - Infrastructure / Tooling: CI workflow enhancement (conditional reset), docs addition, ESLint config tweak.
  - Frontend/UI: Admin login path restructuring; removal of registration & social login UI (leaner surface).
  - Content Model: Consolidation around staff entity for administrative functions.
Notable Files:
  - `src/collections/Staff/index.ts`
  - `src/auth/supabaseStrategy.ts`
  - `src/app/(frontend)/admin/login/page.tsx`
  - `src/utilities/supabase/{client,server}.ts`
  - Migrations: removal of `20250224_215508.json`, `20250322_221350.json`; rewrite of `20250330_201946.{json,ts}`
  - `.github/workflows/deploy.yml`, `docs/database-reset.md`
Impact Assessment: Major architectural pivot centralizing admin identity under Staff collection and enforcing Supabase as sole auth provider; substantially reduces legacy migration noise improving future migration clarity (though historical audit trail is flattened). Enhances maintainability of auth logic and clarifies admin route structure. Large deletion count primarily migration churn, not feature regression.
Linked Epics: (pending)

---

### PR #57: Supabase Storage Integration for Media Assets
Tags: infra, ops, deps, content-model (light), dx
Summary: Configures platform to use Supabase Storage for media handling. Introduces storage configuration documentation, environment variables, plugin index adjustments, and updates import map. Large lockfile churn from dependency additions/updates related to storage client integration. No schema (tables/migrations) changes.
Evidence (commit 120bede feat: connect website to use supabase storage for media files (#57)):
  - 9 files changed; 987 insertions / 864 deletions (majority in `pnpm-lock.yaml`).
  - Added `docs/storage-configuration.md` (101 LOC) documenting setup.
  - `.env.example` +11 (new Supabase storage variables); minor tweak in `.env.local`.
  - `src/plugins/index.ts` modified (27 changes) to register/initialize storage plugin wiring.
  - `src/payload.config.ts` minor edits (5 changes) referencing plugin adjustments.
  - `package.json` 25 changes (dependency additions / scripts for storage integration).
Affected Areas:
  - Schema: None (no migrations touched).
  - Application Logic: Minimal — plugin initialization only (no new hooks/validators observed).
  - Infrastructure / Tooling: Yes — environment var expansion, plugin configuration, documentation.
  - Frontend/UI: None.
  - Operations: Storage configuration enabling remote asset persistence.
Notable Files:
  - `docs/storage-configuration.md`
  - `.env.example`
  - `src/plugins/index.ts`
  - `src/payload.config.ts`
Impact Assessment: Enables externalized media storage via Supabase, reducing local filesystem coupling and preparing for scalable asset delivery. Low application risk; primary complexity in environment correctness.
Linked Epics: (pending)

---

Tags: ops (tbd), infra (tbd)
Summary: Draft PR—no merged impact yet. Placeholder maintained to track pending local Supabase orchestration work.
Affected Areas:
Tags: schema (tbd), content-model (tbd), refactor (tbd)
Summary: Placeholder entry. Removes standalone languages collection; introduces required language fields on doctors & clinics. Need to confirm migration adjustments.
Affected Areas:
  - Schema: (tbd)
  - Application Logic: (tbd)
  - Infrastructure / Tooling: (tbd)
  - Frontend/UI: (tbd)
Notable Files: (tbd)
Impact Assessment: (tbd)
Linked Epics: (pending)

---

### PR #88: Rename Treatments to Medical Specialties
Tags: naming-churn, schema, refactor, content-model
Summary: Replaces legacy `treatments` taxonomy with `medical-specialties` across collections, relations, migrations, and generated types. Adds a new `MedicalSpecialities.ts` collection (name, optional description, icon, self-parent) and rewires existing relations in `Clinics` and `Procedures` to target the new slug. Regenerates the baseline migration pair (`20250419_194950`) to rename tables/indexes/FKs from `treatments*` to `medical_specialties*` and updates the migration index accordingly.
Affected Areas:
  - Schema: Yes — new table `medical_specialties` (columns: name, description?, icon_id, parent_specialty_id, timestamps); drop/replace `treatments` artifacts; updates to rel tables/indexes and FKs: `clinics_rels.medical_specialties_id`, `procedures_rels.medical_specialties_id`, `payload_locked_documents_rels.medical_specialties_id`.
  - Application Logic: None (no hooks/access changes observed).
  - Infrastructure / Tooling: Migration registry update; admin import map small cleanup.
  - Frontend/UI: None.
Notable Files:
  - Collections: `src/collections/MedicalSpecialities.ts` (new), `src/collections/Clinics.ts` (assignedTreatments → offeredMedicalSpecialties, relationTo rewrite), `src/collections/Procedures.ts` (treatments → medicalSpecialties)
  - Migrations: `src/migrations/20250419_194950.(json|ts)` (renamed from `20250419_113738.*`, with wide renames from treatments → medical_specialties), `src/migrations/index.ts`
  - Types: `src/payload-types.ts` (introduces MedicalSpecialty interfaces; updates union relation keys)
  - Admin: `src/app/(payload)/admin/importMap.js` (minor removal)
Impact Assessment: Terminology-alignment refactor increasing expressiveness (icon/parent taxonomy). Broad migration rename requires careful data migration if prior `treatments` rows existed. No runtime logic change; improves future taxonomy modeling.
Linked Epics: (pending)

---

### PR #89: Rename Procedures collection to Treatments and update imports
Tags: naming-churn, schema, refactor, migrations
Summary: Renames the legacy `procedures` collection to `treatments`, replaces the `Procedures` collection file with a new `Treatments` collection, and updates imports, generated types, and the migrations registry to point at the regenerated migration. The change includes a migration rename/squash that rewrites table names, index names and foreign keys from `procedures*` to `treatments*`.
Evidence (merge commit 403aa58c feat: rename procedures -> treatments (#89)):
  - State: merged (merged_at: 2025-04-20T22:19:14Z) by `SebastianSchuetze`
  - Stats: 9 changed files; +142 / -220 (additions / deletions)
  - Commits: 6
  - PR: https://github.com/findmydoc-platform/website/pull/89

Affected Areas:
  - Schema: Yes — collection rename + migration regeneration that renames `procedures` → `treatments` and updates FK/index names. (High impact for persisted data lineage.)
  - Application Logic: Minimal — collection config & payload integration (slug, fields) updated; no new hooks or access-rule changes observed.
  - Infrastructure / Tooling: Yes — `src/migrations/*` rename and `src/migrations/index.ts` updated; `package.json` CI script tweak (migrate/reset command switch + new generate script added).
  - Frontend/UI: Minimal — admin import map updated to include DeveloperDashboard import reference; routed pages unaffected in this PR.

Notable Files (representative list from PR diff):
  - `package.json` (ci script tweak + new `generateFromScratch` script)
  - `src/app/(payload)/admin/importMap.js` (added DeveloperDashboard import mapping)
  - `src/collections/Procedures.ts` (removed)
  - `src/collections/Treatments.ts` (added — new collection with fields: name, description (richText/jsonb), medicalSpecialty relation, tags, averagePrice)
  - `src/migrations/20250420_213625.{json,ts}` (regenerated/renamed migration containing wide renames from procedures->treatments)
  - `src/migrations/index.ts` (now references `20250420_213625`)
  - `src/payload-types.ts` (types renamed: Procedure → Treatment and related select/type updates)
  - `src/payload.config.ts` (imports updated: `Treatments` replaces `Procedures`)

Impact Assessment: The PR is a terminology & schema-level rename that improves domain clarity (Treatments over Procedures) and extends the Treatment model (richText description, medicalSpecialty relation, tags, averagePrice). Because it rewrites migration artifacts and renames tables/indexes/FKs, it's high-risk for existing production data — confirm that either a safe migration path was applied to live DBs or a data backfill/transform script exists. Functionally, the platform continues to operate with the new collection name; admin integrations were updated accordingly.

Linked Epics: (pending)

---

### PR #90: chore: renamed collection staff to plattformStaff
Tags: naming-churn, auth, schema, migrations, refactor
Summary: Renames the admin `staff` collection to `plattformStaff` and updates all references across collections, access helpers, seed scripts, generated types, payload config, and migrations. The migration set was regenerated/renamed (`20250421_234812`) to reflect the collection and FK/index renames. The PR also tightens the auth collection wiring (disables local strategy in favor of Supabase strategy for the new `plattformStaff` collection) and adjusts seed/demo data to use the new collection slug.
Evidence (merge commit cc46574 chore: renamed collection staff to plattformStaff (#90)):
  - State: merged (merged_at: 2025-04-22T19:06:03Z) by `SebastianSchuetze`
  - Stats: 17 changed files; +252 / -286
  - Commits: 3
  - PR: https://github.com/findmydoc-platform/website/pull/90

Affected Areas:
  - Schema: Yes — collection rename + regenerated migration `20250421_234812.*` that renames `staff` → `plattform_staff` table, related FK columns (e.g., `staff_id` → `plattform_staff_id`), and index names. This is a schema-level rename impacting persisted references.
  - Application Logic: Yes — access helpers updated (`src/access/authenticated.ts`, `authenticatedAndAdmin.ts`), hooks/population logic updated to reference `plattformStaff` and `firstName/lastName` fields, and the new collection adds admin config & Supabase auth strategy wiring in `src/collections/PlattformStaff/index.ts`.
  - Infrastructure / Tooling: Yes — `src/migrations/index.ts` updated to the new migration name; `package.json` and seed endpoints updated to create/delete `plattformStaff` demo users.
  - Frontend/UI: Several admin-facing strings and components updated (login UI title, AdminBar authCollection, DeveloperDashboard wiring) to reflect the new collection name and user shape.

Notable Files (representative list from PR diff):
  - `src/collections/Staff/index.ts` → `src/collections/PlattformStaff/index.ts` (renamed + adjusted fields: firstName, lastName, role, profileImage, supabaseId; auth strategies configured)
  - `src/access/authenticated.ts`, `src/access/authenticatedAndAdmin.ts` (types & signatures updated to `PlattformStaff`)
  - `src/payload-types.ts` (renamed type interfaces: `Staff` → `PlattformStaff`, auth ops, selects and related references updated)
  - `src/payload.config.ts` (exports/imports replaced `Staff` → `PlattformStaff`; `user` collection set to `plattformStaff`)
  - `src/endpoints/seed/index.ts`, `src/endpoints/seed/post-1.ts` (seed scripts updated to use `plattformStaff` collection and `firstName`/`lastName` fields)
  - `src/migrations/20250421_234812.{json,ts}` (regenerated migration reflecting renames and enum replacement)
  - `src/components/Auth/Admin/AuthForm.tsx`, `src/components/AdminBar/index.tsx` (UI copy/prop updates to reflect `Plattform Staff` and new authCollection)

Impact Assessment: This change consolidates admin user modeling under a clearer name and enriches the admin profile (first/last name, role enum, profile image, supabaseId). Because migrations were rewritten and table/column names changed, this is high-impact for existing deployments — ensure data migration or backfill scripts were applied when promoting to environments with existing data. The change also simplifies auth wiring by enforcing Supabase strategy for admin users and updating access helper typings across the codebase.

Linked Epics: (pending)

---

### PR #92: feat: add countries collection
Tags: schema, content-model, seed, migrations, refactor
Summary: Adds a new `countries` collection (domain model + admin config), wires it into the Payload config and generated types, updates seed types & example clinic seed data to use typed country values, and consolidates/renames migration artifacts to register the `countries` table and related FK/index entries. The PR also included a number of migration file removals/renames and an update to the migration index so the consolidated migration pair (`20250424_210117`) becomes the canonical migration entry.
Affected Areas:
  - Schema: Adds `countries` table/collection + indexes (columns: id, name, iso_code, language, currency, timestamps). Migration artifacts were regenerated/renamed and several large intermediate migration JSON files were removed in favor of the consolidated `20250424_210117` pair.
  - Application Logic: Generated types updated (`src/payload-types.ts`) to include a `Country` interface and `CountriesSelect` shape; small collection admin metadata tweaks (`Accredition`, `Clinics`) to include `admin.description` for `country` fields.
  - Infrastructure / Tooling: `src/migrations/index.ts` updated to reference `20250424_210117` (removing older migration references). Migration file churn (removals/renames) is large and may affect auditability/history.
  - Frontend/UI: Indirect — seed data and seed endpoint types updated; no route or user-facing pages were added in this PR.
Notable Files:
  - `src/collections/Countries.ts` (added — new collection configuration exposing `name`, `isoCode`, `language`, `currency` and admin defaults)
  - `src/payload-types.ts` (modified — introduces `Country` interface and `CountriesSelect` types; updates `Clinic` / `Accreditation` types to reference country)
  - `src/payload.config.ts` (modified — imports & registers `Countries` collection)
  - `src/migrations/20250424_210117.{json,ts}` (consolidated/renamed migration now referenced by `src/migrations/index.ts`)
  - `src/migrations/20250421_234812.json`, `src/migrations/20250424_193057.json` (removed / superseded as part of consolidation)
  - `src/migrations/index.ts` (modified — now points to `20250424_210117`)
  - `src/endpoints/seed/types.ts` (modified — adds `Countries` union type and updates `ClinicData.country` shape)
  - `src/endpoints/seed/plastic-surgery-clinics.ts` (modified — seed entries switched to typed country values)
  - `src/collections/Accredition.ts`, `src/collections/Clinics.ts` (small `admin.description`/field-name fixes)
Impact Assessment: Merges a new canonical `countries` domain table and updates payload types and seeds. Because the PR also consolidated and removed several large migration artifacts (and replaced the migration index entry), this is medium→high risk for any environment with existing production data—the migration history was rewritten/reshuffled. Actions recommended before promoting to production: verify the migration order in each environment, confirm any data backfills or transforms are applied, and ensure seeds are idempotent for the new `countries` table. The change is otherwise straightforward: it improves modeling (typed country relationships) and prepares the codebase for future geo/locale work.
Evidence & Stats:
  - State: merged (merged_at: 2025-04-24T21:32:02Z) by `SebastianSchuetze`
  - PR: https://github.com/findmydoc-platform/website/pull/92
  - Commits: 9 • Changed files: 14 • +320 / -22,314 (additions / deletions)
Linked Epics: (pending)

---

### PR #93: feat: verifyadapt posts pages media collections to new data model
Tags: schema, content-model, migrations, seed, infra
Summary: A consolidation and verification pass that adapts `posts`, `pages`, and media-related collections to the regenerated data model. Adds missing fields (excerpt) to posts, breadcrumbs/parent support for pages, updates seed posts with excerpts, aligns the `PlattformStaff` collection admin labels, adjusts Supabase strategy defaults for first/last name, and makes several repo-wide housekeeping updates (repo name, env defaults, pnpm version pinning in CI). The PR also adds a set of migration artifacts (`20250424_193057`, `20250424_193619`) and wires them into the migrations index.
Affected Areas:
  - Schema: Adds `excerpt` to `posts`, `parent` and `breadcrumbs` support to `pages` (via generated types and migrations). New migrations were added (`20250424_193057`, `20250424_193619`) and the migrations index was updated to include them alongside existing migrations.
  - Application Logic: `src/auth/supabaseStrategy.ts` sets placeholder `firstName`/`lastName` values for JIT provisioning; `PlattformStaff` admin labels added for clarity; plugin config (`src/plugins/index.ts`) updated to include pages in nested docs generation and a label generator.
  - Infrastructure / Tooling: Repo-wide renames and environment defaults updated (`package.json` name → `findmydoc-portal`, `.env.example` / `.env.local` DATABASE_URI updated, `docker-compose.yml` DB name updated); CI workflow (`.github/workflows/deploy.yml`) parameterized to use `PNPM_VERSION` and packageManager pin bumped to `pnpm@10.9.0`.
  - Frontend/UI: DeveloperDashboard link updated; seed post files (`src/endpoints/seed/post-1.ts`, `post-2.ts`, `post-3.ts`) now include `excerpt` fields to populate the new `posts.excerpt` column for seeded content; `Posts` collection now defines `excerpt` in the admin fields.
Notable Files:
  - `src/migrations/20250424_193057.{json,ts}` (added — creates breadcrumbs, excerpt fields, parent relations, indexes)
  - `src/migrations/20250424_193619.{json,ts}` (added — placeholder migration pair added to index)
  - `src/migrations/index.ts` (modified — now registers the new migration files)
  - `src/collections/Posts/index.ts` (modified — adds `excerpt` field and admin layout tweaks)
  - `src/payload-types.ts` (modified — adds `excerpt`, `parent`, `breadcrumbs` to `Post`/`Page` types and selects)
  - `src/endpoints/seed/post-1.ts`, `post-2.ts`, `post-3.ts` (modified — seed posts now include `excerpt` values)
  - `src/collections/PlattformStaff/index.ts` (modified — label additions for admin UX)
  - `src/auth/supabaseStrategy.ts` (modified — sets default first/last name fields on JIT user creation)
  - `.env.example`, `.env.local`, `docker-compose.yml`, `package.json`, `.github/workflows/deploy.yml` (repo / infra housekeeping updates)
Impact Assessment: This PR is primarily a compatibility & verification pass that brings seeded content and generated types in line with recent schema regeneration. The addition of migrations is moderate risk but appears additive (adding new columns and tables used for UX features like breadcrumbs and excerpts). Repo housekeeping (name changes, pnpm pinning, DB name updates) lowers friction for contributors but requires environment variable adjustments in CI and local setups. Recommended follow-ups: run migrations in a test/staging environment to confirm the `excerpt` and breadcrumb parent columns are applied as intended and verify seed idempotency.
Evidence & Stats:
  - State: merged (merged_at: 2025-04-24T20:16:40Z) by `SebastianSchuetze`
  - PR: https://github.com/findmydoc-platform/website/pull/93
  - Commits: 11 • Changed files: 24 • +22,865 / -220 (additions / deletions)
Linked Epics: (pending)

---

### PR #94: Introduce Cities Collection & PostGIS Enablement
Tags: schema, content-model, ops, infra, performance
Summary: Adds geographic domain support by introducing a `cities` collection (name, airportcode, coordinates point, country relationship) with a new migration. Enables spatial data types by switching the Postgres image to `postgis/postgis` and adding a cities table plus geometry(Point) column & indexes. Updates `payload.config.ts` integration, generated types, migration registry, and augments tooling/scripts (package.json generate/migrate script adjustments, Vercel preview script). Adds developer guidance artifacts (`.vscode/settings.json`, commit prompt ignore file).
Affected Areas:
  - Schema: New table `cities` (columns: name, airportcode, coordinates geometry(Point), country FK), related indexes + FK; migration `20250425_080939` added; PostGIS capability implicitly required via Docker image change.
  - Application Logic: None (no hooks or access logic changes observed).
  - Infrastructure / Tooling: `docker-compose.yml` Postgres image swap to PostGIS variant; new `POSTGIS_ENABLED` env flag; package.json script edits; editor settings and prompt file additions.
  - Frontend/UI: None directly (no components/pages changed in this PR snapshot).
Notable Files:
  - Collection: `src/collections/Cities.ts`
  - Migrations: `src/migrations/20250425_080939.(json|ts)`, `src/migrations/index.ts`
  - Types: `src/payload-types.ts` (City & Country interfaces extended/added)
  - Ops: `docker-compose.yml` (image change to `postgis/postgis:latest`)
  - Tooling: `package.json` (script adjustments), `.vscode/settings.json`, `.github/prompts/filesToIgnore.prompt.md`
Impact Assessment: Establishes a foundational geo reference layer enabling relational linkage (e.g., clinics → city) and future spatial queries (distance, bounding box). PostGIS adoption expands query capability but increases local container image size and potential migration complexity. Low immediate application risk; schema introduces new FK surface requiring future access control considerations.
Linked Epics: (pending)

---

### PR #95: Clinic Domain Restructure, Status Workflow & Seed System Modularization
Tags: schema, content-model, seed, refactor, performance, naming-churn
Summary: Major refactor of the clinics model: replaces flat address/contact fields with grouped `address` (street, houseNumber, zipCode, city relationship to new `cities`, country default, coordinates point) and `contact` (phoneNumber, email, website), removes legacy fields (foundingYear, active, assignedDoctors/users, offeredMedicalSpecialties), adds `status` enum (draft→approved lifecycle), `averageRating`, `tags`, and description rich text. Regenerates migration (superseding prior `20250426_102002` with `20250429_210634`) introducing new enum `enum_clinics_status`, new tables (`clinics_texts`), altered `clinics_rels` (reduced relation columns), indexes, FKs (city FK). Refactors seeding: splits posts seeding into `posts-seed.ts`, adds countries & cities seeding (`countries-cities-seed.ts`), globals seeding (`globals-seed.ts`), clinic & doctor seeding updated to use new address/city relations and status. Frontend pages/components updated to consume new nested structure and dynamic doctor fetch; utility `getMediaUrl` added.
Affected Areas:
  - Schema: Replacement migration `20250429_210634` (clinics table reshape, added enum `enum_clinics_status`, point coordinates, city FK, removal of previous relationship columns, new `clinics_texts` table, indexes on `address_city_id`, texts ordering). Deprecates prior clinic structural columns (founding_year, active, city, street, zip_code, contact_phone) in favor of grouped/renamed variants.
  - Application Logic: None (no access/auth hook alterations), though data fetching in frontend adjusted for new structure.
  - Infrastructure / Tooling: None beyond migration index update.
  - Frontend/UI: Updated clinic detail page (`/app/(frontend)/clinic/[slug]/page.tsx`) to query doctors separately and use nested address/contact; `ClinicCard` adjusted; new media utility for safe URL extraction.
  - Seeding: New modular seed architecture (countries, cities, globals, posts) plus updated clinic/doctor seeding aligning to new schema & status workflow.
Notable Files:
  - Collection: `src/collections/Clinics.ts` (extensive field restructuring)
  - Migrations: `src/migrations/20250429_210634.(json|ts)` (renamed from prior), `src/migrations/index.ts`
  - Seeds: `src/endpoints/seed/clinics/clinic-doctor-seed.ts`, `.../clinics/clinics.ts` (renamed), `.../clinics/doctors.ts` (renamed), `.../locations/countries-cities-seed.ts`, `.../globals/globals-seed.ts`, `.../posts/posts-seed.ts`, `seed/index.ts` refactor, removal of `doctor-factory.ts`
  - Frontend: `src/app/(frontend)/clinic/[slug]/page.tsx`, `src/components/ClinicCard.tsx`
  - Types: `src/payload-types.ts` (clinic interface overhaul; city & country positioning changes)
  - Utility: `src/utilities/getMediaUrl.ts`
Impact Assessment: Introduces a more normalized and extensible clinical location model (city FK + coordinates) enabling future geo queries and approval workflows (status enum). Migration carries moderate risk (broad column drops / renames) requiring data backfill/migration scripts if prior data existed. Seed restructuring improves maintainability and domain clarity. Performance potential via new indexes (city, texts ordering) and removal of unused relationship indices.
Linked Epics: (pending)

---

### PR #96: Accreditation Rich Text & Icon Support + Migration Consolidation
Tags: schema, content-model, refactor, performance
Summary: Enhances `accreditation` collection by converting `description` from plain text to richText (jsonb) and introducing optional `icon` upload relation (with index + FK). Consolidates migrations by removing two earlier migration sets (`20250424_210117`, `20250425_080939`) in favor of a regenerated `20250426_102002` that now also embeds cities table creation and accreditation changes. Updates docker compose to bump pnpm version; minor doc environment variable casing fix.
Affected Areas:
  - Schema: Regenerated migration `20250426_102002` (adds cities table (if not previously live in this branch context), adds `accreditation.icon_id` column + index + FK, changes `accreditation.description` column type varchar → jsonb, adds related indexes and locked documents relation column `cities_id`). Removal of prior migration files simplifies lineage but obscures granular historical diff (risk: auditability gap for intermediate states).
  - Application Logic: None.
  - Infrastructure / Tooling: `docker-compose.yml` pnpm minor upgrade (10.7.0 → 10.9.0).
  - Frontend/UI: None.
Notable Files:
  - Collection: `src/collections/Accredition.ts` (richText + icon upload field additions)
  - Migrations: Removed `20250424_210117.*`, `20250425_080939.*`; updated `20250426_102002.(json|ts)`; `src/migrations/index.ts` now references only consolidated migration.
  - Types: `src/payload-types.ts` (Accreditation interface updated for rich text + icon)
  - Ops: `docker-compose.yml` (pnpm version bump)
  - Docs: `docs/database-reset.md` (env var case correction)
Impact Assessment: Improves content expressiveness (rich text) and branding (icon) for accreditations; consolidation reduces migration file sprawl but loses granular historical replay clarity—potential compliance/audit concern if prior states were deployed. Data migration risk for existing varchar descriptions (implicit transform required). Minor DX improvement via pnpm update.
Linked Epics: (pending)

---

### PR #98: Increment @payloadcms/next Dependency (Minor Feature/Compat Bump)
Tags: deps
Summary: Bumps `@payloadcms/next` from 3.29.0 → 3.36.0; large associated lockfile churn reflects transitive updates. No source, schema, or config file changes.
Affected Areas:
  - Schema: None.
  - Application Logic: None.
  - Infrastructure / Tooling: None.
  - Frontend/UI: Indirect (potential runtime improvements via library update) – not code-modified here.
Notable Files:
  - Dependencies: `package.json` (`@payloadcms/next`), `pnpm-lock.yaml`
Impact Assessment: Aligns project with newer Payload Next integration module; possible bug fixes or performance improvements upstream. Low risk; ensure matching core payload packages stay version-compatible in future.
Linked Epics: (pending)

---

### PR #99: TailwindCSS Major Version Upgrade (v3 → v4)
Tags: deps, performance, quality
Summary: Upgrades `tailwindcss` from ^3.4.17 to ^4.1.5 with lockfile pruning of v3-specific transitive utilities (config loaders, sucrase, etc.). No immediate style or config file modifications in this PR snapshot.
Affected Areas:
  - Schema: None.
  - Application Logic: None.
  - Infrastructure / Tooling: Build-time CSS pipeline semantics potentially altered (Tailwind v4). No config updates shown, implying defaults or pending follow-on adjustments.
  - Frontend/UI: Potential at-runtime CSS class output differences (needs regression verification).
Notable Files:
  - Dependencies: `package.json` (tailwindcss), `pnpm-lock.yaml` (removal of many v3-era packages, addition of v4 graph)
Impact Assessment: Major CSS framework upgrade can subtly affect generated classes or purging behavior; requires audit of custom utilities & design tokens. Risk medium if unaccompanied by validation, though no direct code edits included.
Linked Epics: (pending)

---

### PR #100: Increment @payloadcms/ui Dependency
Tags: deps
Summary: Updates `@payloadcms/ui` from 3.29.0 → 3.36.0 with corresponding lockfile adjustments. No application code changes.
Affected Areas:
  - Schema: None.
  - Application Logic: None.
  - Infrastructure / Tooling: None.
  - Frontend/UI: Possible admin UI enhancements/bug fixes via upstream package.
Notable Files:
  - Dependencies: `package.json` (`@payloadcms/ui`), `pnpm-lock.yaml`
Impact Assessment: Low-risk incremental upgrade aligned with earlier `@payloadcms/next` bump (PR #98) but staggered; watch for version skew across payload peer packages until unified.
Linked Epics: (pending)

---

### Excluded (Dependency-only / Not merged) PR #101
Rationale: Automated dependency update by Dependabot, closed without merge; excluded per policy.
| PR | Status | Title (abridged) | Disposition |
|----|--------|------------------|-------------|
| 101 | closed (unmerged) | build(deps): bump @radix-ui/react-select 2.1.6→2.2.2 | Ignored (dependency-only, not merged) |

---

### Excluded (Dependency-only / Not merged) PR #102
Rationale: Dependabot dependency update for react-dom and @types/react-dom, closed without merge; excluded per policy.
| PR | Status | Title (abridged) | Disposition |
|----|--------|------------------|-------------|
| 102 | closed (unmerged) | build(deps): bump react-dom and @types/react-dom | Ignored (dependency-only, not merged) |

---

### PR #103: Update dependencies and adjust plugin order in configuration
Tags: deps, infra, quality, plugins
Summary: Upgrades a set of dependencies to newer versions and reorders the Payload plugin registration in the configuration to ensure correct initialization sequence.
Affected Areas:
  - Schema: None.
  - Application Logic: None.
  - Infrastructure / Tooling: Yes — dependency bumps and plugin registration order in Payload configuration.
  - Frontend/UI: None.
Notable Files:
  - Dependencies: package.json, pnpm-lock.yaml
  - Config: Payload configuration (plugins registration order)
Impact Assessment: Low risk for runtime; plugin order can influence hook/field registration and side-effect timing. Recommend a quick smoke test of plugin-backed features (media storage, redirects, forms, nested docs, SEO, search, import/export) after deploy.
Linked Epics: (pending)

---

### PR #105: Add explicit permissions to Deploy workflow (code scanning alert #5)
Tags: infra, quality, security
Summary: Adds a minimal `permissions` block to the Deploy workflow to comply with GitHub code scanning recommendation (principle of least privilege). Grants `contents: read` to the Deploy-Preview job; no write scopes.
Affected Areas:
  - Schema: None.
  - Application Logic: None.
  - Infrastructure / Tooling: Yes — CI workflow security hardening.
  - Frontend/UI: None.
Notable Files:
  - `.github/workflows/deploy.yml` (+2 LOC)
Impact Assessment: Improves supply chain security posture with negligible operational risk; aligns with subsequent workflow hardening PRs.
Linked Epics: (pending)

---

### PR #106: Doctors data model enhancements (names, qualifications, metrics) + seeds/migration
Tags: schema, content-model, seed, refactor, frontend, infra
Summary: Enhances `Doctors` collection with `firstName` and `lastName` and a `beforeValidate` hook to auto-generate read-only `fullName`. Replaces `specialization` with multi-select `qualifications`; adds `biography` (rich text), `experienceYears`, and `rating`. Updates seeds to populate new fields; adjusts migration to add new columns, drop `specialization`/`active`, update `title` enum, and introduce `doctors_texts` table. Also bumps pnpm 10.9.0 → 10.10.0 and updates the clinic page UI to show `qualifications`.
Affected Areas:
  - Schema: Yes — new columns (`first_name`, `last_name`, `biography`, `experience_years`, `rating`), removal of legacy fields (`specialization`, `active`), `title` enum updates, new `doctors_texts` table.
  - Application Logic: Yes — `beforeValidate` hook generating `fullName`; `fullName` admin read-only.
  - Infrastructure / Tooling: Minor — pnpm version bump in compose and package.json.
  - Frontend/UI: Clinic page now renders `qualifications` for doctors instead of `specialization`.
Notable Files:
  - Collection: `src/collections/Doctors.ts` (fields + beforeValidate fullName)
  - Seeds/Types: `src/endpoints/seed/**` updates for `firstName`, `lastName`, `qualifications`, `experienceYears`, `rating`
  - Migrations: updated migration JSON/TS (adds columns, removes `specialization`/`active`, updates `title` enum, adds `doctors_texts`)
  - Ops: `docker-compose.yml` (pnpm 10.10.0), `package.json` (pnpm script/tooling bump)
  - Frontend: `src/app/(frontend)/clinic/[slug]/page.tsx` (swap specialization → qualifications)
Impact Assessment: Improves expressiveness and data quality for doctor profiles; minimal risk—migration alters several columns and adds a new texts table. Seed updates keep local data coherent; small infra bump is low risk.
Linked Epics: (pending)

---

### Excluded (Dependency-only / Not merged) PR #110
Rationale: Dependabot dependency bump for `@payloadcms/db-postgres` 3.36.0 → 3.36.1; closed without merge and touches only `package.json`/lockfile.
| PR | Status | Title (abridged) | Disposition |
|----|--------|------------------|-------------|
| 110 | closed (unmerged) | build(deps): bump @payloadcms/db-postgres 3.36.0→3.36.1 | Ignored (dependency-only, not merged) |

---

### Excluded (Dependency-only / Not merged) PR #111
Rationale: Dependabot bump for `@payloadcms/ui` 3.36.0 → 3.36.1; closed without merge and only modifies dependency files.
| PR | Status | Title (abridged) | Disposition |
|----|--------|------------------|-------------|
| 111 | closed (unmerged) | build(deps): bump @payloadcms/ui 3.36.0→3.36.1 | Ignored (dependency-only, not merged) |

---

### Excluded (Dependency-only / Not merged) PR #112
Rationale: Dependabot bump for `zod` 3.24.3 → 3.24.4; closed without merge and touches only dependency files.
| PR | Status | Title (abridged) | Disposition |
|----|--------|------------------|-------------|
| 112 | closed (unmerged) | build(deps): bump zod 3.24.3→3.24.4 | Ignored (dependency-only, not merged) |

---

### Excluded (Dependency-only / Not merged) PR #113
Rationale: Dependabot dev-dependency bump for `tailwindcss` 3.4.17 → 4.1.5; closed without merge.
| PR | Status | Title (abridged) | Disposition |
|----|--------|------------------|-------------|
| 113 | closed (unmerged) | build(deps-dev): bump tailwindcss 3.4.17→4.1.5 | Ignored (dependency-only, not merged) |

---

### Excluded (Dependency-only / Not merged) PR #114
Rationale: Dependabot dependency bump for `@payloadcms/plugin-form-builder` 3.36.0 → 3.36.1; closed without merge and touches only dependency files.
| PR | Status | Title (abridged) | Disposition |
|----|--------|------------------|-------------|
| 114 | closed (unmerged) | build(deps): bump @payloadcms/plugin-form-builder 3.36.0→3.36.1 | Ignored (dependency-only, not merged) |

---

### Excluded (Dependency-only) PR #115
Rationale: Single-line Docker base image version bump (Node 22.14.0-alpine → 22.15.0-alpine) with no accompanying application, schema, or infra logic changes.
Evidence (commit db6b447 chore(deps): bump node ... (#115)):
  - 1 file (`Dockerfile`); +1 / -1 LOC.
Disposition: Excluded (dependency/runtime patch only).
Linked Epics: (pending)

---

### PR #116: No Repository Evidence (presumed unmerged)
Tags: (tbd)
Summary: No commit subjects or merge metadata in `main` reference PR #116. A workspace-wide search across commit messages and PR annotations for `(#112)`–`(#116)` found only PR #115; PR #116 appears unmerged, abandoned, or squashed into other commits.
Evidence:
  - See earlier aggregated note: "PRs #112, #113, #114, #116: No Repository Evidence" in this document (search over `(#112)`–`(#116)` returned only #115).
Disposition: No repository evidence — marked as presumed unmerged/abandoned. Leave placeholder for future follow-up if the user wants to link an external PR URL or manual review of GitHub history.
Linked Epics: (pending)

---

### Excluded (Dependency-only) PR #117
Rationale: Dependency version bump for `tailwind-merge` with only `package.json` and lockfile changes.
Evidence (commit 306bcd9 chore: bump tailwind-merge 2.6.0→3.2.0 (#117)):
  - 2 files; +6 / -6 LOC.
Disposition: Excluded (dependency-only).
Linked Epics: (pending)

---

### PR #118: Add Permissions to Deploy Workflow (Security Alert #4)
Tags: infra, quality, security
Summary: Adds explicit `permissions` to `.github/workflows/deploy.yml` to satisfy code scanning alert.
Evidence: 1 file; +2 LOC.
Impact: Security hardening with negligible risk.
Linked Epics: (pending)

---

### PR #119 (placeholder): ESLint Warning Remediation & Config Ignore Adjustment
Tags: quality (tbd), refactor (tbd)
Summary: Placeholder entry. Resolves accumulated ESLint warnings and updates lint configuration to ignore `migrations` directory (to confirm rule changes). Pending enumeration of touched source files vs purely stylistic edits.
Affected Areas:
  - Schema: (tbd)
  - Application Logic: (tbd)  <!-- if only formatting, may remain None -->
  - Infrastructure / Tooling: (tbd)  <!-- ESLint config / overrides -->
  - Frontend/UI: (tbd)
Notable Files: (tbd)
Impact Assessment: (tbd)  <!-- lowers noise in CI, may hide issues in ignored path—needs risk note after diff -->
Linked Epics: (pending)

---

### PR #120 (placeholder): CI Workflow Permissions Hardening (Test Job)
Tags: infra (tbd), quality (tbd)
Summary: Placeholder entry. Mirrors PR #118 by adding minimal `permissions` block to the test workflow to address a separate code scanning alert. Awaiting diff extraction.
Affected Areas:
  - Schema: (tbd)
  - Application Logic: (tbd)
  - Infrastructure / Tooling: (tbd)  <!-- `.github/workflows/*` test pipeline modification -->
  - Frontend/UI: (tbd)
Notable Files: (tbd)
Impact Assessment: (tbd)
Linked Epics: (pending)

---

### PR #121 (placeholder): CI Workflow Permissions Hardening (Lint/Test Aggregate)
Tags: infra (tbd), quality (tbd)
Summary: Placeholder entry. Adds repository-level minimal `permissions: contents: read` at workflow root to satisfy remaining code scanning alert (#2) applying least-privilege across all jobs (extends pattern from PRs #118 and #120).
Affected Areas:
  - Schema: (tbd)
  - Application Logic: (tbd)
  - Infrastructure / Tooling: (tbd)  <!-- expect root-level permissions added in a workflow file -->
  - Frontend/UI: (tbd)
Notable Files: (tbd)
Impact Assessment: (tbd)  <!-- reduces GITHUB_TOKEN scope; cumulative security hardening -->
Linked Epics: (pending)

---

### PR #122: Dependabot Configuration Schema Update
Tags: infra, quality, deps (meta)
Summary: Updates Dependabot configuration to group PayloadCMS packages separately, split dev vs prod dependency groups, include scoped commit messages, add GitHub Actions ecosystem updates, and ensure the deploy workflow ignores Dependabot config changes in path filters.
Affected Areas:
  - Schema: None.
  - Application Logic: None.
  - Infrastructure / Tooling: Yes — Dependabot config and CI path ignore.
  - Frontend/UI: None.
Notable Files:
  - `.github/dependabot.yml` (+31/−5): add payloadcms/dev/prod groups; commit message prefixes; actions ecosystem section; PR limit tweaks.
  - `.github/workflows/deploy.yml` (+1): ignore Dependabot config in workflow trigger.
Impact Assessment: Improves update hygiene and PR signal by grouping and scoping dependency bumps; reduces unnecessary CI runs on config-only changes. Minimal operational risk.
Linked Epics: (pending)

---

### Excluded (Dependency-only) PRs 123–125
Rationale: Automated dependency updates with no source/schema/infra logic beyond version bumps; excluded per policy. One PR was closed unmerged (ignored).
| PR | Status | Title (abridged) | Disposition |
|----|--------|------------------|-------------|
| 123 | closed (unmerged) | bump @types/react 19.1.2→19.1.3 (dev-dependencies) | Ignored (not merged) |
| 124 | merged | bump dependencies group across 1 directory (22 updates) | Excluded (dependency-only) |
| 125 | merged | bump dev-dependencies group (2 updates) | Excluded (dependency-only) |

---

### PR #126: CI/CD Refactor and Vercel Deploy Script
Tags: infra, ops, quality, dx
Summary: Restructures CI into distinct jobs (CI, Build, Deploy Preview/Production), adds caching and telemetry disable, archives build artifacts, and introduces a reusable Vercel deploy shell script. Enhances DX by pinning workflows in VSCode and recommending GitHub extensions.
Affected Areas:
  - Schema: None.
  - Application Logic: None.
  - Infrastructure / Tooling: Yes — major workflow refactor; new deploy script; Vercel build/deploy flow; VSCode settings.
  - Frontend/UI: None.
Notable Files:
  - `.github/workflows/deploy.yml` (±175): rename to "CI & CD"; add push/tag triggers; defaults.run.shell; split jobs (ci/build/deploy-preview/deploy-production); cache pnpm store; archive artifacts; restructure Vercel steps; stricter migration check.
  - `.github/scripts/deploy-vercel.sh` (+20): wraps `vercel deploy --prebuilt` to output deployment URL and surface errors.
  - `.vscode/extensions.json` (+5/−1): add Copilot, Copilot Chat, PR review, and Actions extensions.
  - `.vscode/settings.json` (+2/−1): pin the deploy workflow in GitHub Actions view.
Impact Assessment: Improves pipeline reliability, speeds builds via caching, standardizes Vercel deployments, and streamlines contributor UX. Low risk to runtime; meaningful CI/CD behavior changes warrant brief monitor after merge.
Linked Epics: (pending)

---

### PR #168: Implement DoctorTreatments Collection with Composite Unique Index
Tags: schema, content-model, performance
Summary: Adds `DoctorTreatments` association collection (doctor ↔ treatment) to capture a doctor's specialization level per treatment and an optional counter of treatments performed. Registers reciprocal join fields on `Doctors` and `Treatments` for admin-side browsing. Introduces enum `enum_doctortreatments_specialization_level` and a composite unique index (doctor_id, treatment_id). Regenerates migrations and updates generated types and payload config.
Affected Areas:
  - Schema: Yes — new table `doctortreatments` (doctor_id, treatment_id, specialization_level enum, treatments_performed?, timestamps), unique index `doctor_treatment_idx`, FKs to `doctors` and `treatments`, plus locked_documents rel column + index.
  - Application Logic: None (no hooks/access changes in diff).
  - Infrastructure / Tooling: Migration + index update, types regen; config registration.
  - Frontend/UI: Admin join views via `join` fields; no frontend components changed in diff.
Notable Files:
  - Collections: `src/collections/DoctorTreatments.ts` (new), `src/collections/Doctors.ts` (+join field), `src/collections/Treatments.ts` (+join field)
  - Migrations: `src/migrations/20250511_204232.(json|ts)` with enum + table + FKs + unique index; `src/migrations/index.ts` updated
  - Types/Config: `src/payload-types.ts` (adds Doctortreatment interfaces and joins), `src/payload.config.ts` (register collection)
Impact Assessment: Enables precise modeling of doctor expertise per treatment with integrity guarantees (unique pairing). Low migration risk; ensure seed/backfill strategy to avoid duplicate pairs.
Linked Epics: (pending)

---

### PR #166: ClinicTreatments join (clinic ↔ treatment) with price, seeding/logging tweaks
Tags: schema, content-model, performance, seed, infra
Summary: Introduces `ClinicTreatments` association collection linking a clinic to a treatment with a price. Adds reciprocal admin `join` fields on `Clinics` and `Treatments` for management. Regenerates migrations (new `clinictreatments` table, indices, FKs) and updates payload types/config. Improves seeding flows: clearer logging, city reference by id, ordered deletion with logs; updates deploy workflow to not hard‑fail when migrations change; minor package script tweaks.
Affected Areas:
  - Schema: Yes — new table `clinictreatments` (price numeric, clinic_id, treatment_id, timestamps), indexes on clinic_id/treatment_id/created_at/updated_at and unique composite index `clinic_treatment_idx`; FKs to `clinics` and `treatments`; locked_documents rel column + index; migrations index updated.
  - Application Logic: None (no hooks/access changes observed).
  - Infrastructure / Tooling: `.github/workflows/deploy.yml` migration‑change check relaxed (does not exit 1), `package.json` scripts adjusted (`generateDBFromScratch`, `vercel:preview` target fix).
  - Frontend/UI: None.
  - Seed: `seed/index.ts`, `clinics/clinic-doctor-seed.ts`, `locations/countries-cities-seed.ts`, `types.ts` updated for ids/logging order.
Notable Files:
  - Collections: `src/collections/ClinicTreatments.ts` (new; plus later unique index), `src/collections/Clinics.ts` (+join field), `src/collections/Treatments.ts` (+join field)
  - Migrations: `src/migrations/20250510_193909.(json|ts)` (adds table/indexes/FKs), later amended by `20250511_204232.*` for unique index
  - Types/Config: `src/payload-types.ts` (Clinictreatment interfaces/joins), `src/payload.config.ts` (register collection)
  - Infra: `.github/workflows/deploy.yml`, `package.json`
  - Seeds: `src/endpoints/seed/{index.ts, clinics/clinic-doctor-seed.ts, locations/countries-cities-seed.ts, types.ts}`
Impact Assessment: Establishes price‑aware clinic offerings enabling future pricing UI/search. Unique index prevents duplicates; minor CI behavior change reduces false failures on migration churn. Seeding improvements aid reliability.
Linked Epics: (pending)

---

### Excluded (Dependency-only / Not merged) PRs 169–170
Rationale: Automated dependency groups closed unmerged; no source/schema impact.
| PR | Status | Title (abridged) | Disposition |
|----|--------|------------------|-------------|
| 169 | closed (unmerged) | bump dev-dependencies group | Ignored (dependency-only, not merged) |
| 170 | closed (unmerged) | bump dependencies group | Ignored (dependency-only, not merged) |

---

### PR #173: Introduce DoctorSpecialties Collection & Bidirectional Joins
Tags: schema, content-model, integrity
Summary: Adds `DoctorSpecialties` collection modeling doctor ↔ medical specialty relationships with `specializationLevel` enum and `certifications` list; updates `Doctors` to include a `specialties` join and `MedicalSpecialities` to include `doctorLinks`. Introduces enum and composite uniqueness to prevent duplicate doctor–specialty pairs.
Affected Areas:
  - Schema: Yes — new tables `doctorspecialties` and `doctorspecialties_certifications`; enum `enum_doctorspecialties_specialization_level`; unique constraint on (doctor_id, medical_specialty_id); FKs and indexes registered via migration `20250512_203445` and migration index update.
  - Application Logic: None (no hooks or access rule changes in diff).
  - Infrastructure / Tooling: Migration and generated types updated; `payload.config.ts` registers the new collection.
  - Frontend/UI: Admin-side join views enabled via `join` fields; no frontend route/components changed here.
Notable Files:
  - Collections: `src/collections/DoctorSpecialties.ts` (new), `src/collections/Doctors.ts` (+specialties join), `src/collections/MedicalSpecialities.ts` (+doctorLinks join)
  - Migrations: `src/migrations/20250512_203445.(json|ts)`, `src/migrations/index.ts`
  - Types/Config: `src/payload-types.ts`, `src/payload.config.ts`
  - Minor: `src/collections/Media.ts` (comment cleanup)
Impact Assessment: Improves clinical taxonomy expressiveness and data integrity (unique pair). Harmonizes with earlier doctor/treatment join while separating specialty taxonomy from per‑treatment expertise. Low migration risk; ensure seed/backfill for existing doctor–specialty associations if any.
Linked Epics: (pending)

---



### Excluded (Dependency-only) PRs 171–172
Rationale: Automated dependency update PRs that only modify dependency files (no source/schema/tooling logic). Per policy, merged dependency-only PRs are excluded from detailed logging.
| PR | Status | Title (abridged) | Disposition |
|----|--------|------------------|-------------|
| 171 | merged | build(deps-dev): bump dev-dependencies group (3 updates) | Excluded (dependency-only) |
| 172 | merged | chore(deps): bump dependencies group (lucide-react, react-hook-form) | Excluded (dependency-only) |

---

### PR #174: Enhance doctor name generation with title support; update GitHub issue settings
Tags: content-model, admin-ux, dx
Summary: Extends doctor full name generation to include `title` (e.g., Dr., Prof.) and hides the `fullName` field in the admin (derived field). Also adds VS Code GitHub Issues/PRs settings for branch naming and assignment preferences.
Affected Areas:
  - Schema: None (no migrations).
  - Application Logic: Yes — `Doctors` collection `beforeValidate` hook composes `fullName` from `title`, `firstName`, `lastName`; introduces utility to standardize capitalization.
  - Infrastructure / Tooling: Developer settings in `.vscode/settings.json` for GitHub integrations.
  - Frontend/UI: Admin UX improvement by hiding computed `fullName`.
Notable Files:
  - `src/collections/Doctors.ts` (hide fullName; generate with title in beforeValidate)
  - `src/utilities/nameUtils.ts` (generateFullName(title, firstName, lastName))
  - `.vscode/settings.json` (issue/pr workflow settings)
Impact Assessment: Improves data quality and editorial experience; low risk. Ensures consistent full name formatting without manual edits.
Linked Epics: (pending)

---

### PR #175: Enhance slug generation with unique constraint and refined admin behavior
Tags: content-model, admin-ux
Summary: Refactors slug field utilities to optionally enforce uniqueness and improves the admin slug component behavior: only set slug when empty and source present; clear when source clears. Simplifies slug field API to accept a source field and an `ensureUnique` boolean.
Affected Areas:
  - Schema: None (uniqueness is enforced at field config/runtime via hook + unique flag; no new DB constraint here).
  - Application Logic: Yes — `formatSlug` hook now accepts `{ ensureUnique? }`, respects `slugLock`, derives from source, and can query to avoid duplicates with capped attempts.
  - Infrastructure / Tooling: None.
  - Frontend/UI: Admin slug component updates improve UX and prevent accidental overrides.
Notable Files:
  - Fields: `src/fields/slug/formatSlug.ts` (refactor with ensureUnique and MAX_ITERATIONS), `src/fields/slug/index.ts` (new API `(fieldToUse?: string, ensureUnique?: boolean)`), `src/fields/slug/SlugComponent.tsx` (set/clear behavior)
  - Collections: `src/collections/Tags.ts` (use slugField('name', true) for unique), `src/collections/Clinics.ts` (minor cleanup around slug field)
Impact Assessment: Improves SEO hygiene and editorial safety; low risk with meaningful usability gains. Ensure future collections enabling slugs adopt the new API consistently.
Linked Epics: (pending)

---

### PR #176: Reviews collection, average ratings hooks, and medical specialties seeding
Tags: schema, content-model, seed, admin-ux, permissions
Summary: Introduces and hardens the patient Reviews model with access control, duplicate-prevention validation, audit trail, and lifecycle hooks to recalculate average ratings on related entities. Enhances Medical Specialties admin columns and adds idempotent seeding units for specialties and reviews.
Affected Areas:
  - Schema: Yes — reviews table with status enum and indices for relations (see migrations referencing reviews); collection uses soft delete (`trash: true`).
  - Application Logic: Yes — access rules (patients create, platform staff moderate), beforeValidate duplicate guard (patient+clinic+doctor+treatment), beforeChange audit stamping, afterChange/afterDelete hooks to recompute average ratings on Clinics, Doctors, and Treatments.
  - Infrastructure / Tooling: None.
  - Frontend/UI: Admin UX only — default columns and grouping for Reviews; Medical Specialties admin default columns refined.
Notable Files:
  - `src/collections/Reviews.ts` (access rules, fields, audit, hooks; soft delete)
  - `src/hooks/calculations/updateAverageRatings.ts` (average ratings recomputation on review change/delete)
  - `src/endpoints/seed/reviews/{reviews-data.ts,reviews-seed.ts}` (seed unit for reviews)
  - `src/endpoints/seed/medical/medical-specialties-seed.ts` (idempotent hierarchical specialties seeding)
  - `src/collections/MedicalSpecialities.ts` (admin defaults/joins for specialties)
Impact Assessment: Establishes end-to-end reviews with integrity and moderation, enabling quality signals via derived averages across key entities. Low-to-moderate migration risk depending on existing data; hooks guarded against loops via context flags.
Linked Epics: (pending)

---

### PR #177: Allow manual runs for deploy workflow (workflow_dispatch)
Tags: infra, ops
Summary: Enables manual triggering of the deploy pipeline with an input to optionally reset the database prior to migrations; formalizes production deploy gating on manual runs from main.
Affected Areas:
  - Schema: None.
  - Application Logic: None.
  - Infrastructure / Tooling: Yes — adds `workflow_dispatch` with `reset_database` input; production job conditional updated to check `workflow_dispatch` on main.
  - Frontend/UI: None.
Notable Files:
  - `.github/workflows/deploy.yml` (adds `workflow_dispatch` + inputs, codifies prod deploy conditions)
Impact Assessment: Improves operational control allowing on-demand deployments and safer DB resets during controlled runs. Low risk to application behavior.
Linked Epics: (pending)

---

### PR #184: Update deployment workflow with PostgreSQL service and improved migration handling
Tags: infra, ops, ci
Summary: Enhances CI by adding a PostgreSQL service to the build job, running migrations before build/tests, and refining deployment script usage for Vercel. Improves reliability of schema-dependent checks and integration tests.
Affected Areas:
  - Schema: None (execution of migrations only).
  - Application Logic: None.
  - Infrastructure / Tooling: Yes — `.github/workflows/deploy.yml` adds `services.postgres` and explicit migration step; `.github/scripts/deploy-vercel.sh` updated; `src/payload-types.ts` regenerated.
  - Frontend/UI: None.
Notable Files:
  - `.github/workflows/deploy.yml`
  - `.github/scripts/deploy-vercel.sh`
  - `src/payload-types.ts`
Impact Assessment: Stabilizes build/test pipeline by ensuring a live DB with migrations; low risk, CI-only change.
Linked Epics: (pending)

---

### PR #186: Fix S3 storage plugin type/schema mismatch
Tags: schema, infra, content-model
Summary: Aligns Media collection/schema with S3 storage plugin expectations; introduces a migration to adjust media schema and updates migration index. Ensures correct typing and prefix handling for external storage.
Affected Areas:
  - Schema: Yes — migration `20250521_143232` adjusts media schema; migration index updated.
  - Application Logic: None.
  - Infrastructure / Tooling: Storage plugin coherence (S3) via config/schema alignment.
  - Frontend/UI: None.
Notable Files:
  - `src/collections/Media.ts`
  - `src/migrations/20250521_143232.(json|ts)`, `src/migrations/index.ts`
Impact Assessment: Fixes storage integration inconsistencies; low risk if migration tested; impacts file upload behavior paths.
Linked Epics: (pending)

---

### PR #191: Adjust Dependabot update pattern for PayloadCMS
Tags: infra, quality, deps (meta)
Summary: Tweaks Dependabot configuration to adjust grouping or update patterns for PayloadCMS packages, improving the signal/noise and cadence of dependency PRs.
Affected Areas:
  - Schema: None.
  - Application Logic: None.
  - Infrastructure / Tooling: Yes — `.github/dependabot.yml` updated.
  - Frontend/UI: None.
Notable Files:
  - `.github/dependabot.yml`
Impact Assessment: Improves dependency management hygiene; no runtime impact.
Linked Epics: (pending)

---

### PR #195: Implement multi-user authentication architecture
Tags: auth, schema, frontend, seed, infra
Summary: Introduces a comprehensive multi-user auth model with Patients, Clinic Staff, and Platform Staff. Adds authentication routes (login/register/logout), Supabase strategy utilities, access helpers, and corresponding collections with a migration. Updates seeding to support the new model and wires basic admin/frontend pages.
Affected Areas:
  - Schema: Yes — new/updated collections (`BasicUsers`, `Patients`, `ClinicStaff`, `PlattformStaff`), migration `20250616_211706.*`, and migration index.
  - Application Logic: Yes — Supabase auth strategy and utilities (handlers for login/registration, first-admin check), access control helpers updated.
  - Infrastructure / Tooling: Env var additions in `.env.example`; package.json scripts adjusted.
  - Frontend/UI: New pages and forms for admin login/logout/first-admin, patient login/register, and clinic/patient registration flows; shared base components.
  - Seed: Seeding orchestrator and clinic seed adapted.
Notable Files:
  - `src/collections/{BasicUsers.ts, Patients.ts, ClinicStaff.ts, PlattformStaff/**/*.ts}`
  - `src/auth/strategies/supabaseStrategy.ts`, `src/auth/utilities/*` (handlers and supabase clients)
  - API Routes: `src/app/api/auth/*`
  - Pages: `src/app/(frontend)/admin/*`, `src/app/(frontend)/login/patient/page.tsx`, `src/app/(frontend)/register/*`
  - Migrations: `src/migrations/20250616_211706.(json|ts)`, `src/migrations/index.ts`, `src/payload.config.ts`
  - Seed: `src/endpoints/seed/{index.ts, clinics/clinics.ts, types.ts}`
  - Docs: `docs/authentication-system.md`, `docs/setup.md`
Impact Assessment: Major platform capability—role-specific auth and user flows. Medium risk: touches schema, access, and multiple routes; ensure migration is applied per checklist and Supabase env vars are configured.
Linked Epics: (pending)

---

### PR #207: Add PR title conventional commit checker
Tags: infra, quality, ci
Summary: Introduces a CI workflow to enforce Conventional Commits-style PR titles for improved consistency and automated tooling compatibility.
Affected Areas:
  - Schema: None.
  - Application Logic: None.
  - Infrastructure / Tooling: Yes — adds `.github/workflows/pr-title.yml`.
  - Frontend/UI: None.
Notable Files:
  - `.github/workflows/pr-title.yml`
Impact Assessment: Improves PR hygiene and release automation readiness; zero runtime risk.
Linked Epics: (pending)

---

### PR #179: Platform-Wide Payload Package Suite Upgrade (3.37.0 → 3.38.0)
Tags: deps
Summary: Bulk version bump of core Payload ecosystem packages (`db-postgres`, `next`, `payload-cloud`, `plugin-*`, `richtext-lexical`, `ui`) from 3.37.0 to 3.38.0. Lockfile indicates broad transitive refresh. No source changes beyond dependency set.
Affected Areas:
  - Schema: None (no migrations present here).
  - Application Logic: None local; upstream behavior may shift.
  - Infrastructure / Tooling: None.
  - Frontend/UI: Admin & runtime improvements possible via upstream updates.
Notable Files:
  - Dependencies: `package.json` (suite of Payload packages), `pnpm-lock.yaml`
Impact Assessment: Consolidates ecosystem version alignment reducing mismatch risk. Should be validated for breaking changes in release notes (not inferred here). Low to moderate operational risk depending on upstream change scope.
Linked Epics: (pending)

---

### PR #180: Dev Dependency Patch Bumps (@tailwindcss/postcss & TypeScript Types)
Tags: deps, quality
Summary: Incremental dev dependency updates: `@tailwindcss/postcss` 4.1.6 → 4.1.7; type packages `@types/node` 22.15.17 → 22.15.19, `@types/react` 19.1.3 → 19.1.4, `@types/react-dom` 19.1.4 → 19.1.5. Lockfile churn only.
Affected Areas:
  - Schema: None.
  - Application Logic: None.
  - Infrastructure / Tooling: Build/typing pipeline improved via updated type definitions.
  - Frontend/UI: Type safety refinements only.
Notable Files:
  - Dev Dependencies: `package.json` (type packages, tailwindcss postcss integration), `pnpm-lock.yaml`
Impact Assessment: Low-risk patch updates likely addressing typings accuracy and minor plugin fixes; negligible runtime impact.
Linked Epics: (pending)

---

### PR #184: See detailed entry above
This placeholder was removed — a full, sourced entry for PR #184 already exists earlier in this document (search for "PR #184: Update deployment workflow").
Linked Epics: (pending)

---

### PR #186 (placeholder): (tbd)
Tags: (tbd)
Summary: (tbd)
Affected Areas:
  - Schema: (tbd)
  - Application Logic: (tbd)
  - Infrastructure / Tooling: (tbd)
  - Frontend/UI: (tbd)
Notable Files: (tbd)
Impact Assessment: (tbd)
Linked Epics: (pending)

---

### PR #187 (placeholder): (tbd)
Tags: (tbd)
Summary: (tbd)
Affected Areas:
  - Schema: (tbd)
  - Application Logic: (tbd)
  - Infrastructure / Tooling: (tbd)
  - Frontend/UI: (tbd)
Notable Files: (tbd)
Impact Assessment: (tbd)
Linked Epics: (pending)

---

### PR #188 (placeholder): (tbd)
Tags: (tbd)
Summary: (tbd)
Affected Areas:
  - Schema: (tbd)
  - Application Logic: (tbd)
  - Infrastructure / Tooling: (tbd)
  - Frontend/UI: (tbd)
Notable Files: (tbd)
Impact Assessment: (tbd)
Linked Epics: (pending)

---

### PR #189 (placeholder): (tbd)
Tags: (tbd)
Summary: (tbd)
Affected Areas:
  - Schema: (tbd)
  - Application Logic: (tbd)
  - Infrastructure / Tooling: (tbd)
  - Frontend/UI: (tbd)
Notable Files: (tbd)
Impact Assessment: (tbd)
Linked Epics: (pending)

---

### PR #190 (placeholder): (tbd)
Tags: (tbd)
Summary: (tbd)
Affected Areas:
  - Schema: (tbd)
  - Application Logic: (tbd)
  - Infrastructure / Tooling: (tbd)
  - Frontend/UI: (tbd)
Notable Files: (tbd)
Impact Assessment: (tbd)
Linked Epics: (pending)

---

### PR #191 (placeholder): (tbd)
Tags: (tbd)
Summary: (tbd)
Affected Areas:
  - Schema: (tbd)
  - Application Logic: (tbd)
  - Infrastructure / Tooling: (tbd)
  - Frontend/UI: (tbd)
Notable Files: (tbd)
Impact Assessment: (tbd)
Linked Epics: (pending)

---

### PR #192 (placeholder): (tbd)
Tags: (tbd)
Summary: (tbd)
Affected Areas:
  - Schema: (tbd)
  - Application Logic: (tbd)
  - Infrastructure / Tooling: (tbd)
  - Frontend/UI: (tbd)
Notable Files: (tbd)
Impact Assessment: (tbd)
Linked Epics: (pending)

---

### PR #193 (placeholder): (tbd)
Tags: (tbd)
Summary: (tbd)
Affected Areas:
  - Schema: (tbd)
  - Application Logic: (tbd)
  - Infrastructure / Tooling: (tbd)
  - Frontend/UI: (tbd)
Notable Files: (tbd)
Impact Assessment: (tbd)
Linked Epics: (pending)

---

### PR #194 (placeholder): (tbd)
Tags: (tbd)
Summary: (tbd)
Affected Areas:
  - Schema: (tbd)
  - Application Logic: (tbd)
  - Infrastructure / Tooling: (tbd)
  - Frontend/UI: (tbd)
Notable Files: (tbd)
Impact Assessment: (tbd)
Linked Epics: (pending)

---

### PR #195 (placeholder): (tbd)
Tags: (tbd)
Summary: (tbd)
Affected Areas:
  - Schema: (tbd)
  - Application Logic: (tbd)
  - Infrastructure / Tooling: (tbd)
  - Frontend/UI: (tbd)
Notable Files: (tbd)
Impact Assessment: (tbd)
Linked Epics: (pending)

---

### PR #196 (placeholder): (tbd)
Tags: (tbd)
Summary: (tbd)
Affected Areas:
  - Schema: (tbd)
  - Application Logic: (tbd)
  - Infrastructure / Tooling: (tbd)
  - Frontend/UI: (tbd)
Notable Files: (tbd)
Impact Assessment: (tbd)
Linked Epics: (pending)

---

### PR #197 (placeholder): (tbd)
Tags: (tbd)
Summary: (tbd)
Affected Areas:
  - Schema: (tbd)
  - Application Logic: (tbd)
  - Infrastructure / Tooling: (tbd)
  - Frontend/UI: (tbd)
Notable Files: (tbd)
Impact Assessment: (tbd)
Linked Epics: (pending)

---

### PR #198 (placeholder): (tbd)
Tags: (tbd)
Summary: (tbd)
Affected Areas:
  - Schema: (tbd)
  - Application Logic: (tbd)
  - Infrastructure / Tooling: (tbd)
  - Frontend/UI: (tbd)
Notable Files: (tbd)
Impact Assessment: (tbd)
Linked Epics: (pending)

---

### PR #201 (placeholder): (tbd)
Tags: (tbd)
Summary: (tbd)
Affected Areas:
  - Schema: (tbd)
  - Application Logic: (tbd)
  - Infrastructure / Tooling: (tbd)
  - Frontend/UI: (tbd)
Notable Files: (tbd)
Impact Assessment: (tbd)
Linked Epics: (pending)

---

### PR #202 (placeholder): (tbd)
Tags: (tbd)
Summary: (tbd)
Affected Areas:
  - Schema: (tbd)
  - Application Logic: (tbd)
  - Infrastructure / Tooling: (tbd)
  - Frontend/UI: (tbd)
Notable Files: (tbd)
Impact Assessment: (tbd)
Linked Epics: (pending)

---

### PR #203 (placeholder): (tbd)
Tags: (tbd)
Summary: (tbd)
Affected Areas:
  - Schema: (tbd)
  - Application Logic: (tbd)
  - Infrastructure / Tooling: (tbd)
  - Frontend/UI: (tbd)
Notable Files: (tbd)
Impact Assessment: (tbd)
Linked Epics: (pending)

---

### Excluded (Not merged) PR #278
Rationale: Closed without merge; per policy, unmerged PRs are not catalogued beyond this note.
| PR | Status | Title | Disposition |
|----|--------|-------|-------------|
| 278 | closed (unmerged) | feat: enhanced user management cycle | Ignored (not merged) |

---

## Pending Backfill
Next PRs to catalogue after placeholder expansion: continue chronological enumeration beyond current highest processed toward target upper bound. Future steps: replace each placeholder (38, 40, 46, 49, 52, 57, 58, 86, 88, 89, 90, 106, 107, 109, 118, 119, 120, 121, 122, 168, 173) with fully resolved entries (tags, files, impacts) once diffs are parsed.

## Nomenclature Evolution Appendix (to populate as encountered)
- (placeholder) Track shifts: Procedures → Treatments → Medical Specialties (PRs #89 → #88 sequence to validate)
- Staff → plattformStaff (PR #90)
- Languages collection removal (PR #86) – enforce inline language fields

## Cross-Reference Usage
- To map from an Epic to detailed file impacts: consult `docs/epic-analysis.md` Implementation Trace (Epic → PR list), then resolve PR here.
- To assess schema drift risk window: filter entries tagged `schema` + chronological span between introduction and first permission/access hook referencing each collection.

## Verification Note
Each entry is derived only from observed or enumerated PRs. Placeholders clearly marked (tbd) will be replaced once repository diffs are inspected; no inferred impacts are asserted yet for those entries.
