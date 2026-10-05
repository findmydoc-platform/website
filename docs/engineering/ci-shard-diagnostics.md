# Integration shard diagnostics

The experiment compares one full integration process, four sequential shards on the same VM, and four parallel shards on separate VMs. Diagnostic code lives on `agent/ci-shard-diagnostics`; existing validation and deployment workflows are unchanged.

## Measurement protocol

Each full round runs A and B on one VM. Rounds one and three run A before B; round two runs B before A. C starts after the paired job succeeds. Three complete rounds run consecutively against one immutable experiment commit. The source fingerprint covers application sources, integration tests, dependency manifests, coverage configuration, Vitest configuration, and test service configuration.

Every measured process starts with fresh PostgreSQL and S3Mock services, rebuilt database templates, and its own empty Vite cache directory. Dependencies remain installed. Filesystem page caches and VM performance are uncontrolled; reversed order and paired ratios reduce their influence without eliminating it. All integration variants use the same diagnostic and blob reporters with V8 coverage enabled. Native Vitest merging combines B and C coverage before full-suite thresholds are checked.

The pilot selects two alphabetically first files from each of four categories: lifecycle, access, storage, and migrations. It compares A with B without enforcing full-suite coverage thresholds. The database-free smoke exercises the real reporter and the tooling tests.

## Local functionality checks

Previewing the measurement performs no test execution:

```sh
node scripts/ci-shard-diagnostics.mjs --stage full --round 2
pnpm vitest run --project tooling tests/tooling/scripts/ci-shard-diagnostics.test.ts
```

Tooling tests exercise child-process ordering, failure, timeout, interruption, cleanup, test selection, coverage equivalence, aggregate artifacts, and the actual Vitest reporter without Docker or environment provisioning. Integration execution is restricted to Linux GitHub runners on the experiment branch. Output directories must be new children of the ignored `tmp/ci-diagnostics` directory.

## Actions execution

Pushing diagnostic changes to the experiment branch runs smoke only. After registration, GitHub CLI dispatches pilot and full rounds against the branch. Wait for each run to finish successfully before dispatching the next; stop on any failed, interrupted, or incomplete round. A full paired job has a 180-minute timeout, each parallel shard 45 minutes, and report validation 10 minutes.

```sh
gh workflow run ci-shard-diagnostics.yml --ref agent/ci-shard-diagnostics --field stage=pilot --field round=1
gh workflow run ci-shard-diagnostics.yml --ref agent/ci-shard-diagnostics --field stage=full --field round=1
```

Repeat full dispatch for rounds two and three only after the preceding round succeeds. Freeze the branch commit during the complete series. The workflow has read-only repository permissions, separate non-canceling concurrency, no deployments, and no shared compiler or package cache. The package token is present only during installation. Test services are disposable and confined to the job VM. Artifacts expire after seven days.

## Interpreting results

JSON measurements contain relative file paths, hashed case identities, module diagnostics, worker-side hook durations, lifecycle markers, GNU time process metrics, and five-second host/Docker samples. They omit environment values, raw debug logs, test failure bodies, and package source files. Native C blobs are transferred for coverage merging; they contain Vitest result metadata and must not be treated as a reusable dependency cache.

Module duration includes tests and hooks; collection includes imports and suite callbacks. A diagnostic Vitest runner times hook phases inside each worker and preserves the original runner callbacks. These phases include empty-hook bookkeeping. Reporter delivery timestamps are unsuitable because Vitest can batch hook events. These overlapping metrics cannot be summed as independent costs. Payload initialization remains within collection or hooks until a targeted follow-up instruments it separately. GNU time covers the test process tree, while Docker samples describe container usage separately.

The report compares median, minimum, and maximum across three rounds, paired B/A ratios, and file-level differences. Process time includes explicit service cleanup and native merge; it excludes VM startup and dependency installation. Collect GitHub job timestamps separately for actual runner-minute totals. C feedback spans the first measured C process through native merge completion, including report transfer and the collector's setup.

A successful comparison requires complete worker hook measurements, identical file and case selections with no duplicates, skipped or retried cases, matching covered and total coverage counts and coverage file sets, and passing aggregate thresholds. A timing difference alone does not establish its cause. Targeted follow-up measurements must isolate any remaining hypothesis before calling it proven.
