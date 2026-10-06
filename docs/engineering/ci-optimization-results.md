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

Cache comparisons include installation, setup, cache transfer, reporting and cleanup. The combined cache's initial population adds a median 50 seconds, with individual overheads of 21, 50 and 81 seconds. Compiler-only population adds 43 to 46 seconds in the first series and 26 to 57 seconds in the second. Package-only population differs from the baseline by +1, +4 and -2 seconds; the negative value reflects measurement variation. Warm-job savings do not guarantee a net gain after only one reuse.

Database copies and parallel execution have independently demonstrated effects and can be adopted together. A combined experiment is optional for measuring their interaction and total saving. Their separate reductions remain useful without that experiment.

## Other verified behavior

Starting Build alongside independent validation makes all included frontend results available in 3:33 instead of 8:13 in one comparison, a 4:40 reduction. Build itself takes roughly the same time. The exact feedback gain needs repetition; aggregate runner savings are not demonstrated. [Measurement](https://github.com/findmydoc-platform/website/actions/runs/37223420886).

The build-change filter correctly skips workflow, test and metadata changes while requiring a build for a runtime change. Avoiding those jobs is a verified behavior; its total time saving is not measured. [Measurement](https://github.com/findmydoc-platform/website/actions/runs/37223337268).

## Constraints for the fresh implementation

- Preserve test assertions, all 98 files and 877 cases in full-suite comparisons, and coverage requirements. Database copies must provide isolated test data.
- A cache hit alone does not prove reuse. The historical compiler cache restores successfully but reuses no modules because a regenerated Server Actions key changes the compiler cache version. Stable compiler inputs resolve this in the experiment.
- Keep tokens, access configuration and Server Actions keys out of reports and unprotected cache artifacts. The POC protects compiler archives because they contain key material. Choose an explicit key and cache-protection strategy for the fresh implementation.
- Count preparation, transfer, initial population, coverage merge and cleanup. Keep failed and slower comparisons in the evidence. Faster compilation alone does not guarantee a faster complete job.
- Keep independently measured effects separate. Combined cache savings do not prove an additional package-cache gain, and medians from separate experiments cannot be added.

The successful database-copy series costs 164:58 physical runner minutes, plus earlier diagnostic attempts. Both cache series together cost 147:51, including six failed metric jobs in the first series. These are investigation costs. The public repository's cache runs report zero billable milliseconds; future private-repository billing savings are not measured.

The linked Actions runs retain individual comparisons and diagnostic artifacts. [Integration diagnostics](ci-shard-diagnostics.md) retain the integration experiment details. This report is the basis for choosing the later implementation; Test, Architecture and Security reviews remain appropriate before adoption.

## Isolated build experiments

The build diagnosis compares two independent changes: requiring a build only for relevant files, and starting the same build alongside independent checks. Package and compiler caches stay disabled; database setup and test requirements stay unchanged within each comparison.

This is a directional POC. Successful measurements remain useful across test-only fixes. Commits, runner variation and observed coverage differences stay visible in the evidence. Failed tests, missing cases and changed coverage scope do not count as successful comparisons. Small differences in covered animation branches are recorded rather than causing a complete restart. Repeated, clear direction is enough to stop adding samples; small timing differences remain inconclusive.

Existing runtime-control pairs are retained. The remaining investigation uses two pairs each for test-only and metadata filtering, one documentation control, and two full scheduling pairs with 98 integration files and 877 test cases. Independent comparison groups run in parallel, with opposite variant order across repetitions. Classification and static-check failure probes remain separate from savings samples.

Pure Markdown already skips the late build in the reference, so documentation can show no avoided build work. Earlier build feedback does not automatically shorten full validation. Physical runner use, workflow completion and investigation costs remain separate. Failed and superseded measurements stay in the diagnosis evidence; their costs remain part of the investigation.

No new build savings are claimed until these observations are assessed. Normal CI and deployments remain unchanged. The POC informs a later fresh implementation.

## Remaining opportunities

| General approach | Expected benefit to investigate | Open condition |
| --- | --- | --- |
| Select affected integration tests in PRs and retain full scheduled coverage | Less PR work and shorter feedback | Reliable selection and unchanged failure detection; [issue 2049](https://github.com/findmydoc-platform/website/issues/2049) |
| Reduce cache transfer and preserve reuse across real PR changes | Lower cache overhead and more useful reuse | Complete job comparisons with changed PR inputs |
| Reuse compatible build output | Avoid duplicate builds | Consumers require the same sources, dependencies, configuration and output |
| Reduce repeated TypeScript and page-generation work | Shorter cached builds | Correctness and timing comparison |
| Reconsider Turbopack | Shorter builds | Resolve the known compatibility issue before comparison; [issue 777](https://github.com/findmydoc-platform/website/issues/777) |

These opportunities have no measured savings yet. Moving tests to a nightly run only reduces PR work if PR selection also changes; the scheduled runs add their own cost.
