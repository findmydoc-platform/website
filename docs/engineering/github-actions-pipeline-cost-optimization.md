# Temporary GitHub Actions Pipeline Cost Optimization Report

This document is a temporary research handoff for reducing CI runtime, runner spend, and delayed developer feedback in the GitHub Actions pipeline. It is not a final implementation plan. Use it to decide where to inspect the current workflow topology, which checks should stay blocking, and which checks can move behind conditional routing, merge queue validation, `main`, nightly, or release gates.

## Decision frame

CI cost is a product of job count, runtime, runner type, parallelism, setup overhead, cache effectiveness, artifact retention, retries, and redundant runs. Faster feedback and lower cost are not the same goal: splitting one 20-minute job into five parallel 5-minute jobs improves feedback time, but it can keep or increase total billed compute because each job repeats setup and consumes runner minutes.

The target shape is a routed pipeline:

```text
Change detected
  -> classify changed paths and dependency risk
  -> run fast required checks
  -> run affected tests/builds only
  -> defer broad checks to merge queue, main, nightly, release, or manual dispatch
  -> track cost, duration, queue time, and failure signal per job
```

## What to inspect first

| Area | What to check | Why it matters |
| --- | --- | --- |
| Required checks | List branch-protection checks and compare them to `.github/workflows/*.yml`. | Required checks define the unavoidable PR cost floor. |
| Trigger breadth | Inspect `pull_request`, `push`, `schedule`, `workflow_dispatch`, `paths`, and `paths-ignore`. | Broad triggers often run expensive workflows for docs, config, or unrelated changes. |
| Duplicate setup | Count repeated checkout, Node, pnpm, install, typegen, and build setup across jobs. | Repeated setup is silent cost, especially when jobs are highly parallel. |
| Long jobs | Rank jobs by p50, p90, p95 duration and billed runner minutes. | Optimization should start with the largest cost and feedback contributors. |
| Queue time | Separate queued time from execution time. | Larger runners or more parallelism only help execution time; they do not fix trigger noise. |
| Failure value | Measure which jobs actually catch regressions before merge. | Expensive low-signal jobs should become conditional, informational, or scheduled. |
| Cache hit rate | Check dependency cache, build cache, Docker layer cache, and artifact reuse. | Poor cache keys can make every job reinstall and rebuild from scratch. |
| Artifact retention | Inspect artifact upload size and retention days. | Storage and transfer costs grow quietly on screenshot, coverage, build, and trace artifacts. |
| Retry patterns | Identify flaky tests and retried jobs. | Retries hide reliability problems while multiplying cost. |
| Runner class | Compare Linux, Windows, macOS, standard, larger, and self-hosted runner use. | Runner type can dominate cost even when runtime is stable. |

## Check routing matrix

| Change type | Required on PR | Conditional on PR | Defer or skip | Do not run when |
| --- | --- | --- | --- | --- |
| Documentation only | `pnpm format:check`, `pnpm docs:check` if docs are affected | Link or instruction checks for docs with repo policy impact | App build, unit tests, Storybook tests, integration tests, deploy preview | Only Markdown or docs assets changed and no runtime docs generation changed |
| GitHub workflow or scripts | `pnpm format:check`, `pnpm check`, `actionlint`, workflow security checks | Secret scan if workflow references env, tokens, permissions, or shell scripts | App E2E, Storybook UI, preview deploy unless deploy workflow behavior changed | The workflow change only affects comments, schedules, or documentation text with no execution semantics |
| Frontend component or route | `pnpm format:check`, `pnpm check`, affected build | Storybook/component tests, targeted Playwright/mobile screenshot QA | Backend integration tests unless route calls server behavior changed | CSS or visual copy change does not touch data fetching, routing, auth, forms, or shared layout |
| Payload collection, hook, API, schema | `pnpm format:check`, `pnpm check`, affected backend tests, build | Migration status/apply checks, integration tests, permission matrix checks | Broad UI visual tests unless user-facing UI changed | Only comments or docs near schema code changed |
| Access control, auth, secrets, permissions | `pnpm format:check`, `pnpm check`, targeted security tests, permission matrix validation | Semgrep/security reviewer, relevant E2E smoke | Cosmetic UI checks unrelated to protected flows | Never skip security-relevant validation solely because the changed file count is small |
| Dependency lockfile only | `pnpm format:check`, install integrity, `pnpm check` | Build and targeted tests based on dependency owner/risk | Full E2E for isolated dev-tool patch updates | Dependency is a dev-only patch with no runtime, build, test-runner, parser, or security effect |
| Runtime dependency | `pnpm format:check`, `pnpm check`, build, affected tests | Targeted integration/E2E for touched domains | Full suite unless dependency is core or impact is unknown | Never treat build alone as enough for runtime dependencies that affect validation, rendering, auth, persistence, dates, parsing, or API contracts |
| Framework/core dependency | `pnpm format:check`, `pnpm check`, build, broad unit/integration coverage | Playwright smoke, Storybook, deployment dry-run, security scan if relevant | Skip only unrelated docs checks | Next.js, React, Payload, TypeScript, database, auth, or runner version changes should not use a narrow gate |
| Release branch or merge queue | Required PR checks plus final merge-state checks | Broader smoke and deploy confidence checks | Experimental or deep hygiene checks unless release risk demands them | Do not duplicate every PR-only check if the merge queue already validates the final combined state |
| Nightly/deep quality | None as PR blockers | Broad hygiene, dependency audit, dead code, graph checks, full E2E/security | PR-blocking feedback | Do not make nightly-only checks required on every PR unless they are high-signal and fast |

## Optimization themes to investigate

### 1. Cost observability before rewiring

Create a cost and duration baseline before changing triggers. At minimum, collect workflow name, job name, event type, runner label, duration, queue time, conclusion, rerun count, artifact size, and whether the job was required for merge.

Recommended checks:

- Which workflows consume the most monthly runner minutes?
- Which jobs repeat install/build/typegen work?
- Which workflows run on both PR and push for the same commit?
- Which scheduled jobs are also running on every PR?
- Which artifacts are retained longer than their review value?

Do not optimize first by adding more parallelism. Parallelism improves feedback only after redundant work and cache misses are understood.

### 2. Required check pruning

Required checks should be limited to merge-critical correctness and deploy confidence. Advisory quality checks can still run, but should not block every PR by default.

Recommended checks:

- Is every required check fast enough to be a PR gate?
- Does every required check catch pre-merge regressions often enough to justify its cost?
- Are branch-protection check names stable when jobs are skipped?
- Are conditional jobs represented by a stable wrapper gate so path filtering does not leave required checks pending?

Do not require deep hygiene, broad dependency audits, coverage aggregation, or visual suites unless they are calibrated as high-signal merge gates.

### 3. Path and dependency routing

Use path filters as a first step and a dependency graph as the stronger long-term model. Path filters are simpler but can miss transitive impact; graph-based affected checks are better when package boundaries are explicit.

Recommended checks:

- Which paths imply runtime behavior changes?
- Which paths imply docs-only or configuration-only changes?
- Which shared modules fan out into many dependents?
- Which dependency updates should mark all projects affected?
- Which files are global inputs, such as lockfiles, TypeScript config, Payload config, environment schema, or build tooling?

Do not use a narrow path filter for shared runtime files unless their downstream impact is explicitly modeled.

### 4. Caching and setup reuse

Cache dependency downloads, build outputs, Docker layers, and task outputs where deterministic. Remote cache can reduce both PR feedback time and repeated CI work across branches.

Recommended checks:

- Are pnpm store cache keys based on the lockfile and Node version?
- Are `.next`, Storybook, test, or typegen outputs cacheable without stale-state risk?
- Are jobs reinstalling dependencies independently when a workspace/artifact would be enough?
- Are cache misses caused by overly broad keys, unstable env inputs, or generated output in inputs?
- Are Docker base images rebuilt or pulled repeatedly?

Do not depend on cache for correctness. A cache miss must still produce the same result, only slower.

### 5. Test selection and splitting

Run cheap deterministic tests early. Split slow suites by historical duration when the whole suite is required. Select tests by changed code when dependency mapping is reliable.

Recommended checks:

- Which tests are slowest and most flaky?
- Which tests catch unique failures versus duplicate build/typecheck failures?
- Which suites can be split by timing data?
- Which suites can be selected by affected modules?
- Which high-risk flows deserve small always-on smoke coverage?

Do not hide flaky tests behind retries without tracking them. Retries should be bounded and visible.

### 6. Trigger cancellation and concurrency

Cancel obsolete PR runs when a newer commit arrives. Serialize deployments and destructive environment jobs. Keep `main` and release jobs conservative where cancellation could remove useful evidence.

Recommended checks:

- Does each PR workflow use a concurrency group scoped to PR or branch?
- Are old PR runs canceled on new commits?
- Are deployment jobs serialized per environment?
- Are expensive manual or scheduled workflows protected from accidental overlap?

Do not cancel jobs that mutate external state unless cleanup and idempotency are proven.

### 7. Runner right-sizing

Use cheaper Linux runners by default. Use larger runners only when the shorter runtime offsets the higher per-minute rate or when memory/CPU limits otherwise cause failures.

Recommended checks:

- Which jobs are CPU-bound, IO-bound, network-bound, or memory-bound?
- Does a larger runner reduce billed cost or only wall-clock time?
- Are macOS or Windows runners used only where platform coverage is required?
- Are self-hosted runners actually cheaper after maintenance, idle capacity, and platform fees?

Do not assume self-hosted or larger runners reduce cost without measured utilization and total ownership cost.

### 8. Merge queue and post-merge safety net

PR checks validate a branch; merge queues validate the final combined state. Full suites can move to merge queue, `main`, nightly, or release when PR feedback remains protected by targeted checks.

Recommended checks:

- Are merge queue temporary refs covered by workflow triggers?
- Which checks must run on `merge_group` rather than every PR update?
- Which checks can run after merge with fast revert/rollback confidence?
- Which checks should run nightly to detect drift rather than block every PR?

Do not remove a PR gate unless another gate catches the same risk at an acceptable time.

## Candidate repo-specific questions

- Can `deploy.yml` keep only fast merge-critical PR validation while deeper hygiene stays in `deep-quality-lane.yml`?
- Can integration tests remain path-targeted and run broadly on `main` or merge queue?
- Can dependency health workflows avoid duplicating `pnpm check` and build work already covered by PR validation?
- Can docs-only changes avoid runtime build and test jobs while still satisfying branch protection through stable lightweight gates?
- Can workflow-security checks remain path-scoped without leaving required checks pending?
- Can preview deployment skip for docs-only, instruction-only, or CI-only changes?
- Can artifact retention be shortened for screenshots, traces, and coverage outputs that are only useful during review?

## Source notes

| Source | Relevance |
| --- | --- |
| [GitLab Pipeline efficiency](https://docs.gitlab.com/ci/pipelines/pipeline_efficiency/) | Explains pipeline efficiency as a way to reduce cost, developer waiting time, and feedback-loop length. |
| [GitLab caching](https://docs.gitlab.com/ci/caching/) | Documents cache behavior and cache management for avoiding repeated dependency and build work. |
| [GitLab job rules and changes](https://docs.gitlab.com/ci/jobs/job_rules/) | Shows how jobs can run only for relevant changed paths, including matrix-specific routing. |
| [GitLab matrix expressions](https://docs.gitlab.com/ci/yaml/matrix_expressions/) | Describes dynamic dependencies between matrix jobs, useful for avoiding manually duplicated job graphs. |
| [GitLab resource groups](https://docs.gitlab.com/ci/resource_groups/) | Shows how to serialize deployment or shared-resource jobs while leaving safe jobs parallel. |
| [GitLab YAML reference](https://docs.gitlab.com/ci/yaml/) | Covers `interruptible` and workflow controls that affect cancellation and redundant pipeline cost. |
| [GitLab auto-cancel support](https://support.gitlab.com/hc/en-us/articles/22118112967068-How-to-auto-cancel-redundant-pipelines) | Gives the operational path for canceling redundant branch pipelines. |
| [GitLab merge trains](https://docs.gitlab.com/ci/pipelines/merge_trains/) | Documents validating queued merge requests together so PR checks do not need to prove every combined-state scenario alone. |
| [GitLab pipeline types](https://docs.gitlab.com/ci/pipelines/pipeline_types/) | Clarifies differences between merge request, merged-result, and merge-train pipelines for check placement. |
| [GitHub Actions billing](https://docs.github.com/billing/managing-billing-for-github-actions/about-billing-for-github-actions) | Defines how Actions usage, minutes, storage, and runner billing are measured. |
| [GitHub Actions runner pricing](https://docs.github.com/en/billing/reference/actions-runner-pricing) | Gives per-runner pricing context, including cost differences by operating system and runner size. |
| [GitHub Actions concurrency](https://docs.github.com/enterprise-cloud%40latest/actions/using-jobs/using-concurrency) | Documents canceling in-progress runs in the same concurrency group to avoid paying for obsolete PR checks. |
| [GitHub workflow syntax](https://docs.github.com/actions/using-workflows/workflow-syntax-for-github-actions) | Documents branch and path filters, which are the baseline mechanism for conditional workflow routing. |
| [GitHub triggering workflows](https://docs.github.com/actions/using-workflows/triggering-a-workflow) | Explains trigger interactions and path filtering behavior for avoiding unwanted workflow starts. |
| [GitHub skipping workflow runs](https://docs.github.com/actions/managing-workflow-runs/skipping-workflow-runs) | Warns that skipped required workflows can remain pending, which matters when pruning PR checks. |
| [GitHub larger runners](https://docs.github.com/actions/using-github-hosted-runners/about-larger-runners/about-larger-runners) | Explains larger runner billing and when higher-capacity runners may or may not lower cost. |
| [GitHub hosted runners](https://docs.github.com/actions/using-github-hosted-runners/about-github-hosted-runners) | Documents hosted runner capabilities and custom image constraints that influence setup cost. |
| [GitHub merge queue](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue) | Shows how required checks can validate the combined target-branch state before merge. |
| [actions/setup-node](https://github.com/actions/setup-node) | Documents built-in dependency caching for npm, yarn, and pnpm in GitHub Actions. |
| [GitHub setup-node pnpm changelog](https://github.blog/changelog/2021-09-07-github-actions-setup-node-supports-dependency-caching-for-projects-with-monorepo-and-pnpm-package-manager/) | Confirms pnpm and monorepo dependency cache support in setup-node. |
| [pnpm continuous integration](https://pnpm.io/continuous-integration) | Provides pnpm-specific CI install and cache guidance across providers. |
| [CircleCI credits](https://circleci.com/docs/guides/plans-pricing/credits/) | Explains credit-based compute accounting and the cost effect of dependency caching, artifacts, and workspaces. |
| [CircleCI pricing](https://circleci.com/pricing/) | Provides current pricing framing for credits and compute consumption. |
| [CircleCI optimization reference](https://circleci.com/docs/guides/optimize/optimizations/) | Covers Docker layer caching and other build-time optimization mechanisms. |
| [CircleCI caching](https://circleci.com/docs/guides/optimize/caching/) | Emphasizes cache reliability tradeoffs and warns against treating cache as correctness. |
| [CircleCI test splitting and parallelism](https://circleci.com/docs/guides/optimize/parallelism-faster-jobs/) | Shows how to reduce feedback time by splitting test work across parallel executors. |
| [CircleCI test splitting tutorial](https://circleci.com/docs/guides/test/test-splitting-tutorial/) | Gives practical setup details for test parallelism and timing-based splitting. |
| [CircleCI CLI test splitting](https://circleci.com/docs/guides/optimize/use-the-circleci-cli-to-split-tests/) | Documents CLI-based splitting, relevant for test-suite sharding design. |
| [CircleCI dynamic config](https://circleci.com/docs/guides/orchestrate/dynamic-config/) | Shows how path filtering can prevent unrelated services from running full pipelines. |
| [CircleCI using dynamic configuration](https://circleci.com/docs/guides/orchestrate/using-dynamic-configuration/) | Gives monorepo examples for routing workflows based on changed paths. |
| [CircleCI dependency caching best practices](https://circleci.com/blog/config-best-practices-dependency-caching/) | Describes dependency caching as a way to reduce wasted minutes and improve feedback. |
| [CircleCI intelligent test splitting](https://circleci.com/blog/intelligent-ci-cd-with-circleci-test-splitting/) | Explains timing-based splitting as a practical way to balance parallel test nodes. |
| [Nx affected](https://nx.dev/docs/features/ci-features/affected) | Documents running tasks only for projects affected by a PR. |
| [Nx run tasks](https://nx.dev/docs/features/run-tasks) | Covers task execution, parallelism, and caching in Nx workspaces. |
| [Nx affected graph](https://nx.dev/blog/ci-affected-graph) | Explains graph-based affected detection as an alternative to running every task in a monorepo. |
| [Turborepo constructing CI](https://turborepo.dev/docs/crafting-your-repository/constructing-ci) | Documents remote caching setup for faster CI task reuse. |
| [Turborepo caching](https://turborepo.dev/docs/crafting-your-repository/caching) | Explains task output caching and cache fingerprints. |
| [Turborepo configuration](https://turborepo.dev/docs/reference/configuration) | Defines task inputs, outputs, dependencies, and environment keys that determine cache correctness. |
| [Bazel user manual](https://bazel.build/docs/user-manual) | Provides the command model for targeted builds and tests in graph-based build systems. |
| [Bazel command reference](https://bazel.build/reference/command-line-reference) | Documents target and test filtering options that support selective execution. |
| [Pants build system](https://www.pantsbuild.org/) | Positions Pants as a graph-based build system for scalable codebases and CI. |
| [Pants in CI](https://www.pantsbuild.org/dev/docs/using-pants/using-pants-in-ci) | Covers CI usage and automatic test retries for flaky test mitigation. |
| [Pants required-check path filtering article](https://www.pantsbuild.org/blog/2022/10/10/skipping-github-actions-jobs-without-breaking-branch-protection) | Explains why naive path filtering can conflict with required GitHub checks. |
| [Buildkite monitoring and observability](https://buildkite.com/docs/pipelines/best-practices/monitoring-and-observability) | Recommends tracking build duration, queue time, success rate, and retry behavior. |
| [Buildkite Test Engine](https://buildkite.com/docs/pipelines/speed-up-builds-with-bktec) | Documents timing-based test splitting and rebalancing for faster critical paths. |
| [Buildkite retry](https://buildkite.com/docs/pipelines/configure/retry) | Covers automatic and manual retry controls for transient failures. |
| [Buildkite Elastic case study](https://buildkite.com/resources/case-studies/elastic/) | Gives a real case study where CI runtime and cloud spend were reduced materially. |
| [Semaphore CI/CD cost optimization](https://semaphore.io/blog/cicd-costs-optimization) | Summarizes practical cost reducers: caching, fail-fast, auto-cancel, and conditional jobs. |
| [Bitbucket step options](https://support.atlassian.com/bitbucket-cloud/docs/step-options/) | Documents step-level execution units and customization levers for pipeline cost control. |
| [Bitbucket parallel steps](https://support.atlassian.com/bitbucket-cloud/docs/parallel-step-options/) | Shows how parallel steps can reduce wall-clock time while still needing cost analysis. |
| [Microsoft Test Impact Analysis](https://learn.microsoft.com/en-us/azure/devops/pipelines/test/test-impact-analysis?view=azure-devops) | Documents incremental validation through automatic test selection. |
| [Microsoft DevOps Test Impact Analysis blog](https://devblogs.microsoft.com/devops/accelerated-continuous-testing-with-test-impact-analysis-part-1/) | Gives background on using test impact analysis to accelerate continuous testing. |
| [Meta predictive test selection](https://engineering.fb.com/2018/11/21/developer-tools/predictive-test-selection/) | Describes ML-based regression test selection to reduce CI work while preserving failure detection. |
| [Meta Research predictive test selection](https://research.facebook.com/publications/predictive-test-selection/) | Provides the research framing behind selecting a subset of tests per change. |
| [Google-scale continuous testing paper](https://research.google.com/pubs/archive/45861.pdf) | Explains large-scale continuous testing constraints, including workload control and flaky-test limits. |
| [Google Testing Blog on flaky tests](https://testing.googleblog.com/2016/05/flaky-tests-at-google-and-how-we.html) | Documents flaky test impact and why unreliable tests reduce CI signal. |
| [Software Engineering at Google: Continuous Integration](https://abseil.io/resources/swe-book/html/ch23.html) | Describes Google's CI model and the separation of fast presubmit and broader continuous testing. |
| [DORA metrics](https://dora.dev/guides/dora-metrics/) | Provides delivery-performance metrics for evaluating whether CI changes improve throughput and stability. |
| [Google Cloud Four Keys](https://cloud.google.com/blog/products/devops-sre/using-the-four-keys-to-measure-your-devops-performance) | Connects DORA measurement to practical engineering-system observability. |
| [Harness CI/CD cost awareness](https://www.harness.io/blog/cost-awareness-in-ci-cd-pipelines-a-finops-guide) | Frames CI/CD pipeline cost as a FinOps feedback-loop and budget-governance problem. |

## Temporary use guidance

Use this document as a checklist before editing workflow YAML:

1. Build a baseline from current workflow durations, billable minutes, queue time, and required-check status.
2. Decide which risks must remain PR-blocking.
3. Add routing only where the risk boundary is explicit.
4. Keep a stable required wrapper check when path filtering would otherwise skip a required job.
5. Re-measure cost, feedback time, and escaped failures after every CI change.

