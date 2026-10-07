# CI selection POC

The isolated POC freezes main commit `eda78ba87601db5f00fe8c218ce1acd36e6b0b1d` plus its existing CI working changes on `feature/ci-selection-poc`. The primary checkout is untouched. Earlier experiments supply research and measurements only. This POC keeps the current full Payload configuration, database harness, dependency installation and coverage source scope.

## Selection contracts

| Topic | Candidate | Full fallback |
| --- | --- | --- |
| Integration | Modified existing integration test files, plus registry contracts that read them | Product changes, shared fixtures/setup, dependencies, migrations, unknown paths, additions, deletions and renames |
| Storybook | Skip the whole test worker for modifications exclusively to the internal transactional-email worker route | Every other change, including mixed changes and classification failures |
| Admin/Public E2E | Route modified existing test specifications to their lane; shared changes select both | Unknown impact and non-modification status select both |

All modules consume the complete change manifest. Real PR discovery uses the merge base and all name/status records, including previous rename paths. Controlled measurement scenarios use the same frozen path manifest in both variants. Integration product consumers are advisory only and still execute the full suite. The existing staging mutex and serial E2E execution are not changed.

## Evidence contracts

The manual diagnosis workflow has separate classification, test and result jobs. Intentional skips need an explicit reason and an actually skipped worker. Missing, failed, cancelled or incomplete reports are failures. Required files and case identities must match. Integration baseline discovery requires 98 files and completion requires 877 cases. The email candidate requires exactly delivery, retention and worker. The local candidate executes 134 cases successfully with coverage and cleanup in 35.7 seconds; this is functional evidence, not a GitHub runner saving.

Full runs preserve existing coverage thresholds. Subset coverage uses the same source scope but remains a separate diagnostic report without claiming full-suite compliance. No aggregate production coverage check is replaced.

Two pairs per measurable topic use A/B then B/A, fixed source/toolchain within each pair, and fresh runners. Each topic/round pair can run independently in parallel; variants within a pair are serial. The existing journal was resumed under this scheduling rule without canceling or repeating Actions runs. The resumable journal preserves run IDs and failed attempts and refuses blind redispatch after an uncertain start. Classification, installation, browser transfer, reports, coverage, cleanup and runner teardown count in physical job time. Queue time is separate. Diagnostic workflow duration is not a demonstrated production pipeline reduction.

E2E timing is blocked because no verified immutable browser deployment, source commit and fixture-database identity are supplied. Local fixtures validate lane selection and require Public success even when Admin is intentionally skipped. No replacement environment or deployment is created. Standalone Public startup and complete Admin smoke/regression command coverage are not execution-proved by classifier fixtures.

[The optimization overview](ci-optimization-results.md) records measured gains, unproved opportunities and investigation costs. Detailed manifests, receipts and controller journals remain in ignored evidence. Formal Test, Architecture and Security review is recommended before clean CI adoption and has not run.

## Storybook observations

| Round | Baseline runner | Candidate runner | Runner saved | Baseline diagnosis | Candidate diagnosis | Diagnosis saved |
| --- | --- | --- | --- | --- | --- | --- |
| A/B | 324 s | 31 s | 293 s | 331 s | 36 s | 295 s |
| B/A | 322 s | 33 s | 289 s | 331 s | 37 s | 294 s |

Both baselines pass all 115 files and 1,032 cases with the existing coverage gate. Both candidates intentionally skip the test worker. Runner savings have median 291 seconds and range 289–293; diagnosis savings have median 294.5 and range 294–295. These are complete diagnosis costs, not production pipeline measurements. The existing browser cache policy stays fixed.

## Integration observations and bounded closeout

| Round | Baseline runner | Candidate runner | Runner saved | Baseline diagnosis | Candidate diagnosis | Diagnosis saved |
| --- | --- | --- | --- | --- | --- | --- |
| A/B | 2,451 s | 131 s | 2,320 s | 2,458 s | 138 s | 2,320 s |
| B/A | 2,751 s, cancelled | 116 s, passed | Not accepted | Full reference incomplete | 124 s | Not accepted |

The valid full reference passes 98 files and 877 cases. Both candidates pass exactly three files and 134 cases. The valid pair retains the selected case identities and the same 102-file coverage source scope; subset coverage remains diagnostic. The single paired saving is 38:40, not a repeated median or range. Subset runner values are 131 and 116 seconds, median 123.5 and range 116–131. Those unpaired subset timings do not establish a second saving.

GitHub annotates the cancelled second reference with its 45-minute execution limit. Its log contains successful completion of 93 files and 864 cases, no assertion-failure markers, and five unfinished files. It lacks a complete result and coverage gate, so it is excluded from savings. Error logs from intentional failure scenarios are not treated as assertion failures. Cleanup and result reporting still run; all 2,751 physical runner seconds count as investigation cost.

The bounded POC ends after eight attempts, seven successful runs and three valid pairs. Investigation runner cost is 6,159 seconds, or 102:39, including the failed attempt. No additional retry or full series restart is performed. Future diagnostic jobs use a corrected 75-minute budget. Tests, case inventory, full coverage requirements, production CI and deployments are unchanged.

Measurement sources stay frozen at `cb8043be`. Subsequent refinements reject contradictory status/previous-path manifests, restrict E2E Markdown exclusions and allow independent pairs to run concurrently. They do not alter product/test sources or relabel measurements. The original journal, parallel-continuation snapshot, run IDs, jobs, receipts, coverage and failed logs remain in ignored evidence.

The valid Integration pair uses Intel Xeon Platinum 8573C on both workers. The unpaired second candidate uses AMD EPYC 9V45; both Storybook baseline workers use AMD EPYC 7763. Worker CPU types differ across groups, with four vCPUs and approximately 16 GiB memory in completed workers. Initial queue time is reported separately; diagnosis duration includes between-job waits. No production critical-path saving, monthly saving, cache gain or combined DB-copy/shard gain is inferred from these experiments.

## Additional independent groups

The manual workflow supports controlled Categories and Reviews manifests alongside the original Email manifest. Native Vitest file selection, the existing reporter and the original Payload/database setup are reused. No new configuration, test folder, database optimization or cache policy is introduced. Unknown/shared changes still require the full suite; these controlled test-only manifests do not implement product-impact selection.

Categories executes its lifecycle file and the source-reading collection contract. Reviews executes twelve existing lifecycle, access, seed and migration-contract files plus the collection contract. Its two migration-contract files inspect source text rather than execute migrations. Each selected group retains all original cases in its approved files.

| Local functional run | Files / cases | Process time including discovery, DB setup, coverage and cleanup |
| --- | --- | --- |
| Categories | 2 / 9 | 35.83 seconds |
| Reviews | 13 / 44 | 226.77 seconds |

Both local runs pass and match the historical full reference's case identities. Both retain the same 102-file coverage source scope, with partial diagnostic coverage. Local times are not GitHub runner savings. The local shared database requires serial execution; separate GitHub runners can execute independently.

Runner observations use frozen commit `d829c40860d34ff87c64e8bbdcc16c80dcc92873`. Product/test sources, fixtures, setup, dependencies, coverage configuration and the reporter match the historical full reference at `cb8043be`. Historical receipts retain their original identities and supply case/source validation only. Two runs per group observe repeatability without restarting a full measurement series; the new timing contract is unpaired. Evidence is retained separately under ignored `selection-groups` diagnostics.

| Group / run | Physical runner seconds | Workflow seconds excluding initial queue | Initial queue seconds | Test process seconds |
| --- | --- | --- | --- | --- |
| Categories / 37612086192 | 150 | 157 | 5 | 90.15 |
| Categories / 37612090649 | 155 | 162 | 4 | 88.96 |
| Reviews / 37612403302 | 380 | 387 | 5 | 323.66 |
| Reviews / 37612406940 | 462 | 468 | 4 | 402.72 |

All four runs pass exact file manifests, case identities and 102-file coverage source scope. Categories runner median is 152.5 seconds, range 150–155; Reviews median is 421 seconds, range 380–462. Workflow medians are 159.5 and 427.5 seconds. Total investigation runner cost is 1,147 seconds, or 19:07, with no failed attempts or extra repeats. These costs include all physical scope, worker and result jobs, including installation and cleanup. Initial queue is separate; workflow duration includes between-job waits.

All runners use four vCPUs, Node 24.14.0 and pnpm 10.28.2. Both Categories workers use AMD EPYC 7763; Reviews workers use EPYC 9V45 and 9V74. Hardware variation limits interpretation of the Reviews range. Neither group has a fresh paired full reference or a measurement on the combined DB-copy/sharded topology. No saved-minute or production critical-path claim is derived from these standalone timings. Their independently successful execution supports a narrow test-only selection POC, not complete product dependency coverage.
