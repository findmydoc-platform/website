# Integration domain POC

This experiment keeps the existing integration suite and previous CI measurements intact. Its standalone Vitest configuration runs five country cases and nineteen gallery cases copied from the original tests. Production assertions, role fixtures, hooks, uploads and access rules remain unchanged.

## What is compared

The configuration experiment compares the complete application configuration with domain configurations on the same cases, baseline database copies and scoped coverage. The selection experiment keeps those domain configurations fixed and compares both groups with the conservative affected-group selection. Each factor has two pairs in alternating order, for sixteen fresh Actions jobs in total.

All production plugins and applicable initialization guards remain enabled. Literal Payload calls, relationship targets and plugin targets expand each domain's collection set. Both current configurations contain 37 of the application's 47 declared collections. Runtime imports of the application-config alias resolve to the active test configuration, including lazy logger initialization. These configurations do not prove production endpoint or admin equivalence.

Both Country and Gallery source fixtures currently select both groups through shared dependencies. A reduced selection is never forced. The full database template is prepared with the complete product configuration; reduced configurations use schema push disabled. Existing isolation verification runs before every file.

## Execution and evidence

Use `scripts/ci-domain-poc-experiment.mjs OUTPUT COMMIT` on the experiment branch after local validation and push. It retains a frozen journal, runs at most two independent lanes, preserves original Actions IDs and stops on unexpected failure. Reuse the same output directory after diagnosis; never create a fresh series to repeat valid work. Each pair keeps one source commit. A pending dispatch is discovered before another dispatch is attempted.

The independent workflow is manually triggered. The existing manual diagnostics entrypoint only forwards the new `domain-poc` stage to it so the branch-only workflow can run without adoption on the default branch. Previous stages and normal CI keep their behavior.

Safe receipts record case identity, phases, copied-database verification, source commit, toolchain, hardware, coverage and cleanup. Config comparisons require identical case identity and coverage scope and hits. Selection comparisons require identical retained cases and their coverage. Partial coverage never represents the full integration contract.

Workflow completion and physical runner time come from the Actions API and include installation, preparation, reporting, artifact transfer and cleanup. Failed runs retain evidence and count toward investigation costs. The local compatibility runs establish functionality only, not runner savings.

Historical analysis uses the current conservative dependency graph against the last fifty merged non-bot PR file lists. It does not reproduce historical application execution or extrapolate to the other integration groups.
