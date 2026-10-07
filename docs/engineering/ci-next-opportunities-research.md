# Remaining CI opportunities

This research evaluates additional work after the measured database-copy, build-filter and cache experiments. The four research assignments cover integration dependency boundaries, PR routing, remaining integration overhead and other pipeline costs. No new Actions measurements or production workflow changes belong to this research.

The research completed on 7 October 2026. Whole-job routing offers the most practical next opportunities. Keep full Payload configuration and database copies; do not restructure all tests or introduce smaller configurations before establishing useful selection.

## Findings and priority

| Priority | Approach | Observed work, not demonstrated new saving | Judgment |
| --- | --- | --- | --- |
| 1 | Explicit integration file selection, starting with test-only changes and narrow source consumers | The full serial DB-copy execution retains about 13 minutes. Retained group file phases include about 2.4 minutes for seed/storage and 1.9 minutes for email; these are overlapping attribution examples, not guaranteed avoided job time | Highest potential, but unknown eligibility and correctness. First replay a small selection manifest without execution |
| 2 | Skip Storybook for verified irrelevant inputs | Sampled complete jobs cost 4:06–5:08 | Minutes-scale runner opportunity with simpler boundaries than general integration selection; eligibility frequency remains unknown |
| 3 | Separate Admin and Public E2E relevance | Sampled individual lanes cost 3:29–4:55 | Worth mapping next, but shared authentication, staging and the serial dependency need explicit treatment |
| 4 | Reduce repeated integration module collection | About 4.5 minutes of recorded collection in the full serial DB-copy execution | A hypothetical 25–50% reduction corresponds to 1.1–2.3 minutes before reset overhead. This is a screening scenario, not an expected saving. Isolation makes it more expensive than routing |

Whole-workflow improvement remains unknown for all four. Routing reduces runner work only for genuinely omitted jobs or files; independent checks can still determine completion. Main-result reuse has an 8:35–9:25 observed Static/Unit/Storybook execution envelope, but tested-tree equivalence and provenance are unproved. Its higher implementation cost makes it a later option.

The prior Country/Gallery result does not prove all integration behavior is inseparable. Both POC groups have the same conservative configuration dependency inventory. It includes relationships that matter at runtime, but also shared registration, seed task imports and whole-file scanning. A Gallery hook change matching Country's manifest does not prove that Country assertions exercise that hook. Removing this over-selection still needs explicit consumers and shared initialization safeguards.

The existing 50-PR history gives one concrete narrower-selection candidate, a PR changing three integration test files. It establishes no additional integration-triggering PR safe for zero tests. Documentation-only PRs already avoid integration; existing exclusions for some features and dependencies are gaps to investigate, not new savings. Do not extrapolate the two-group POC's 43 conservative fallbacks into a frequency of genuinely affected groups.

## Smallest useful continuation

Use a bounded, nonexecuting selection replay first. Include the three-test-only PR, a private Gallery hook, an email leaf, Country schema, shared fixtures, dependency/config changes, rename/delete and failed classification. Preserve full fallback for unknown impact. Inspect Storybook relevance separately against the same available file lists.

Only after that replay identifies useful omitted work should a small selected-file DB-copy execution compare retained case identities and coverage contracts. Full scheduled coverage and scoped PR coverage must be labeled separately. Deliberately deferring relevant PR checks is a policy decision, not evidence that zero tests are affected.

Remaining init-only and reporting work does not justify another broad POC: all measured beforeAll hooks total about 30 seconds, eight inspected database-free files expose about five seconds of avoidable database setup, and seed coverage merging costs about 1.6 seconds. Repeated demo fixture work occupies about two minutes, but the removable fraction is not established.

Research wrote documentation only. It started no Actions runs and added no Actions execution minutes. Existing evidence was retained; concurrent primary-checkout changes were read without modification. No measured improvement was added to the optimization table.

## Evidence and economics

The [optimization results](ci-optimization-results.md) retain measured improvements. Research recommendations and calculated ceilings do not add new proven savings to that report.

An integration selection can retain the complete Payload configuration and isolated database copies. Selecting fewer test files and initializing fewer collections are separate decisions. Their costs and correctness limits must be evaluated separately.

Skipping a test job avoids runner work. It shortens complete validation only when that job determines the finish time. For independent jobs, compare the previous and new maximum completion time, not the duration of the omitted job alone.

Moving full tests to a schedule adds scheduled work. Net physical runner savings over a period equal avoided PR work minus selection overhead, additional full runs and failure investigation. Use the database-copy candidate as the reference when estimating additional integration savings. Do not use the slower historical setup as an additive opportunity.

GitHub rounds private hosted job execution up to whole minutes separately. Physical runner seconds remain useful for comparisons, but are not exact billable minutes. See [job execution time](https://docs.github.com/en/actions/how-tos/monitor-workflows/view-job-execution-time) and [runner pricing](https://docs.github.com/en/billing/reference/actions-runner-pricing).

An empty selection means either no represented integration behavior is affected, or validation is deliberately deferred. These decisions have different evidence requirements. Full nightly coverage does not prove a narrow PR selector preserves pre-merge failure detection.

## Research assignments

- [Independent integration groups](integration-group-independence-research.md) examines the existing test dependencies and selection without smaller Payload configurations.
- [PR integration selection](pr-integration-selection-research.md) examines empty and narrow selections, full-suite gates, coverage and changed-file history.
- [Remaining integration overhead](integration-overhead-research.md) examines the remaining execution costs after database copies.
- [Other pipeline costs](pipeline-remaining-cost-research.md) examines opportunities outside integration execution.

Each report separates repository facts, historical timings, estimated ceilings and recommendations. Concurrent normal-CI work in the main checkout must be distinguished from the experiment branch. Research documents are the only write scope here.
