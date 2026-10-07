# CI optimization POC

This temporary report is the research starting point for the Website CI optimization deliverable. It records measured CI benefits and the agreed implementation scope. At deliverable completion, transfer the adopted decisions and final results into the regular CI documentation and delete this report. Git history retains the original research snapshot. The POC workflows and scripts are evidence, not code to copy into normal CI. Research and experiments do not change normal CI or deployments; concurrent implementation work in the primary checkout is separate.

Feedback and complete-workflow duration are distinct. Runner time is summed physical job execution, not exact GitHub billing. Each comparison has its own scope. Independent savings must not be added, and observed cost pools are not demonstrated savings.

## Tested approaches

| Approach | General idea | Observed result | Decision and limits |
| --- | --- | --- | --- |
| Database copies | Prepare baseline data once; restore an isolated copy for each file | Serial median **34:22 to 12:58**, saving **21:24** and about **21.4 runner minutes** | Largest demonstrated cost reduction. Three full pairs retain 98 files, 877 cases and coverage. Preparation, merge and cleanup count; shared installation and VM startup do not. [Evidence](https://github.com/findmydoc-platform/website/actions/runs/37386841643) |
| Four-way integration parallelism | Distribute the complete suite across four runners | Feedback **27:15 to 14:28**, saving **12:47**; runner consumption **27:15 to 47:22**, adding **20:07** | Faster feedback at higher cost. Complete comparison retains tests and coverage, including setup and merge. Later diagnostics corroborate the direction. No combined DB-copy/parallel saving measured. [Evidence](https://github.com/findmydoc-platform/website/actions/runs/37221968450) |
| Compiler cache | Stabilize compiler inputs and reuse compiled modules | Median **32 seconds** saved in one series, **23 seconds** in another; five of six pairs improve, one takes 18 seconds longer | Reuse works; modest, variable complete-job benefit. Population adds 43–46 seconds in the first series and 26–57 in the second. Cache protection and stable Server Actions inputs need an explicit strategy. [First series](https://github.com/findmydoc-platform/website/actions/runs/37425573941), [second](https://github.com/findmydoc-platform/website/actions/runs/37428462208) |
| pnpm package cache | Reuse downloaded packages | Savings **3, 0 and 4 seconds**, median **3 seconds** | Exact/fallback reuse and lockfile invalidation work. The tiny timing gain is not clearly separated from runner variation. Population differs from baseline by +1, +4 and -2 seconds. No independent minutes-scale benefit. [Evidence](https://github.com/findmydoc-platform/website/actions/runs/37428462208) |
| Both caches | Reuse packages and compiler modules together | Savings **81, 24 and 23 seconds**, median **24 seconds** | Three successful pairs. Additional package-cache benefit over compiler-only remains unisolated. Initial population adds 21, 50 and 81 seconds, median 50. [Evidence](https://github.com/findmydoc-platform/website/actions/runs/37428462208) |
| Skip builds for test-only changes | Keep validation; omit an irrelevant application build | Workflow median **2:36** saved, range **1:50–3:22**; runner median **2:10**, range **1:30–2:50** | Repeated benefit in two pairs. Build tooling and shared configuration remain relevant. [First pair](https://github.com/findmydoc-platform/website/actions/runs/37467852607), [second](https://github.com/findmydoc-platform/website/actions/runs/37470540457) |
| Skip builds for repository metadata | Omit builds for issue-template and secret-inventory changes | Workflow median **142.5 seconds** saved, range **1:41–3:04**; runner median **1:54**, range **1:47–2:01** | Repeated benefit in two pairs. Executable tooling and workflow YAML remain build-relevant. Markdown already skips in the reference, so there is no additional Markdown gain. [First pair](https://github.com/findmydoc-platform/website/actions/runs/37469834330), [second](https://github.com/findmydoc-platform/website/actions/runs/37477016282) |
| Select changed integration tests | Execute only the three modified Email test files, retaining full Payload config and existing DB setup | One valid pair reduces runner **40:51 to 2:11**, saving **38:40**; diagnosis **40:58 to 2:18**, also **38:40** | 98 files/877 cases become 3/134 with matching retained identities and 102-file coverage scope. Both subset attempts pass, but the second full reference times out, so repeated timing and a repeated median are **not established**. Product changes still run all tests. No DB-copy or shard combination measured. [Valid pair](https://github.com/findmydoc-platform/website/actions/runs/37604268663), [failed reference](https://github.com/findmydoc-platform/website/actions/runs/37600893306) |
| Skip irrelevant Storybook job | For the audited internal email-worker route, omit the complete browser-test worker | Two pairs save runner **4:53 and 4:49**, median **4:51**; diagnostic workflow **4:55 and 4:54**, median **294.5 seconds** | 115 files and 1,032 cases are omitted with explicit reasons. Includes installation, coverage, artifacts and cleanup. Broader backend exclusions and production critical-path savings remain unproved. [First pair](https://github.com/findmydoc-platform/website/actions/runs/37600150945), [second](https://github.com/findmydoc-platform/website/actions/runs/37600432041) |

Cache timing includes installation, transfer, reporting and cleanup. A restored archive alone is not proof of compiler or package reuse.

## Untested opportunities

The following are research findings or open questions, not new measured improvements. Size describes observed work or an explicitly hypothetical scenario, not expected saving. Complexity describes dependencies and validation effort, not implementation days.

| Approach | General idea and available evidence | Assessment for fresh implementation |
| --- | --- | --- |
| Broader Storybook relevance | Extend beyond the single measured worker-route exception; sampled whole jobs cost **4:06–5:08** | Low to medium for conservative whole-job routing, higher for individual stories. Include components, styles, stories, providers, shared imports and configuration. Whole-workflow benefit depends on the critical path. [Research](../engineering/pipeline-remaining-cost-research.md) |
| Separate Admin/Public E2E | Run only the affected lane; sampled individual lanes cost **3:29–4:55** | Medium, potentially high if shared state prevents separation. Resolve Admin-to-Public dependency and shared auth/API/staging inputs first. [Research](../engineering/pipeline-remaining-cost-research.md) |
| Reuse Main check results | Avoid repeated Static/Unit/Storybook for exactly equivalent validated inputs; two Main samples cost **8:35–9:25** | High complexity and low eligibility confidence. Tested-tree equivalence and trusted provenance are not established; unconditional Main skipping is not justified |
| Reuse compatible build output | Avoid separate CI/Preview compilation | Sources alone are insufficient; environment, dependencies, configuration and outputs must match. Compatibility and net transfer benefit remain unproved |
| Improve cache transfer and real-change reuse | Retain reuse across PR source changes with less transfer overhead | Complete changed-input job comparisons required. Existing warm-cache medians are not an extra gain to count again |
| Reduce TypeScript/page-generation work | Remove repeated compilation checks or generation | No separate saving measured; correctness and timing attribution remain open |
| Reconsider Turbopack | Replace Webpack if the compatibility blocker is resolved | No saving measured; check [issue 777](https://github.com/findmydoc-platform/website/issues/777) before comparison |

Do not prioritize setup-sharing, artifact or coverage-merge rewrites over whole-job selection. Inspected non-integration installs total only 54–62 seconds and combined coverage costs 14–22 seconds. Obsolete PR cancellation already exists. These observations demonstrate no additional medium or large gain.

## Implementation boundaries and investigation costs

Preserve assertions, isolated data and full-suite coverage requirements. Full comparisons retain 98 files and 877 cases. Unknown classification must not silently become a successful empty selection. Keep tokens, access configuration and Server Actions keys out of reports and unprotected cache artifacts. Combined effects, monthly frequency, exact billed savings and combined DB-copy/parallel performance remain unmeasured.

The selection POC costs **102:39** across eight unique attempts, including **45:51** for the timed-out full reference. Seven attempts succeed, producing two Storybook pairs and one Integration pair. No extra retries or series restart were added. These costs include classification, setup, installation, reports, coverage and cleanup.

Successful DB-copy measurements cost **164:58** physical runner minutes, plus earlier diagnostics. Both cache series cost **147:51**, including six failed metric jobs. Build investigation costs **548:46** across 33 unique runs, including failed attempts costing **70:06**. These are investigation costs, not recurring overhead or a complete total of every historical attempt. Public cache runs report zero billable milliseconds; future private billing is unmeasured.

Retained evidence includes unsuccessful/slower attempts and original run identities. Hardware varies. Test, Architecture and Security review remain recommendations before adoption; formal reviewers have not run. [Integration diagnostics](../engineering/ci-shard-diagnostics.md), linked Actions receipts and separate research reports retain details.


## Conservative selection POC

The isolated [selection POC](../engineering/ci-selection-poc.md) implements narrow test-only integration routing, the audited Storybook exception and independent Admin/Public test-file routing. General product impact retains full fallback. Its serial integration timing is separate from DB-copy and parallel-shard measurements above.

Two Storybook pairs establish repeated savings. Integration has one valid time comparison and two successful subset runs; the second reference exceeds the POC job limit after 93 files and 864 cases pass in the log. It is excluded from savings. The diagnostic timeout is corrected to 75 minutes for future use, without weakening tests or restarting this bounded POC. A repeated integration timing claim remains open.

E2E timing remains blocked by missing immutable deployment/source/fixture identity evidence. Local fixtures validate selection and outcome rules, including required Public success when Admin is excluded; standalone browser startup and complete Admin command coverage are not execution-proved. The primary checkout remains untouched. Normal CI adoption and formal reviews remain separate work.

## Agreed integration selection

The only integration-selection approach in scope distinguishes product changes from changes to existing integration tests. Keep the existing Vitest integration project, full Payload configuration and database setup.

| PR change | Integration execution |
| --- | --- |
| Only existing integration test files modified | Run the modified files with native Vitest file arguments, plus required source-reading contracts |
| Any change under `src/**` | Run the complete integration suite |
| Shared fixtures, test helpers, setup, dependency manifests, lockfiles or relevant runtime/test configuration changed | Run the complete integration suite |
| Integration tests added, deleted or renamed; mixed changes, unknown impact or failed classification | Run the complete integration suite |
| Documentation-only changes outside these full-suite paths | No integration execution |

Selected PR coverage is explicitly partial and does not replace the full-suite coverage requirement. Full runs use the ordinary unfiltered invocation. Status checks distinguish passed, reasoned skip and failure. This is the agreed implementation scope; normal CI has not been changed by this report. The measured test-only comparison and its limits remain in the results table above.
