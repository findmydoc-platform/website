# CI optimization results

The proof of concept demonstrates faster integration feedback, lower serial integration cost and working build caches. Database copies provide the largest measured reduction in runner time. Parallel tests shorten feedback but consume more runner time. Cache gains are smaller and depend on transfer cost and runner variation.

This report retains the approaches, measured results and constraints for a fresh implementation. The experiment scripts and workflows are diagnostic tools, not the implementation to adopt. Normal CI cache settings remain unchanged.

## Measured improvements

Feedback means the time until the compared results are available. Runner time means the sum of physical job execution time, not GitHub billing. Each row has its own measurement scope; these savings do not describe the entire production workflow and must not be added.

| Approach tested | General approach | Feedback gain | Runner time gain | Evidence |
| --- | --- | --- | --- | --- |
| Database copies | Prepare baseline data once and give each test file a fresh database copy | Median 34:22 to 12:58, saving 21:24, or 62.25% | About 21.4 minutes saved per serial execution | Three full pairs with the same 98 files, 877 passing tests and per-file coverage. Preparation, coverage merge and cleanup count; shared dependency installation and VM startup do not. [Measurement](https://github.com/findmydoc-platform/website/actions/runs/37386841643) |
| Parallel integration tests | Distribute the same suite across four runners | 27:15 to 14:28, saving 12:47, or 46.9% | 20:07 more consumed, from 27:15 to 47:22 | Complete comparison with unchanged tests and coverage, including setup and merge. Later shard diagnostics corroborate faster feedback with a different measurement scope. [Measurement](https://github.com/findmydoc-platform/website/actions/runs/37221968450) |
| Compiler cache | Keep compiler inputs stable and reuse compiled modules | Median 32 seconds saved in the first series and 23 seconds in the second | About 0.53 and 0.38 minutes saved at the respective medians | Two series of three complete job pairs. Five of six save time; one takes 18 seconds longer despite working reuse. [First series](https://github.com/findmydoc-platform/website/actions/runs/37425573941), [second series](https://github.com/findmydoc-platform/website/actions/runs/37428462208) |
| pnpm package cache | Reuse downloaded packages for an unchanged dependency set | Median 3 seconds saved; individual savings 3, 0 and 4 seconds | 0.05 minutes saved at the median | Package reuse works in every exact and fallback restore; lockfile changes invalidate correctly. The small job gain is not clearly separated from runner variation. [Measurement](https://github.com/findmydoc-platform/website/actions/runs/37428462208) |
| Both caches together | Reuse downloaded packages and compiled modules in the same job | Median 24 seconds saved; individual savings 81, 24 and 23 seconds | 0.40 minutes saved at the median | Three complete pairs with verified reuse of both caches. This does not isolate pnpm's additional benefit over compiler caching. [Measurement](https://github.com/findmydoc-platform/website/actions/runs/37428462208) |
| Avoid builds for test-only changes | Keep validation and skip the application build when only tests change | Median 2:36 saved; range 1:50 to 3:22 | Median 2:10 saved; range 1:30 to 2:50 | Two independent pairs with identical sources, tests and coverage within each pair. One build avoided in each. [First candidate](https://github.com/findmydoc-platform/website/actions/runs/37467852607), [second candidate](https://github.com/findmydoc-platform/website/actions/runs/37470540457) |
| Avoid builds for repository metadata | Keep validation and skip the application build for issue-template and secret-inventory metadata | Median 142.5 seconds saved; range 1:41 to 3:04 | Median 1:54 saved; range 1:47 to 2:01 | Two independent pairs; executable tooling and workflow YAML remain build-relevant. [First candidate](https://github.com/findmydoc-platform/website/actions/runs/37469834330), [second candidate](https://github.com/findmydoc-platform/website/actions/runs/37477016282) |
| Start Build earlier | Build alongside independent checks | Build feedback arrives a median 3:53 earlier; range 3:36 to 4:10. Whole workflow takes a median 6:06 longer; range 5:09 to 7:03 | No saving; median 7:08 more consumed, range 5:05 to 9:11 | Two full pairs with 98 integration files, 877 passing cases, matching coverage and build routes. Earlier feedback is verified; shorter full validation is not. [First candidate](https://github.com/findmydoc-platform/website/actions/runs/37473152797), [second candidate](https://github.com/findmydoc-platform/website/actions/runs/37473187396) |

Cache comparisons include installation, setup, cache transfer, reporting and cleanup. The combined cache's initial population adds a median 50 seconds, with individual overheads of 21, 50 and 81 seconds. Compiler-only population adds 43 to 46 seconds in the first series and 26 to 57 seconds in the second. Package-only population differs from the baseline by +1, +4 and -2 seconds; the negative value reflects measurement variation. Warm-job savings do not guarantee a net gain after only one reuse.

Database copies and parallel execution have independently demonstrated effects and can be adopted together. A combined experiment is optional for measuring their interaction and total saving. Their separate reductions remain useful without that experiment.

## Other verified behavior

Pure Markdown already avoids a build in the reference. Its control pair avoids no additional build work and demonstrates no saving. Six retained runtime-control pairs execute a build in both variants.

All four controlled failure probes keep the final status failed. Failed classification prevents builds in both variants. With a failed static check, the early variant still spends 3:43 on a successful build that the late variant avoids. Earlier feedback therefore adds work when independent checks fail.

## Constraints for the fresh implementation

- Preserve test assertions, all 98 files and 877 cases in full-suite comparisons, and coverage requirements. Database copies must provide isolated test data.
- A cache hit alone does not prove reuse. The historical compiler cache restores successfully but reuses no modules because a regenerated Server Actions key changes the compiler cache version. Stable compiler inputs resolve this in the experiment.
- Keep tokens, access configuration and Server Actions keys out of reports and unprotected cache artifacts. The POC protects compiler archives because they contain key material. Choose an explicit key and cache-protection strategy for the fresh implementation.
- Count preparation, transfer, initial population, coverage merge and cleanup. Keep failed and slower comparisons in the evidence. Faster compilation alone does not guarantee a faster complete job.
- Keep independently measured effects separate. Combined cache savings do not prove an additional package-cache gain, and medians from separate experiments cannot be added.

The successful database-copy series costs 164:58 physical runner minutes, plus earlier diagnostic attempts. Both cache series together cost 147:51, including six failed metric jobs in the first series. The build investigation costs 548:46 across 33 unique runs, including historical controls, four deliberate failure probes and three unexpected failed attempts costing 70:06. The revised continuation completes 18 planned slots plus one rejected attempt. These are investigation costs. The public repository's cache runs report zero billable milliseconds; future private-repository billing savings are not measured.

The linked Actions runs retain individual comparisons and diagnostic artifacts. [Integration diagnostics](ci-shard-diagnostics.md) retain the integration experiment details. This report is the basis for choosing the later implementation; Test, Architecture and Security reviews remain appropriate before adoption.

## Isolated build experiments

Each comparison changes one factor. Filtering keeps the late build order; scheduling forces the same build in both variants. Package and compiler caches remain disabled, and database setup stays unchanged. Timings include setup, reporting, coverage merge and cleanup; queue time is separate. Independent groups run in parallel and variant order reverses across repetitions.

Skipping unnecessary builds saves work in both test-only and metadata repetitions. Other checks vary between runners, so the entire-job saving is smaller than the avoided build job. The medians describe these fixtures, not monthly savings or the frequency of such changes.

Starting Build earlier improves its feedback in both repetitions but leaves integration on the critical path. Integration runners vary between AMD EPYC and Intel Xeon models. Full validation also takes a median 6:06 longer in these samples, with individual differences of 7:01 and 5:11. These observations demonstrate no whole-workflow or runner saving and do not establish that the scheduling change causes the integration slowdown.

This is a directional POC. Successful historical controls remain retained across test-only fixes, with two observed Storybook coverage variations annotated. New performance pairs match their test identities, coverage and build routes. One full integration attempt fails four concurrent-transaction cases; its unchanged replacement passes all 877. The failure remains excluded from savings and included in costs. Detailed receipts, provenance and individual measurements remain in ignored diagnostic evidence.

Adopt the filter approach in the later fresh implementation. Choose early Build only for earlier feedback, accepting possible wasted work on failed checks. Normal CI and deployments remain unchanged; measured gains from separate approaches are not added.

## Remaining opportunities

| General approach | Expected benefit to investigate | Open condition |
| --- | --- | --- |
| Select affected integration tests in PRs and retain full scheduled coverage | Less PR work and shorter feedback | Reliable selection and unchanged failure detection; [issue 2049](https://github.com/findmydoc-platform/website/issues/2049) |
| Reduce cache transfer and preserve reuse across real PR changes | Lower cache overhead and more useful reuse | Complete job comparisons with changed PR inputs |
| Reuse compatible build output | Avoid duplicate builds | Consumers require the same sources, dependencies, configuration and output |
| Reduce repeated TypeScript and page-generation work | Shorter cached builds | Correctness and timing comparison |
| Reconsider Turbopack | Shorter builds | Resolve the known compatibility issue before comparison; [issue 777](https://github.com/findmydoc-platform/website/issues/777) |

These opportunities have no measured savings yet. Moving tests to a nightly run only reduces PR work if PR selection also changes; the scheduled runs add their own cost.

## Domain integration POC

A separate manual workflow compares smaller Payload configurations and affected-group selection as independent factors. The existing suite and the measurements above remain unchanged. The sample contains five country cases and nineteen gallery cases, using production collection definitions and isolated copies of the full baseline database.

The dependency inventory retains 37 of 47 declared collections in both groups. Relationships, shared role fixtures and unchanged plugins create substantial overlap. Both source-change fixtures currently select both groups; no avoided test work is established. Local database compatibility passes for both groups, with identical gallery coverage against the complete configuration. Local timing differences are not counted as proven savings.

A replay of fifty merged non-bot PR file lists selects no POC group for seven PRs and both groups for forty-three. Forty-three selections use a conservative fallback for other changed paths. This current-graph sample does not establish historical correctness or savings across the complete integration suite. Actions comparisons and investigation costs are reported after collection.
