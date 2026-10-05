# Integration shard diagnostics

The experiment compares one full integration process, four sequential shards on the same VM, and four parallel shards on separate VMs. Diagnostic code lives on `agent/ci-shard-diagnostics`; existing validation and deployment workflows are unchanged.

## Measurement protocol

Each full round runs A and B on one VM. Rounds one and three run A before B; round two runs B before A. C starts after the paired job succeeds. Three complete rounds run consecutively against one immutable experiment commit. The source fingerprint covers application sources, integration tests and fixtures, dependency manifests, coverage configuration, Vitest configuration, and test service configuration.

Every measured process starts with fresh PostgreSQL and S3Mock services, rebuilt database templates, and its own empty Vite cache directory. Dependencies remain installed. Filesystem page caches and VM performance are uncontrolled; reversed order and paired ratios reduce their influence without eliminating it. All integration variants use the same diagnostic and blob reporters with V8 coverage enabled. Native Vitest merging combines B and C coverage before full-suite thresholds are checked.

The pilot selects two alphabetically first files from each of four categories: lifecycle, access, storage, and migrations. It compares A with B without enforcing full-suite coverage thresholds. The database-free smoke exercises the real reporter and the tooling tests.

## Local functionality checks

Previewing the measurement performs no test execution:

```sh
node scripts/ci-shard-diagnostics.mjs --stage full --round 2
pnpm vitest run --project tooling tests/tooling/scripts/ci-shard-diagnostics.test.ts tests/tooling/scripts/ci-shard-hook-diagnostics.test.ts
```

Tooling tests exercise child-process ordering, failure, timeout, interruption, cleanup, test selection, coverage equivalence, aggregate artifacts, and the actual Vitest reporter without Docker or environment provisioning. Integration execution is restricted to Linux GitHub runners on the experiment branch. Output directories must be new children of the ignored `tmp/ci-diagnostics` directory.

## Actions execution

Pushing diagnostic changes to the experiment branch runs smoke only. After registration, GitHub CLI dispatches pilot and full rounds against the branch. Each successful test process must also have complete hook timings before the next measurement starts. Wait for each run to finish successfully before dispatching the next; stop on any failed, interrupted, or incomplete round. A full paired job has a 180-minute timeout, the full A process 90 minutes, each shard process 45 minutes, and report validation 10 minutes.

```sh
gh workflow run ci-shard-diagnostics.yml --ref agent/ci-shard-diagnostics --field stage=pilot --field round=1
gh workflow run ci-shard-diagnostics.yml --ref agent/ci-shard-diagnostics --field stage=full --field round=1
```

Repeat full dispatch for rounds two and three only after the preceding round succeeds. Freeze the branch commit during the complete series. The workflow has read-only repository permissions, separate non-canceling concurrency, no deployments, and no shared compiler or package cache. The package token is present only during installation. Test services are disposable and confined to the job VM. Artifacts expire after seven days.

## BeforeAll phase experiment

The manual `hooks` stage runs Doctors Lifecycle, Clinic Registration Atomic, and Inquiry Retention Lifecycle, containing 13, 16, and 8 cases respectively. One job runs three repetitions on the same VM. Each repetition starts a new Vitest process and fresh services, rebuilds the empty database template, and deletes its Vite cache. File order rotates Doctors → Registration → Retention, Registration → Retention → Doctors, then Retention → Doctors → Registration. A custom sequencer fixes this order while preserving file isolation, serial execution and coverage instrumentation.

```sh
node scripts/ci-shard-diagnostics.mjs --stage hooks --round 2
gh workflow run ci-shard-diagnostics.yml --ref agent/ci-shard-diagnostics --field stage=hooks
```

The three selected `beforeAll` callbacks measure `getPayload()`, `ensureBaseline()`, and the remaining fixture creation separately. The baseline helper also records actual seed execution or a cache hit within the measured baseline call. Outside the opt-in diagnostic context, callbacks execute normally and the existing seed cache behavior is retained. Phase events use the captured native monotonic clock and contain relative file paths, phase names, durations and success status only.

Each repetition has a 15-minute process timeout; the job has a 60-minute timeout. A repetition is accepted only with all 37 passing cases, no skips or retries, the configured execution order, complete successful phase records and valid hook times. The job validates case identities and coverage equivalence after each repetition before starting the next. Full-suite coverage thresholds do not apply to this sample. Failed test processes, invalid measurements or failed cleanup stop later repetitions.

The report contains individual phase durations, seed invocation and cache-hit counts, and per-file phase medians and ranges. The residual subtracts the three outer phase durations from the total `beforeAll` time. Seed execution is nested inside the baseline phase and must not be added to it. The residual includes recording overhead; discrepancies below one millisecond are tolerated for clock precision. OS page caches and Docker images remain uncontrolled on the shared VM.

This experiment identifies the cost within the three selected files. It does not estimate whole-suite savings or change the database template, Payload instance lifetime, application APIs, test assertions, or regular PR validation. A dominant seeding cost supports a baseline-template experiment; a dominant Payload cost supports investigating safe instance reuse; expensive fixtures support narrower fixture creation. These are follow-up decisions, not changes performed by this measurement.

## Interpreting results

JSON measurements contain relative file paths, hashed case identities including their file-local positions, module diagnostics, worker-side hook durations, lifecycle markers, GNU time process metrics, and five-second host/Docker samples. They omit environment values, raw debug logs, test failure bodies, and package source files. Native C blobs are transferred for coverage merging; they contain Vitest result metadata and must not be treated as a reusable dependency cache.

Module duration includes tests and hooks; collection includes imports and suite callbacks. A diagnostic Vitest runner times hook phases inside each worker with a captured native monotonic clock and preserves the original runner callbacks. Fake timers and performance spies cannot replace the captured clock. These phases include empty-hook bookkeeping. Reporter delivery timestamps are unsuitable because Vitest can batch hook events. These overlapping metrics cannot be summed as independent costs. The manual hook experiment separates initialization calls inside the three selected callbacks; module collection remains a separate measurement. GNU time covers the test process tree, while Docker samples describe container usage separately.

The report compares median, minimum, and maximum across three rounds, paired B/A ratios, and file-level differences. Process time includes explicit service cleanup and native merge; it excludes VM startup and dependency installation. Collect GitHub job timestamps separately for actual runner-minute totals. C feedback spans the first measured C process through native merge completion, including report transfer and the collector's setup.

A successful comparison requires complete worker hook measurements, identical file and case selections with no duplicates, skipped or retried cases, matching covered and total coverage counts and coverage file sets, and passing aggregate thresholds. A timing difference alone does not establish its cause. Targeted follow-up measurements must isolate any remaining hypothesis before calling it proven.

## Serial baseline database copy experiment

The manual `db-copy` stage compares the existing empty-template setup and per-file seeds (D) with a prepared baseline template and a fresh PostgreSQL working database copy before each selected file (E). Both variants execute the same 37 cases used by the hook diagnostics, serially with existing file isolation and fixture cleanup. Three pairs run on one VM; pair order reverses in round 2 and file order rotates.

The seeded template exists in the job's local Postgres container. Its fingerprint must match before copying; the copied metadata must match before `ensureBaseline` skips seeding. Each copy drops only the isolated working test database. S3Mock persists within a variant, so fixture cleanup remains necessary. Normal integration runs still use the empty template and execute the seed helper.

Process times include cold services, migrations, template construction, seed execution, per-file copies, coverage reporting and cleanup. Coverage reports remain available. Moving seeding outside Vitest changes incidental coverage, so the report shows cross-variant deltas and checks repeatability within each variant. It does not claim identical coverage or whole-suite compatibility. A rollout needs broader integration validation and a decision about seed-related coverage.

Dispatch `ci-shard-diagnostics.yml` with stage `db-copy`. The job validates each completed pair before continuing and publishes `summary.md` with paired savings and copy times. A failed process, stale template, missing copy, changed cases or inconsistent repeated coverage invalidates the measurement.

### Measured three-file result

[Actions run 37315229150](https://github.com/findmydoc-platform/website/actions/runs/37315229150) validates three serial pairs at commit `988387c2a1b8c5da62cde8c147b7370a677ff785`. Each process passes the same 37 cases without skips or retries.

| Round | Empty template and file seeds | Baseline template and file copies | Savings |
| --- | ---: | ---: | ---: |
| 1 | 153.625 s | 98.836 s | 54.789 s |
| 2 | 142.532 s | 97.300 s | 45.232 s |
| 3 | 143.128 s | 97.652 s | 45.476 s |

Median paired savings are 45.476 seconds, about 32 percent for this sample, including template preparation and service cleanup. The three per-file copies cost 1.524 to 1.548 seconds combined. The complete comparison job consumes 12 minutes 46 seconds of physical runner time, including all six processes and shared job setup.

Each normal variant invokes the seed helper three times; each copy variant records three verified cache hits and no worker-side seed execution. Coverage repeats within each variant. Moving baseline seeding outside Vitest reduces covered lines from 1023 to 921 of 2490 in this sample. This is a measured coverage difference that must be addressed before changing normal integration CI. Whole-suite savings and compatibility remain unmeasured.

## Expanded serial copy comparison

The manual `db-copy-expanded` stage runs three mixed-file pairs before enabling the complete-suite job. The mixed selection contains 12 files covering the original lifecycle sample, mutable reference data, seed reset and Globals, storage recovery, content media, access and AuthActions. A checked-in manifest from the verified 98-file, 877-case run guards file and case counts. Each round uses matching file order in both variants; round 2 reverses the order and round 3 rotates it.

The copy variant builds its template through one explicitly included Vitest diagnostic seed case. That case asserts successful baseline seeding and populated reference collections. It does not run in normal integration discovery. Vitest's native blob merge combines seed and suite coverage; merge time is included in the copy total. Both repeated coverage and coverage file sets must match within each variant. Candidate coverage totals cannot decrease against the normal variant. Complete-suite results additionally enforce the existing integration thresholds. Coverage differences remain visible in the report.

Before every selected copy test file, a SQL probe verifies that the previous file's marker table did not survive the restore, then writes a new marker. PostgreSQL copies and SQL isolation checks are timed together. Existing per-test cleanup still handles S3Mock objects.

Each expanded pair uploads its evidence immediately after validation, so earlier results remain available while later pairs run. Partial reports state their repetition count.

The complete-suite job starts only after all mixed pairs pass. It runs three full serial pairs on one VM, with a 360-minute job limit and a 90-minute limit per test process. Any failed test, retry, missing copy, coverage regression or invalid native merge stops later pairs. A failed run's measurements remain diagnostic evidence, but cannot serve as an accepted correctness comparison. Normal CI, integration assertions and coverage thresholds are unchanged.

### Measured mixed-file result

[Actions run 37330179732](https://github.com/findmydoc-platform/website/actions/runs/37330179732) executes the expanded experiment at commit `59bb87163449fb0856079528b15bab391acd0737`. Round 1 passes the same 85 cases in 12 files in both variants. Including preparation, cleanup and native coverage merge, the normal variant takes 308.950 seconds and the copy variant 137.865 seconds. This pair saves 171.085 seconds, about 55 percent. Coverage is identical across all four categories, including 1454 covered lines of 2490. The instrumented seed and native merge close the coverage loss observed in the earlier three-file experiment.

In reversed round 2, the copy variant passes all 85 cases, while the normal variant fails three cases in `inquiryRetention.lifecycle.test.ts`. This pair is invalid for the accepted performance comparison. Round 3 and the complete-suite job are skipped. The mixed job consumes 14 minutes 54 seconds of physical runner time. Whole-suite savings remain unmeasured.

The manual `db-copy-order-check` stage reruns only the reversed mixed pair, without enabling the complete-suite job or accepting an incomplete series. Failed-case metrics contain positive line and column positions from the exact test module only. Error messages, assertion values, absolute paths and raw stacks remain excluded. This supports diagnosing order-dependent failures without weakening assertions or silently retrying failed measurements.

[Order-check run 37334117467](https://github.com/findmydoc-platform/website/actions/runs/37334117467) reproduces the three normal-variant failures at commit `6460299b596e6ee7ec4691717a414c44764cee4a`. The first two fail at the global zero-lock assertions, lines 336 and 658. The third fails at the patient reply restriction, line 1215. The copy variant again passes all 85 cases. SeedReset leaves its deliberately preserved command lock in the shared database; the failed hard-delete case then exits before offboarding its clinic staff fixture. SeedReset now tracks and deletes only its own preserved lock in `afterAll`, using the required domain transaction. Existing reset-preservation assertions remain unchanged. A fresh expanded series must validate this cleanup before whole-suite timing can be accepted.
