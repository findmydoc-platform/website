# Testing Strategy

This page explains what we expect from the test suite and how it mirrors the permission matrix driven architecture.

## Guiding Principles

- **Protect access control first.** Every change to `src/access` or collection `access` functions must stay in lockstep with the metadata in `src/security/permission-matrix.config.ts` and the generated JSON snapshots.
- **Exercise business hooks.** Hooks encapsulate side effects and validation, so unit suites track their behaviour across happy paths and failure paths.
- **Lean on integration for workflows.** Use the fixtures in `tests/fixtures` to cover cross-collection flows that involve Payload and Supabase interactions.
- **Keep tests focused.** Mock Payload internals only at the edges; we do not re-test the platform, Supabase SDKs, or generated types.
- **Partial Mocking (Stubbing) over Full Implementation.** When mocking complex objects (like Payload's `user` or `req`), prefer stubbing only the properties required for the specific test case. We do not aim to preserve the full implementation behavior of external dependencies in unit tests. This reduces coupling and brittleness.

## What To Cover

| Priority | Area | Notes |
| --- | --- | --- |
| Must | Access control (unit + permission matrix) | Aim for 100% branch coverage; validate true/false/scoped filters using the shared helpers. |
| Must | Authentication logic | Verify Supabase token handling, provisioning hooks, and error branches. |
| Must | Business hooks | Assert data transformations, validations, and side effects. |
| Should | Field-level rules & utilities | Cover complex field validation or helper utilities that gate behaviour. |
| Avoid | Payload internals, Supabase SDK, generated types, migrations | Treat these as external dependencies. |

## Test Types

- **Unit** (`tests/unit`): Fast, focused suites that mock external calls. This includes access helpers, collection configs (via the permission matrix helpers), hooks, and auth utilities.
- **Integration** (`tests/integration`): Real Payload requests against the Docker-backed Postgres instance using the fixture helpers. Use when a behaviour depends on multiple collections or Supabase interactions.
- **Setup scripts** (`tests/setup`): Global lifecycle orchestration (database, seeds, cleanup). These are executed automatically; you rarely need to touch them.
- **E2E** (`tests/e2e`): Keep this intentionally small and deterministic. Use it for true user journeys (admin login, dashboard smoke, key CRUD path), not for collection-internal contract depth.

## Collection Contract Model (Integration-first)

We use a two-tier model for collection coverage:

- **Baseline contract (all collections):** at least one integration path that proves owner-role CRUD behavior plus one denied write path.
- **Deep contract (critical domains):** additional integration scenarios for relationship integrity, duplicate guards, and hook-driven side effects.
- A suite can intentionally be referenced by both tiers in the registry when one file contains both baseline and deep assertions for the same slug.

Registry and gate:

- Contract registry: `tests/integration/contracts/collectionContractRegistry.ts`
- Hard sync gate: `tests/integration/contracts/collectionContractCoverage.test.ts`

The gate fails when:

- a slug exists in `src/collections/**` but not in the registry
- a registry entry points to a missing integration test file
- a slug in a deep-domain group has no deep test references

## Core Integration Scope (Issue #297)

For core medical-network collections (`clinics`, `doctors`, `medical-specialties`, `accreditation`, `treatments`, `clinictreatments`, `doctortreatments`, `doctorspecialties`, `countries`, `cities`, `reviews`), integration tests should explicitly cover:

- At least one allowed CRUD path for the role that owns the operation.
- At least one denied permission path (clinic/patient/anonymous where relevant).
- Relationship integrity checks for joins and referenced IDs.
- Derived field or hook behavior where implemented (for example `doctors.fullName`, review/treatment/clinic average ratings, treatment average prices).

## When To Add Tests

- You changed a collection `access` rule → update the permission matrix config, regenerate snapshots, and adjust the matching test in `tests/unit/access-matrix`.
- You added a hook or extended an existing one → create or expand the suite under `tests/unit/hooks`.
- You introduced a new workflow that crosses collections or relies on seeds → prefer an integration test with fixtures so behaviour remains realistic.
- You added a new collection slug → add baseline integration coverage and register it in `collectionContractRegistry` in the same PR.

## Naming & Location

- Place tests inside the matching domain folder under `tests/` instead of co-locating with source files.
- Use descriptive filenames (`clinics.permission.test.ts`, `patientProvisioning.hook.test.ts`) to make intent obvious when scanning `pnpm tests --watch` output.
- Shared helpers live in `tests/unit/helpers`; if you need a new mock, add it there instead of duplicating code.

## CI results and full integration

PR Validation uses native job results and complete path-filter outputs. A documentation omission is permitted only after successful classification. The workflow summary records the reason. Failed classification, invalid outputs, failed or cancelled prerequisites, unexpected skips, missing expected coverage reports, artifact transfer failures and coverage merge failures remain errors.

PR Validation and Preview use `.github/filters/validation.yml` with the pinned native `dorny/paths-filter` action and `predicate-quantifier: every`. The application build and new Preview deployment are omitted only when all changed paths belong to these classes, including mixtures:

| Class | Permitted paths |
| --- | --- |
| Test cases | `tests/**/*.test.ts`, `tests/**/*.test.tsx`, `tests/e2e/**/*.spec.ts`, `tests/e2e/**/*.spec.tsx` |
| Repository metadata | `.secrets.baseline`, `.github/ISSUE_TEMPLATE/*.yml`, `.github/ISSUE_TEMPLATE/*.yaml` |
| Documentation | Markdown under `docs/**`; root `README.md` |

Test setup, fixture, helper, support and mock directories still require builds. Test-like filenames containing setup, fixture, helper or support also require builds. Runtime code, styles, product files, public assets, dependencies, lockfiles, shared configuration, executable tooling, workflow configuration and unknown paths require builds. Deletions count, and the native action expands renames into old and new paths. Empty evidence forces conservative work. Missing or inconsistent native counts and PR discovery beyond the API's 3000-file limit fail classification. A failed classification cannot authorize an omission. Workflow summaries state approved omissions, and manual execution always requests full build and integration.

The build policy applies to PRs and triggered Main runs. Other checks retain their existing routing. Preview classification runs for every PR and Main push so workflow changes and unknown Markdown paths cannot bypass the shared policy through trigger exclusions. Vercel deployment still requires the existing trusted-source condition. These routing checks do not prove complete native discovery or measured savings; acceptance requires normal workflow evidence.

Main full integration follows validation relevance independently of the application build. Integration-test changes therefore run the full suite even when the build is omitted. Documentation-only omissions remain available, and `workflow_dispatch` runs the full build and integration suite. The serial database-copy runner preserves full Payload configuration, seed preparation, isolation, assertions and strict cleanup. Main and manual full-suite coverage retain the 50% thresholds for statements, branches, functions and lines.

`Integration Tests` and `Combined Coverage` remain optional merge checks. Combined Coverage reports the available sources and explicitly identifies permitted absences; it cannot establish a missing suite's coverage or erase a failed test result. Integration failure is visible but does not guarantee a merge block under the existing ruleset. The seven required checks remain `lint pr title`, `Static Checks`, `Unit Tests`, `Storybook Tests`, `Build`, `Dependency Review` and `db-quality-gate`. DB Quality retains its separate schema and migration responsibility.

The frozen normal-CI reference is [Main d9a92ee](https://github.com/findmydoc-platform/website/commit/d9a92ee015e17ec7cca5af144c9effab679c5533), with 104 integration suite files plus seed preparation. Its successful [PR Validation run](https://github.com/findmydoc-platform/website/actions/runs/37775132580), [Preview run](https://github.com/findmydoc-platform/website/actions/runs/37775132581) and [DB Quality run](https://github.com/findmydoc-platform/website/actions/runs/37775132576) are baseline controls. They do not prove optimization savings. Acceptance still requires the comparable normal-CI pairs defined in [spec #2075](https://github.com/findmydoc-platform/website/issues/2075#issuecomment-6080061658).

## Cross-References

- [Access Control](./access-control.md) explains how metadata drives the permission matrix suites.
- [Patterns & Utilities](./patterns.md) lists the reusable mocks, fixtures, and cleanup helpers.
- [Setup](./setup.md) details the environment and commands.

Deterministic contract coverage and the hard sync gate are part of the default test model.

DB reset uses template-clone restores through the shared harness, with `empty` templates for integration and `baseline` templates for Playwright E2E.

Template rebuilds are driven per template kind. Integration only depends on the `empty` template fingerprint, while Playwright E2E depends on both `empty` and `baseline`.

## Architecture Overview

Below is a compact diagram showing how our test suites interact with Payload, the permission matrix, fixtures, and infrastructure. It focuses on the software architecture (what talks to what) rather than on the documentation flow.

```mermaid
flowchart TB
	Dev[Developer runs tests] --> Vitest[Vitest runner]
	Vitest --> Unit[Unit suites]
	Vitest --> Integration[Integration suites]

	Unit --> MatrixHelpers[Access-matrix helpers]
	MatrixConfig[src/security/permission-matrix.config.ts\nderived JSON] --> MatrixHelpers
	MatrixHelpers --> AccessTests[Collection permission tests]

	Integration --> Fixtures[Fixtures & seed helpers]
	Fixtures --> Payload[Payload local API]
	Payload --> Postgres[Docker Postgres]
	Payload --> Supabase[Supabase mocks/stubs]

	Unit --> Reports[Coverage & matrix:verify]
	Integration --> Reports

	classDef infra fill:#f8f9fa,stroke:#cbd5e1
	class Payload,Postgres,Supabase infra
```
