# Integration execution overhead after database copies

The largest remaining measured cost pool is repeated test-module collection, about 4.5 minutes per full serial copy execution. Safe batching or module reuse deserves a small feasibility check. Reusing only the Payload instance has a much smaller ceiling. No additional medium or large saving is proved by the retained receipts.

This is research as of 7 October 2026. It covers execution internals independently of affected-test selection. No Actions runs, tests, migrations, commits, deployments, product changes or formal reviews were performed. Raw evidence was read without modification.

## Evidence and implementation context

The accepted copy measurement is [run 37386841643](https://github.com/findmydoc-platform/website/actions/runs/37386841643), at commit `776fbe69e1665e42e0bd0cd60ee336fe687845e2`. All three full pairs retain 98 files, 877 passing case identities and matching per-file coverage. The copy executions take 773.935, 781.426 and 778.499 seconds including preparation, seed coverage merge and cleanup. Their median is 12:58.499. Every bound below is marginal to those copy executions. The earlier 34-minute seed-per-file baseline supplies no remaining opportunity.

Local receipts are in the primary checkout's ignored `tmp/ci-diagnostics/db-copy-media-37386841643/`. For each round `r`, the calculation reads `full/round-r-artifact/round-r/E-0/process.json`, `metrics.json`, `hooks.jsonl`, `phases.jsonl`, `copies.jsonl` and `seed-merged/process.json`, alongside `full-summary.md`. Totals below are sums of recorded milliseconds divided by 1,000, rounded for presentation. The phase file instruments only three lifecycle files. It cannot establish whole-suite Payload initialization time.

Code references use experiment-worktree commit `822c3f42265f721a0318398e3833b2430dfdd09f`. The primary checkout has a separate uncommitted implementation. Its `.github/workflows/deploy.yml`, lines 403–511, already describes four integration shards and native coverage merge; lines 24–25 describe nightly integration. Its uncommitted *docs/engineering/ci-performance-measurements.md*, lines 73–79, records that candidate and explicitly states that nightly execution alone avoids no PR work. The `deploy.yml` and `deploy-preview.yml` diffs and the filter files were inspected read-only. The experiment branch's old workflow is not the current intended implementation. The serial copy timings do not measure that in-progress sharded implementation with copies.

## Observed costs

| Recorded component | Round 1 seconds | Round 2 seconds | Round 3 seconds | Interpretation |
| --- | ---: | ---: | ---: | --- |
| Complete copy execution | 773.9 | 781.4 | 778.5 | Includes preparation, merge and cleanup |
| Module collection sum | 272.6 | 271.9 | 273.1 | Imports and suite registration, not isolated Payload init |
| Setup-file sum | 62.1 | 64.3 | 62.8 | Includes the per-file copy below |
| All 98 copies and SQL isolation probes | 58.3 | 60.6 | 59.1 | Nested in setup, not an additional cost |
| Module execution sum | 342.5 | 346.4 | 345.6 | Tests and hooks |
| All beforeAll hooks | 29.5 | 29.5 | 29.2 | Nested in execution; includes init, baseline checks and fixtures |
| All afterEach plus afterAll hooks | 35.6 | 35.5 | 36.1 | Includes storage and database cleanup |
| Template-build marker to restore marker | 48.9 | 49.7 | 48.8 | Empty-schema preparation plus baseline seeding, not migration-only |
| Process start to database-ready marker | 57.2 | 59.1 | 57.0 | Also includes services and readiness waits |
| Native seed coverage merge | 1.58 | 1.58 | 1.60 | Already included in complete execution |

Do not add nested entries or case durations to module duration. The reporter copies Vitest's module diagnostics and attaches worker hook sums separately. Case timings can include per-test hooks. The retained data does not separate transformation, dependency evaluation, config sanitization, worker startup, V8 collection/remapping and report generation into exclusive wall-time categories. The gap between the named sums and the whole process is not a coverage estimate. See [reporter lines 60–104](https://github.com/findmydoc-platform/website/blob/822c3f42265f721a0318398e3833b2430dfdd09f/scripts/ci-shard-reporter.mjs#L60).

The nine `getPayload` measurements across the three instrumented files and three copy rounds take approximately 0.08–0.14 seconds each. They support investigating import repetition rather than assuming expensive initialization inside every beforeAll. Even eliminating every beforeAll callback, including necessary fixtures, removes at most about 30 recorded seconds in these runs. That is a deliberately loose ceiling for init-only reuse, not a recommendation to remove hooks.

## Recommendations that remain unproven

### Prioritize compatible file batching or module reuse

The [integration project, lines 195–210](https://github.com/findmydoc-platform/website/blob/822c3f42265f721a0318398e3833b2430dfdd09f/vitest.config.ts#L195) uses serial files in the forks pool. Vitest 4.1.11's [versioned performance guide](https://raw.githubusercontent.com/vitest-dev/vitest/v4.1.11/docs/guide/improving-performance.md) confirms that isolated forks create a separate child process per file. There is one top-level Vitest invocation per variant, not 98 CLI invocations. The [diagnostic controller, lines 381–408](https://github.com/findmydoc-platform/website/blob/822c3f42265f721a0318398e3833b2430dfdd09f/scripts/ci-shard-diagnostics.mjs#L381) retains that distinction.

The collection cost pool is 271.9–273.1 seconds, about 35% of the copy total. Complete elimination is impossible because tests still need imports and registration. A conditional 25–50% reduction in this pool corresponds to roughly 68–137 physical seconds, about 1.1–2.3 minutes, before any new reset or reconnect cost. This is an economic screening scenario, not an expected saving or measured result. The receipts do not determine the recoverable fraction. The practical ceiling is below the approximately 4.5-minute collection pool; worker startup has no separate defensible estimate.

Keep the complete production config. A worker-local immutable-module cache that preserves isolated globals would be preferable if the installed Vitest supports the required semantics. Whether it does remains open. A threads-pool comparison retains file isolation but does not automatically remove repeated import evaluation. A shared globalSetup Payload object is not a solution: [Vitest 4.1.11 globalSetup documentation](https://raw.githubusercontent.com/vitest-dev/vitest/v4.1.11/docs/config/globalsetup.md) limits transfer to serializable values in a separate global scope.

Turning off file isolation changes the contract. [Payload 3.88.0 source](https://raw.githubusercontent.com/payloadcms/payload/v3.88.0/packages/payload/src/index.ts) caches `getPayload` through a global map keyed by `options.key` or `default`. The [baseline helper, lines 7–23](https://github.com/findmydoc-platform/website/blob/822c3f42265f721a0318398e3833b2430dfdd09f/tests/fixtures/ensureBaseline.ts#L7) also retains a module boolean. Neither cache proves compatibility with a replacement database. The [copy helper, lines 601–609 and 745–770](https://github.com/findmydoc-platform/website/blob/822c3f42265f721a0318398e3833b2430dfdd09f/scripts/test-database-harness.mjs#L601) drops the working database and verifies an SQL sentinel. Retaining an instance across this boundary requires explicit quiescence, pool closure/reconnection, cache invalidation and a fresh baseline check.

Any batching proposal must retain a fresh baseline per logical file, serial database ownership, awaited transactions and background work, clean mock registrations, restored fake timers and environment state, and storage cleanup. The [webhook file, lines 3–13 and 54–79](https://github.com/findmydoc-platform/website/blob/822c3f42265f721a0318398e3833b2430dfdd09f/tests/integration/transactionalEmail.webhook.test.ts#L3) has hoisted guards and mutable mocked registries. The [concurrency file, lines 11–12 and 79–96](https://github.com/findmydoc-platform/website/blob/822c3f42265f721a0318398e3833b2430dfdd09f/tests/integration/clinicDashboardTreatments.concurrency.test.ts#L79) uses different storage behavior and independent requests. They are unsuitable first batching candidates.

A rollback wrapper around every file is not equivalent isolation. [Payload transactions](https://payloadcms.com/docs/database/transactions) follow `req.transactionID`; independent requests and SQL clients need not join the wrapper. It would change commit visibility and contention behavior, and would not undo S3 objects. [PostgreSQL CREATE DATABASE](https://www.postgresql.org/docs/16/sql-createdatabase.html) also cannot run inside a transaction and requires an unconnected template. Preserve the concurrent-transaction cases and actual commit boundaries.

Effort is medium to high because isolation is the blocker. The smallest later validation is two compatible DB lifecycle files in both orders, with repeated execution, SQL sentinel and original case/coverage comparisons, after a source-level reset-contract check. Preserve the same per-file copies initially. Stop if maintaining isolation requires a general runner rewrite. No such validation ran here.

### Inspect repeated demo fixtures before reducing real behavior checks

`seedReviewWorkflow.integration.test.ts` takes 74.2–76.6 seconds of module execution and `seedReset.storage.test.ts` takes 47.3–48.3 seconds. Together they occupy 121.5–124.9 seconds after copies. Their complete removal is the broad cost-pool ceiling, not an allowable optimization.

The workflow test deliberately runs the demo plan four times for initial state, idempotence and reconciliation. See [lines 468, 679, 808 and 889](https://github.com/findmydoc-platform/website/blob/822c3f42265f721a0318398e3833b2430dfdd09f/tests/integration/seedReviewWorkflow.integration.test.ts#L679). The reset test verifies real reseeding and baseline reset. See [lines 367–372](https://github.com/findmydoc-platform/website/blob/822c3f42265f721a0318398e3833b2430dfdd09f/tests/integration/seedReset.storage.test.ts#L367) and [line 470](https://github.com/findmydoc-platform/website/blob/822c3f42265f721a0318398e3833b2430dfdd09f/tests/integration/seedReset.storage.test.ts#L470). Baseline-copy cache hits correctly do not bypass this behavior under test.

A narrower demo fixture for reconciliation might avoid unrelated fixture work while keeping at least one complete-plan check and the rerun assertions. This needs a dependency and assertion inventory first. There is no per-step seed timing or proof of expendable fixture work, so no realistic saving estimate follows. Medium effort; smallest validation is a read-only map of assertions to demo entities and seed calls. Approve a tiny execution comparison only if that map exposes repeated unrelated work.

The webhook file takes 38.7–38.9 seconds. Four late-commit probes each take about 6.1–6.2 seconds. They deliberately inject `pg_sleep(6)` and assert a real response deadline. See [lines 1995–2028](https://github.com/findmydoc-platform/website/blob/822c3f42265f721a0318398e3833b2430dfdd09f/tests/integration/transactionalEmail.webhook.test.ts#L1995). Fake timers cannot accelerate the database sleep. Shortening these probes changes the timing contract; do not count their roughly 25 seconds as removable overhead.

### Correct database-free test placement, but expect seconds

Eight inspected files require neither a real Payload instance nor SQL: gallery hook validation, collection contract coverage, conditional requirement alignment, cache architecture coverage, three migration-source inspections and delivery-edge evidence helpers. Examples are [mocked hook arguments, lines 11–20](https://github.com/findmydoc-platform/website/blob/822c3f42265f721a0318398e3833b2430dfdd09f/tests/integration/clinicGalleryEntries.validation.test.ts#L11), [source inspection, lines 4–12](https://github.com/findmydoc-platform/website/blob/822c3f42265f721a0318398e3833b2430dfdd09f/tests/integration/migrations/clinicProfileDrafts.test.ts#L4) and [repository scans, lines 27–40](https://github.com/findmydoc-platform/website/blob/822c3f42265f721a0318398e3833b2430dfdd09f/tests/integration/contracts/collectionContractCoverage.test.ts#L27).

These eight files retain 37 cases. Their setup sum is 4.88–5.12 seconds, including 4.60–4.83 seconds of corresponding copies. Collection plus execution adds about 11–12 seconds, mostly a cache architecture scan that must still run elsewhere. Reclassification therefore has only about five seconds of directly identified avoidable database setup, plus unmeasured worker cost. Running the same assertions in another project is not a 16-second net saving. Effort is low to medium because coverage ownership and registry paths need attention.

Do not classify every file without `getPayload` as database-free. Twelve match that textual heuristic, but several use real PostgreSQL migrations. [searchContract, lines 12–54](https://github.com/findmydoc-platform/website/blob/822c3f42265f721a0318398e3833b2430dfdd09f/tests/integration/migrations/searchContract.test.ts#L12) creates a schema, executes SQL and rolls back. Mocked external providers also do not make a test database-free.

### Leave smaller preparation and reporting costs behind the minute-scale candidates

Schema migration and template seeding already run once per variant, not once per file. See [template preparation, lines 544–590](https://github.com/findmydoc-platform/website/blob/822c3f42265f721a0318398e3833b2430dfdd09f/scripts/test-database-harness.mjs#L544). The entire measured build interval is under 50 seconds, and migration-only time is unavailable. Cross-job template transport could multiply savings across shards but would add validation and transfer; there is no combined copy-plus-sharding receipt to quantify it. Do not assume a fourfold saving.

The provider-preparation test's real CLI down/up case takes 13.1–13.3 seconds, nested in its 16-second file. [Lines 97–132](https://github.com/findmydoc-platform/website/blob/822c3f42265f721a0318398e3833b2430dfdd09f/tests/integration/transactionalEmail.providerPreparation.test.ts#L97) preserve queued data through the migration. Replacing it with direct function calls would change CLI coverage and cannot avoid minutes by itself.

All copies and probes total 58–61 seconds. Removing every copy provides an approximately one-minute destructive ceiling, not safe saving. All teardown hooks total about 36 seconds and include necessary per-test state and storage cleanup. Copying the database does not reset shared S3Mock. The native seed merge costs only 1.6 seconds. These are not first targets.

V8 coverage overhead is unmeasured because every accepted run collects coverage. [Official coverage documentation](https://vitest.dev/guide/coverage.html) explains that report include/exclude rules do not limit V8's runtime collection to those modules. Narrower report patterns therefore do not demonstrate cheaper collection. Keep seed coverage and the complete gate; omit any claimed coverage-provider saving without a same-input comparison.

The domain POC in [CI optimization results](https://github.com/findmydoc-platform/website/blob/822c3f42265f721a0318398e3833b2430dfdd09f/docs/engineering/ci-optimization-results.md#domain-integration-poc) retains 37 of 47 collections and demonstrates no repeated smaller-config saving. A broad smaller-config rewrite has no economic support here.

## Decision and accounting limits

Pursue the batching/reset feasibility check first because it is the only identified overhead pool clearly exceeding several minutes. Follow with the seed assertion inventory. Correct test placement when useful for ownership, not as a minute-scale POC. No measured positive lower bound exists for any new recommendation, and the opportunities overlap.

These are physical execution seconds, not exact billed minutes or sharded feedback savings. GitHub accounts for separate physical jobs, including rounding, runner type and setup. [GitHub's billing documentation](https://docs.github.com/en/billing/concepts/product-billing/github-actions) is the billing authority; these process receipts cannot establish invoice savings. A nightly proposal must subtract added nightly work from avoided PR work. Zero tests for a truly irrelevant change and intentional deferral of relevant checks have different risk timing. Neither is part of the execution-saving estimates above.

Only this research file was written. Formatting is restricted to this file to preserve concurrent changes; repository-wide `pnpm format` would exceed the authorized write scope. Formal reviewers were not run. Test and Architecture review are appropriate before adopting batching or fixture changes, not required to accept this read-only diagnosis.
