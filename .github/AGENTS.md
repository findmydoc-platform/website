# GitHub Automation Instructions

## Scope

These instructions apply to `.github/**`, including workflows, actions, scripts, coverage config, issue templates, Dependabot config, and pull request metadata.

Use [docs/engineering/github-actions-pipeline-cost-optimization.md](../docs/engineering/github-actions-pipeline-cost-optimization.md) as research context for CI cost and feedback-time decisions. Do not copy that report into workflow comments; translate it into small, testable workflow rules.

## Priorities

- `P0`: Keep workflows secure, least-privileged, deterministic, and compatible with branch protection.
- `P1`: Keep pull request feedback focused on merge-critical signal and avoid unnecessary runner minutes.
- `P2`: Keep workflow intent readable in GitHub and avoid clever indirection without repeated reuse.

## Workflow Security

- Start every workflow with the narrowest top-level `permissions` block, usually `contents: read`; add broader job-level permissions only where the exact step needs them.
- Use `pull-requests: write` only for jobs that write PR comments, annotations, labels, or review metadata.
- Use `contents: write`, `actions: write`, `deployments: write`, `id-token: write`, or environment secrets only for release, deployment, provenance, or explicitly documented automation needs.
- Do not use `pull_request_target` for untrusted code checkout or script execution unless the workflow first proves the checked-out ref cannot control the executed code.
- Preserve the existing action-pinning pattern: third-party actions should be pinned to full commit SHAs with an adjacent version comment when practical.
- Keep shell steps defensive: use `bash`, prefer `set -euo pipefail` for multi-line scripts, quote variables, and avoid passing untrusted PR-controlled values into shell commands without validation.

## Trigger And Gate Design

- Prefer explicit `paths` or `paths-ignore` for expensive workflows; broad `pull_request` and `push` triggers need a concrete reason.
- Keep branch-protection checks stable. If a required workflow becomes path-conditional, provide a stable gate job that always reports success, failure, or an explicit skip decision.
- Use `concurrency` for PR workflows so obsolete runs are canceled when a newer commit arrives.
- Do not cancel deployment, release, database reset, or other external-state jobs unless the workflow is proven idempotent and cleanup-safe.
- Keep PR-blocking checks limited to merge-critical correctness, security, and deploy confidence; move broad hygiene to `main`, nightly, release, or manual workflows unless it is fast and high-signal.

## Cost And Feedback Routing

- Before adding a job, state which change class it protects: docs, workflow/security, frontend UI, API, Payload schema, database migration, dependency, deployment, or release.
- Do not add a full build, full test suite, preview deploy, or E2E lane for docs-only or metadata-only changes unless the changed file affects generated runtime output.
- Treat dependency updates by risk: dev-tool patch updates can use narrow checks, runtime dependencies need affected build/tests, and core framework or security updates need broader validation.
- Avoid duplicated setup across jobs. Reuse the repository's Node and pnpm versions, dependency caching, shared scripts, and existing summary writers before adding new install/build work.
- Use path filters as a first pass and dependency-aware routing when available. Do not narrow checks for shared runtime files unless downstream impact is explicitly represented.
- Optimize for total billable work before adding parallelism. Parallel jobs can shorten feedback time while increasing cost through repeated setup.

## Artifacts And Reporting

- Upload artifacts only when they are needed for review, debugging, coverage, or audit evidence.
- Set the shortest retention period that still matches the artifact's review value.
- Keep summaries concise and action-oriented: status, skipped reason, relevant changed paths, and next debugging command when useful.
- Do not expose secrets, private machine addresses, account-local URLs, or private remote-access hostnames in logs, summaries, artifacts, screenshots, or PR bodies.

## Validation

- Workflow, GitHub script, or CI-critical changes still require the root validation policy: run `pnpm check` and `pnpm format`.
- Instruction changes to this file require `pnpm ai:slop-check` and `pnpm format`.
- If a workflow change alters permissions, secrets, token scope, third-party actions, or shell execution, recommend the security reviewer before handoff.
