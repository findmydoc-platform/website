# Full integration parallel validation

Website [#2121](https://github.com/findmydoc-platform/website/issues/2121) extends the CI goal to normal product-classified PRs that retain the complete integration suite. The earlier spec [#2075](https://github.com/findmydoc-platform/website/issues/2075) and its accepted measurements remain unchanged. The owner requests shorter complete workflows and a repeatable before/after comparison; lower runner consumption is reported separately.

## Reference and candidate

The reference starts at Main `2e7d9b4c8b39a12424a332714aaf51d7f764b009`. [Reference PR #2124](https://github.com/findmydoc-platform/website/pull/2124) has a one-line documentation edit in the runtime URL utility. This requests normal product-path validation while keeping product behavior, assertions, fixtures and dependencies unchanged. The candidate retains exactly that source edit. It changes the full integration execution and delivery contracts only.

This controlled runtime-path comparison measures the complete pipeline with full integration. It does not establish performance for every possible business change or larger future test inventory. Native discovery at this reference identifies 104 suite files. Accepted case counts and coverage come from actual successful execution, not from an assumed historical count.

The initial successful reference at `86fc3b9f` is retained as preparation evidence. Main then accepted a release-workflow/tooling-test change in [#2122](https://github.com/findmydoc-platform/website/pull/2122). Both benchmark variants were re-frozen on the resulting Main before acceptance measurements. The earlier elapsed time is not paired with the re-frozen candidate.

## Candidate execution

Full integration uses two isolated GitHub-hosted Linux runners. Each prepares the existing seeded baseline and continues to restore isolated database copies serially before each assigned file. Native Vitest `--shard` partitions the complete project. Neither shard selects changed files or changes suite assertions, fixtures, Payload configuration or coverage instrumentation.

The collector verifies the successful native JSON results against native full-project file discovery. Every expected file must occur exactly once, every recorded case must pass, and both shard identities must use the same workflow source revision. Missing results, duplicates, skipped cases and mismatched sources fail before coverage replay. A failed matrix prerequisite fails the collector.

Vitest's native blob replay combines both suite reports and one seed report. The seed is executed independently on each runner for isolation; only one seed report is replayed to avoid counting the preparation case twice. The additional seed execution remains real runner work. Full-suite thresholds remain 50% for statements, branches, functions and lines. Only successful complete replay publishes `coverage-integration` for Combined Coverage.

The existing selected-test PR path remains a single serial runner, including conservative full fallback when native selection cannot be confirmed. It publishes its existing full or explicitly partial report. Documentation-only omissions retain their existing decisions. The seven required contexts and the optional Integration policy are unchanged.

## Measurement protocol

- Freeze reference/candidate heads, their actual PR merge revisions, base Main, product tree, full integration tests, fixtures, lockfile, runtime versions, runner class and coverage configuration.
- Use normal PR events for two complete before/after pairs. Repeated observations use separate immutable branches/PRs with equivalent inputs, so unrelated checks and Preview are executed normally in each event.
- Prefer reversed pair order for the second repetition when practical. Record scheduling and environment variation; do not overlap experimental series deliberately to manufacture a speedup.
- Capture every expected native workflow and job through its terminal result, including Build, Preview, E2E when relevant, scans, Integration Tests and Combined Coverage.
- Measure complete CI from the first associated normal workflow start to the last expected result. Report validation-only time and queue delay separately where the native records establish them.
- Sum every actual job's execution interval once for Actions runner work. Include duplicate setup, seeds, transfer, the collector and delivery-contract tests. Parallel job durations are not added to claim elapsed workflow duration.
- Keep failed/cancelled/incomplete observations and retries in an investigation ledger. They cannot substitute for successful acceptance pairs; human waiting between attempts is not a successful workflow duration.
- Verify complete suite file/case identities, all full thresholds, full source coverage and ordinary strict service stop/preservation before accepting a timing comparison.
- Stop or re-freeze if product inputs, dependencies, Main base or assertions change. Do not quietly compare a fresh candidate against stale dependencies.

Report the individual pairs and their spread. Two pairs establish bounded repeatability, not a statistical guarantee. A normal successful coverage-transfer delay remains part of the observation. There is no retrospective subtraction of delays or multiplication of an old shard factor into the newer DB-copy result.

## Local validation and native acceptance

The native contract test executes real Vitest seed and shard processes, verifies complete merged coverage, and rejects missing, duplicate, skipped, differently sourced and failed native results. The workflow shell contract rejects unavailable or failed full aggregation. Existing native coverage and selected-discovery contracts remain applicable.

CI-critical changes require `pnpm check` and `pnpm format`; focused native runner/routing tests and `actionlint` cover the changed delivery behavior. No product behavior, UI, schema or migration changes are involved. Native Build and Preview remain part of the full normal comparison.

Candidate acceptance is pending until two successful complete comparable pairs exist. Main activation and its actual full-suite proof follow a concrete reviewed candidate. The historical four-shard result of 27:15 to 14:28 used another setup and increased runner work to 47:22; it is not the candidate's prediction.

## Operational limits

Anonymous Docker Hub pulls remain an external rate-limit risk, tracked separately in [#2117](https://github.com/findmydoc-platform/website/issues/2117). Two isolated runners require two fresh service preparations. A successful retry does not establish a permanent registry correction. Failure costs stay visible.

The last expected result may be Build, Preview, E2E or reporting rather than Integration. A shorter integration path improves complete feedback only when it reduces the final completion boundary. Runner work can increase while elapsed time falls; the final recommendation must show both.
