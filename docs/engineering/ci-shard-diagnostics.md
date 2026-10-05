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
