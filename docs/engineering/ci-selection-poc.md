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

Two pairs per measurable topic use A/B then B/A, fixed source/toolchain within each pair, and fresh runners. Integration and Storybook groups can run independently in parallel; variants within each group are serial. The resumable journal preserves run IDs and failed attempts and refuses blind redispatch after an uncertain start. Classification, installation, browser transfer, reports, coverage, cleanup and runner teardown count in physical job time. Queue time is separate. Diagnostic workflow duration is not a demonstrated production pipeline reduction.

E2E timing is blocked because no verified immutable browser deployment, source commit and fixture-database identity are supplied. Local fixtures validate lane selection and require Public success even when Admin is intentionally skipped. No replacement environment or deployment is created.

[The optimization overview](ci-optimization-results.md) records measured gains, unproved opportunities and investigation costs. Detailed manifests, receipts and controller journals remain in ignored evidence. Formal Test, Architecture and Security review is recommended before clean CI adoption and has not run.
