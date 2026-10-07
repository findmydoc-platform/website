# Remaining non-integration pipeline cost

Research snapshot, 7 October 2026. The best remaining candidates remove complete browser-test jobs for demonstrably irrelevant changes. Repeated setup and coverage publication are much smaller. None of the recommendations below has a measured marginal saving yet.

## Scope and evidence

This report reads two distinct states:

- The experiment worktree is `agent/ci-shard-diagnostics` at `822c3f42265f721a0318398e3833b2430dfdd09f`. Its committed PR Validation workflow retains the older serial integration and late Build DAG.
- The primary checkout is based on `eda78ba87601db5f00fe8c218ce1acd36e6b0b1d`, with concurrent uncommitted implementation changes. Its intended PR Validation already starts Build after classification, uses the shared *.github/filters/build.yml*, adds four integration shards and report merging, and adds integration-only nightly validation. Preview uses the same build filter. These changes were read, not modified. Source locations below explicitly marked “primary snapshot” refer to that uncommitted state, not an available GitHub revision.

The [optimization results](../research/ci-optimization-poc.md) and the primary checkout's *docs/engineering/ci-performance-measurements.md* describe different experiment series. The latter's earlier frontend-only scheduling comparison does not establish a full integration workflow saving. Early Build, build filtering, DB copies, parallel integration, and package/compiler cache gains receive no new savings credit here.

Existing raw evidence under `tmp/ci-diagnostics` in the primary checkout was read without modification. Three receipts checked were `build-poc-continuation/schedule-1/schedule-runtime-1-baseline-none/jobs.json`, `schedule-2/schedule-runtime-2-baseline-none/jobs.json`, and `filter/filter-tests-1-baseline-none/jobs.json`. Their [runs](https://github.com/findmydoc-platform/website/actions/runs/37466481156), [second repetition](https://github.com/findmydoc-platform/website/actions/runs/37479496865), and [test-only control](https://github.com/findmydoc-platform/website/actions/runs/37466847160) show Storybook jobs of 209, 247, and 193 seconds and dependency installs of 11–15 seconds in the inspected non-integration jobs. Diagnostic classification and result-wrapper jobs are not normal-CI costs.

Read-only GitHub CLI queries supplied normal-CI job and step timestamps. No workflow dispatch, test, commit, deployment, or formal review ran. Only this report was written and formatted.

Physical runner time is the sum of executed job durations, excluding skipped jobs and queue time. Critical-path time is elapsed dependency/queue time until the required results finish. Billing is separate: GitHub rounds each physical job up to whole minutes, and standard hosted runners in public repositories have no execution charge. These measurements cannot be converted into exact billed savings. See [job execution accounting](https://docs.github.com/en/actions/how-tos/monitor-workflows/view-job-execution-time) and [runner pricing](https://docs.github.com/en/billing/reference/actions-runner-pricing).

## Observed normal-CI costs

The four PR samples and two Main samples below were selected for successful, recent runs, not as a representative monthly population. Durations are whole physical jobs, including setup and cleanup.

| Run | Event | Static | Unit | Storybook | Build | Combined coverage |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| [37451625426](https://github.com/findmydoc-platform/website/actions/runs/37451625426) | PR | 118 s | 188 s | 279 s | 212 s | 17 s |
| [37466739412](https://github.com/findmydoc-platform/website/actions/runs/37466739412) | PR | 97 s | 203 s | 246 s | 191 s | 14 s |
| [37460604496](https://github.com/findmydoc-platform/website/actions/runs/37460604496) | PR | 117 s | 213 s | 302 s | 206 s | 15 s |
| [37450551064](https://github.com/findmydoc-platform/website/actions/runs/37450551064) | PR | 120 s | 162 s | 289 s | 209 s | 18 s |
| [37468547135](https://github.com/findmydoc-platform/website/actions/runs/37468547135) | Main | 88 s | 169 s | 308 s | 222 s | 22 s |
| [37461879253](https://github.com/findmydoc-platform/website/actions/runs/37461879253) | Main | 99 s | 137 s | 279 s | 209 s | 20 s |

Integration durations are deliberately omitted. These historical runs do not execute the future DB-copy/shard combination. Non-integration job envelopes remain useful opportunity bounds after DB copies because these candidates do not remove or accelerate integration work. Their exact future durations and eligibility frequencies remain unknown.

In the primary snapshot, Static, Unit, and Storybook depend on Path Filter. Build also depends only on Path Filter. Integration follows Static, with its own shard merge. Combined Coverage waits for Unit, Storybook, and Integration and skips scheduled runs. Sources: primary snapshot `.github/workflows/deploy.yml`, lines 107–109, `197–199`, `260–262`, `333–338`, `403–413`, `468–471`, and `547–553`. Thus removing Storybook no longer shortens Build's dependency wait. It only shortens whole validation if Storybook or its coverage tail is on the remaining critical path. There is no measured post-DB-copy full-DAG result proving that condition.

## Ranked recommendations, all unproven

| Rank | Candidate | Observed removable work and ceiling | Confidence | Complexity and validation scope | Cheapest next validation |
| --- | --- | --- | --- | --- | --- |
| 1 | Skip the whole Storybook job when no story, component, configuration, or transitive input is affected | 4:06–5:08 per eligible run is the observed whole-job ceiling. Zero is the defensible lower bound before relevance is established. No monthly estimate. | High that the job is a minutes-scale cost; medium-low that many changes are safely irrelevant | Low to medium for conservative whole-job routing and stable result handling; higher for a complete dependency graph | Read existing merged PR file lists and trace story imports for a few proposed negative examples; compare against known frontend/shared changes. No Actions experiment needed first |
| 2 | Classify Admin and Public E2E separately rather than sending both to every selected runtime change | One excluded lane has an observed 3:29–4:55 ceiling in two runs. Both together cost 7:53–8:30, but skipping both is not justified by these measurements | High on cost; low on safe lane separation | Medium, potentially high if shared state prevents separation; dependency mapping and stable gate outcomes need validation | Inspect existing E2E test routes, shared authentication/middleware, and changed-file lists. Find one genuinely unrelated change for each lane before changing routing |
| 3 | Reuse completed Static/Unit/Storybook results for an exactly equivalent merged Main tree | Main repeats 8:35–9:25 of these three jobs in the two samples. This is a maximum envelope for an eligible merge, not demonstrated duplicate work or expected saving | High on repeated execution; low on identical validated inputs and policy eligibility | High; trusted provenance, input equivalence and branch/release policy are unresolved | Compare one successful PR's actual tested merge-tree hash with the resulting Main tree, dependencies and workflow revision. Stop if equivalence or check provenance cannot be proved |

Complexity is assessed through dependencies and validation scope, without calendar estimates. Candidate envelopes overlap: a Storybook job excluded by rank 1 cannot also be counted as reused by rank 3. Do not add the rows or combine them with independently measured optimization medians.

### Storybook relevance

The primary snapshot of `.github/workflows/deploy.yml` at lines 260–262 still routes Storybook using general non-Markdown validation, not a Storybook-specific scope. [Vitest configuration](../../vitest.config.ts#L244), lines 244–286, selects Chromium browser tests through the Storybook addon. [Storybook configuration](../../.storybook/main.ts#L8), lines 8–15 and 37–45, discovers stories across `src` and supplies shared mocks and aliases. Coverage includes component sources at [vitest.config.ts:96–99](../../vitest.config.ts#L96). A backend-looking path is not automatically irrelevant because a story can import shared code or generated types.

The [official addon documentation](https://storybook.js.org/docs/writing-tests/integrations/vitest-addon) explains that stories become browser tests. PR Validation invokes this directly; it does not build `storybook-static` first. Consequently, reusing a static Storybook deployment build does not remove the observed browser test execution.

A conservative first candidate should retain full execution for dependencies, Storybook/Vitest configuration, shared frontend inputs, unknown paths, and dependency-graph failures. Preserve existing scope coverage and distinguish an explicit irrelevant-job skip from a claimed coverage pass. Test-only changes are not automatically irrelevant to the shared setup.

### Browser smoke lanes

[Admin E2E workflow](../../.github/workflows/admin-e2e-smoke.yml#L38), lines 38–75, selects a broad union of runtime, assets, tests, test infrastructure, configuration, and dependencies. Both [Admin](../../.github/workflows/admin-e2e-smoke.yml#L91), lines 91–96, and Public, lines 156–163, consume that same result.

[Run 37508854828](https://github.com/findmydoc-platform/website/actions/runs/37508854828) uses 215 seconds for Admin and 295 for Public. [Run 37501113597](https://github.com/findmydoc-platform/website/actions/runs/37501113597) uses 264 and 209 seconds. Actual smoke steps consume 179/244 and 214/164 seconds; artifact uploads take only 1–2 seconds each. These are application/browser jobs, not integration internals. Public also waits for Admin at `admin-e2e-smoke.yml:159–161`, so these lanes form a serial dependency chain, with additional queue gaps. Independent execution might shorten that workflow without reducing physical runner consumption; shared staging and test-state independence are unproved. Any separate selection must handle the dependency when Admin is intentionally skipped, or it could suppress required Public tests. Their tested dependencies have not been mapped here. Disabling a lane for a relevant change would defer risk detection, not establish zero affected tests.

### Main equivalence

[Committed trigger definitions](../../.github/workflows/deploy.yml#L10), lines 10–23, include PRs and Main pushes. The primary snapshot retains both. This is not duplicate `push` plus PR validation on every feature-branch update; feature-branch pushes do not trigger this workflow.

A successful PR and its merged Main run often validate different commit identities. GitHub documents the PR merge reference in [workflow event semantics](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request). Matching titles or head SHAs alone is insufficient. Reuse needs proven identical tested inputs, completed successful checks, policy acceptance and a fallback full run. Removing Main checks unconditionally would reduce post-merge detection and is not recommended. Build, deployment, and all integration costs are excluded from this candidate bound.

## Lower-priority or blocked options

- Repeated dependency setup is small here. The four non-integration install steps total 54–62 seconds per sampled run. That is an impossible-to-exceed install-only removal envelope, not expected net savings. Combining jobs adds serialization or CPU contention; sharing installed dependencies adds packaging and transfer. Already proved pnpm-cache gains get no second credit. Prioritize complete irrelevant jobs over a new setup-sharing experiment.
- Coverage aggregation is 14–22 seconds in normal CI, with summary merging 0–1 seconds. It already installs no project dependencies. Deleting publication or reducing retention does not remove minutes of compute. The primary snapshot of `.github/workflows/deploy.yml` at lines 547–624 retains it only for non-scheduled runs. Keep scope reporting correct; no new aggregation infrastructure is justified by these samples.
- Browser cache tuning is seconds-scale. Normal Storybook restores take 6–11 seconds, post-cache work 8–11 seconds, and observed misses install Chromium in 9–10 seconds. [Playwright advises against browser caching when restore costs resemble downloads](https://playwright.dev/docs/ci#caching-browsers). This observation supports a cheap later comparison, not a medium/large saving claim.
- Storybook deployment already costs only 62–63 seconds in [run 37461879192](https://github.com/findmydoc-platform/website/actions/runs/37461879192) and [run 37468547190](https://github.com/findmydoc-platform/website/actions/runs/37468547190). Its broad [source trigger](../../.github/workflows/deploy-storybook.yml#L4), lines 4–11, may admit irrelevant changes, but the economic envelope is about one minute per eligible Main push. The build step itself takes 33 seconds. It is separate from PR browser tests.
- CI and Preview both compile the application, but their outputs are not proven interchangeable. The primary snapshot of `.github/workflows/deploy.yml` at lines 339–393 uses a development build with a local migrated database. [Preview deployment script](../../.github/scripts/deploy/vercel-deploy.sh#L90), lines 90–102, uses the pulled Preview configuration and Vercel prebuilt output. The normal CI build steps above consume 125–155 seconds before any proved compiler-cache gain. That historical ceiling is not a marginal post-cache prediction. Compatibility, secrets/private-package artifact boundaries, transfer, and validation confidence block reuse. Existing shared build filtering already removes some duplicate builds; do not count those again.
- Obsolete PR cancellation is already configured in PR Validation, Preview, E2E, Docs Check, DB Quality and PR Gates. [Concurrency semantics](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency) confirm the cancellation mechanism. Recent cancelled PR Validation runs corroborate active cancellation; their consumed time is not an additional saving opportunity. E2E also has a non-cancelling shared Admin staging group at [admin-e2e-smoke.yml:98–100](../../.github/workflows/admin-e2e-smoke.yml#L98); do not change shared external-state cancellation without cleanup evidence.
- PR Gates repeats on metadata events, but inspected runs consume 23 and 58 seconds across three jobs. DB Quality's no-DB-change path consumes 33–34 seconds, including a 14-second install. These are smaller physical-time opportunities despite separate-job billing rounding. No redundant minutes-scale correctness check was proved removable.

## Net accounting and next decision

The primary implementation's nightly integration run adds work while leaving PR selection unchanged. It contributes no saving to the candidates above. Any later deferral proposal must calculate net physical work as avoided eligible PR work minus newly scheduled work, extra classifier/setup/transfer work and retries. Use post-DB-copy measurements for any integration term; neither the old 34-minute serial baseline nor old unoptimized Main integration durations are valid marginal inputs.

Zero affected tests means the dependency analysis proves the change cannot affect the excluded job. Deferring relevant tests until Main or nightly changes the time at which failures are caught. Those are different policies and must have separate accounting. There is no new scheduled Storybook or E2E lane in the inspected candidate; adding one would require subtracting its entire new cost.

The smallest useful validation is a read-only relevance replay for Storybook, followed by Admin/Public smoke boundaries. Retain positive/shared/unknown cases and count only proven negative selections. This can establish whether minutes-scale jobs are avoidable before spending Actions minutes. Exact monthly savings, post-DB-copy critical-path improvement, Main-tree equivalence, and browser lane isolation remain unproved. Formal reviewers were not run under the research-only constraint.
