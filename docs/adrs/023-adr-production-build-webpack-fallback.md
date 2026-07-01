# ADR: Production Build Webpack Fallback

## Status (Table)

| Name    | Content            |
| ------- | ------------------ |
| Author  | Sebastian Schuetze |
| Version | 1.0                |
| Date    | 01.07.2026         |
| Status  | accepted           |

## Background

findmydoc production and preview deployments use Next.js on Vercel with an ESM application package and a Payload CMS admin surface. Next.js 16 made Turbopack the default for `next build`, while webpack remains available through `next build --webpack`.

On March 20, 2026, Turbopack-built Vercel deployments hit runtime instrumentation loading failures on affected server routes. The detailed symptom log, root-cause notes, applied mitigation, rollback checks, references, and escalation path are maintained in [the deployment runbook](../deployment-runbook.md#nextjs-162--turbopack-incident-march-20-2026). Rollback readiness is tracked in [issue #777](https://github.com/findmydoc-platform/website/issues/777).

This ADR records the long-lived build decision and intentionally does not duplicate the incident runbook.

## Problem Description

The webpack fallback started as a tactical deploy-stability mitigation. Because it remains active beyond the original incident window, it needs explicit architecture-level ownership.

Without an ADR, the production build command can look like an accidental or temporary script detail. That increases the risk that a dependency upgrade, deploy cleanup, or build-script refactor removes the fallback before the Turbopack runtime path is verified for the admin and auth surfaces that previously failed.

## Considerations

1. Re-enable Turbopack for production builds now
   - Pros: aligns with the Next.js default and removes the workaround.
   - Cons: re-enters the runtime path that failed before rollback evidence exists.

2. Pin or downgrade Next.js instead
   - Pros: can reduce short-term framework change exposure.
   - Cons: slows routine Next.js updates and does not directly prove the Turbopack instrumentation runtime path on Vercel.

3. Keep only the deployment runbook note
   - Pros: preserves operational detail near the deployment procedure.
   - Cons: leaves the build-system choice undocumented as an architecture decision.

4. Keep webpack for production builds and document the fallback in an ADR (chosen)
   - Pros: preserves the stable deploy path, makes the workaround intentional, and keeps rollback checks explicit.
   - Cons: carries a non-default build path until the rollback criteria are satisfied.

## Decision with Rationale

Production, CI, and Vercel deployment builds for the website continue to use webpack through `next build --webpack`.

Turbopack remains the preferred long-term Next.js build path because it is the framework default. It is not the active production build path until the rollback criteria in the deployment runbook and issue #777 are met.

The decision keeps the project on current Next.js versions while avoiding the Turbopack instrumentation runtime path that previously failed in Vercel deployments. It also makes the fallback auditable: removing `--webpack` is a rollback decision, not a routine script cleanup.

This ADR governs production and deployment builds only. Local development and debugging commands may use their own bundler mode when that does not change production deploy behavior.

## Technical Debt

The production build uses an explicit fallback away from the Next.js 16 default. The team must revisit this after relevant Next.js upgrades and keep the runbook plus issue #777 current with tested deployment evidence.

The fallback can hide improvements or regressions in Turbopack compatibility until a dedicated rollback validation branch or deployment is tested.

## Risks (Optional)

- The fallback can become stale and outlive the original runtime risk.
  - Mitigation: keep issue #777 open until rollback criteria are met and document tested deployment IDs there.
- A future cleanup can remove `--webpack` without validating affected admin and auth routes.
  - Mitigation: treat removal as a rollback PR that updates this ADR or supersedes it.
- Webpack builds can diverge from the framework default behavior or performance expectations.
  - Mitigation: retest Turbopack after relevant Next.js upgrades and prefer returning to the framework default once verified.

## Deprecated (Optional)

Not deprecated.

## Superseded by (Optional)

Not superseded.
