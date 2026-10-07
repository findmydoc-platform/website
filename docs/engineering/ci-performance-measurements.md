# CI performance measurements

Measurements on 4 October 2026 show shorter integration and frontend feedback times for the candidate workflows. The compiler cache experiment does not demonstrate a benefit and is excluded from the change.

## Method

The integration and frontend comparisons use identical application sources and dependencies from `eda78ba87601db5f00fe8c218ce1acd36e6b0b1d`, Node 24.14.0, pnpm 10.28.2, and separate `ubuntu-latest` GitHub runners. Integration jobs use the existing isolated database and storage harness. No deployment steps run in these experiments.

Times come from GitHub job timestamps and include setup, dependency installation, artifact transfer, and cleanup. Integration elapsed time spans the first shard start through the coverage merge job completion. Frontend elapsed time spans the shared scope job completion through the last Static Checks, Unit Tests, Storybook Tests, or Build result. The frontend comparison omits coverage publication in both variants and has no integration scope.

Each comparison is one measurement. Runner hardware and startup times vary, so the percentages describe these runs rather than a guarantee for every PR. Temporary measurement branches are removed after completion; the linked runs retain their workflow definitions and results.

## Integration

[Complete integration comparison](https://github.com/findmydoc-platform/website/actions/runs/37221968450) runs the original serial integration command alongside four native Vitest shards and the report merge.

| Measurement | Serial | Four shards and merge |
| --- | ---: | ---: |
| Elapsed time | 27:15 | 14:28 |
| Sum of job runner time | 27:15 | 47:22 |
| Passed test files | 98 | 98 |
| Passed tests | 877 | 877 |
| Coverage files | 102 | 102 |

Elapsed time falls by 46.9%. Runner time rises by 73.8% in this run. Parallel execution improves feedback time while increasing compute use.

The shard reports contain 25, 25, 24, and 24 files with no overlap. Their union matches the serial run's file list. Both coverage artifacts have identical totals and covered counts for lines, statements, functions, and branches:

| Coverage | Both variants |
| --- | ---: |
| Lines | 80.80% |
| Statements | 77.24% |
| Functions | 74.82% |
| Branches | 71.35% |

The merge retains the existing full-suite coverage thresholds. Individual shards do not enforce aggregate thresholds.

## Frontend feedback

[Frontend dependency comparison](https://github.com/findmydoc-platform/website/actions/runs/37223420886) runs the same validation jobs with the original Build dependencies and with Build depending only on scope classification. Both variants pass every included check.

| Measurement | Build waits for tests | Build starts after scope |
| --- | ---: | ---: |
| All included check results available | 8:13 | 3:33 |
| Build job duration | 3:33 | 3:29 |

Feedback arrives 56.8% sooner. The improvement comes from removing the dependency wait; application build duration remains similar.

## Build routing

[Pinned paths-filter comparison](https://github.com/findmydoc-platform/website/actions/runs/37223337268) evaluates the original and candidate filters against the same commit differences.

| Changes | Original build filter | Candidate build filter |
| --- | --- | --- |
| Workflow, test, and metadata files only | Build required | Build skipped |
| Same changes plus a runtime source change | Build required | Build required |

The original filter combines `**` and exclusions with the action's default `some` predicate. The candidate uses `every` so exclusions take effect. CI and Preview consume the same filter file. Unknown paths require a build; manual runs still force full validation. The experiment verifies classification and does not measure Preview deployment time.

## Compiler cache experiment

The [build comparison](https://github.com/findmydoc-platform/website/actions/runs/37221968450) includes fresh runners, cache restore/save, and an incremental source comment change.

| Variant | Complete job | Build step |
| --- | ---: | ---: |
| No compiler cache | 2:27 | 1:30 |
| Populate compiler cache | 3:32 | 2:23 |
| Restore exact cache | 3:40 | 2:28 |
| Restore cache after a source change | 3:43 | 2:28 |

A cache hit is confirmed, but this sample does not show shorter build time. The proposal also conflicts with the [private package cache boundary](transactional-email-platform-foundation.md), because compiler caches can contain code from the private email package. The three experimental compiler caches are deleted. The candidate retains the existing Playwright cache and introduces no additional Actions cache.

## Candidate validation and scope

The [complete candidate PR Validation run](https://github.com/findmydoc-platform/website/actions/runs/37222706993) passes Static Checks, Unit Tests, Storybook Tests, Build, all four integration shards, the integration merge, and combined coverage. Locally, 80 focused tooling tests, `pnpm check`, `pnpm format`, `actionlint`, and the secrets baseline check pass.

The candidate adds full integration coverage at 02:17 UTC nightly, using the same shards and coverage gate. Scheduled runs skip the other validation jobs and have a separate concurrency group from Main pushes. The schedule becomes active after the workflow reaches the default branch. Adding nightly coverage alone does not reduce PR work.

Change-specific integration selection remains in [issue #2049](https://github.com/findmydoc-platform/website/issues/2049). CI and Preview builds remain separate. Webpack remains selected while [Turbopack issue #777](https://github.com/findmydoc-platform/website/issues/777) is open.
