# Established Testing Methods for Website Instructions

Date: 2026-08-19

## Decision question

Which established, attributable testing methods can compress or structure recurring Website instructions without weakening correctness, scope control, evidence, or safety?

This report evaluates four methods against the [Semantic Anchor](https://llm-coding.github.io/Semantic-Anchors/) idea and the project's evaluation lens: a short established term is useful only when it activates a precise, rich, consistent, and attributable concept. It does not recommend a new test runner, evaluation platform, CI workflow, or mandatory ceremony.

## Recommendation in brief

Advance these candidates to the later testing-vocabulary decision:

1. **Test Impact Analysis** as the primary name for change-scoped validation selection. The repository already follows a manual version of it.
2. **Example Mapping** as an optional, time-bounded method for turning unclear behavior into rules, concrete examples, and explicit questions before tests are chosen.
3. **Testing Trophy (Kent C. Dodds, JavaScript-monolith interpretation)** only as a portfolio heuristic. Its qualified name matters because the unqualified test-level terms are not consistent enough to replace repository definitions.

Do not use **Contract Testing** as a replacement for the current `Collection Contract Model`. The public method concerns consumer/provider service boundaries, while the repository's model is an internal integration-coverage registry. Reusing the public term would reduce precision.

The strongest compression opportunity is therefore not a single universal testing anchor. It is a small composition of distinct concerns: Test Impact Analysis selects affected evidence, Example Mapping clarifies ambiguous behavior, and the qualified Testing Trophy explains the overall confidence portfolio. Repository-specific mandatory gates and contract meanings remain explicit.

## Repository baseline

The current test architecture is already deliberately lean and behavior-oriented:

- The root policy routes validation by changed path and always keeps `pnpm format`; `pnpm check` and `pnpm build` are conditional on the affected source type ([`AGENTS.md`](../../../AGENTS.md#L44-L59)).
- Test instructions require every new test to name the production, delivery, or data change that would make it fail, and local runs should exercise only tests covering changed files ([`tests/AGENTS.md`](../../../tests/AGENTS.md#L20-L30)).
- The documented portfolio uses focused unit tests, real Payload/Postgres integration tests, and intentionally small deterministic E2E journeys ([`docs/testing/strategy.md`](../../testing/strategy.md#L23-L28)). Workflows are explicitly integration-first ([`docs/testing/strategy.md`](../../testing/strategy.md#L5-L11)).
- E2E instructions separate small smoke paths from longer dependent regression paths and require the smallest Playwright lane that proves the affected consumer behavior ([`tests/e2e/AGENTS.md`](../../../tests/e2e/AGENTS.md#L16-L27)).
- The `Collection Contract Model` registers baseline and deep integration suites per Payload collection; it does not model an external provider and consumer ([`docs/testing/strategy.md`](../../testing/strategy.md#L30-L47), [`collectionContractRegistry.ts`](../../../tests/integration/contracts/collectionContractRegistry.ts#L1-L47)).
- The repository exposes separate commands for unit, integration-inclusive, smoke, and regression evidence rather than one undifferentiated local test command ([`package.json`](../../../package.json#L20-L35)).

These facts set an important boundary: a public anchor may explain an existing choice, but it must not erase the exact local routing, critical domains, commands, or evidence requirements.

## Candidate 1: Testing Trophy

### Canonical name and origin

Kent C. Dodds introduced the **Testing Trophy** graphic in 2018 and later documented its intended interpretation for JavaScript applications. It organizes confidence work into static analysis, unit tests, integration tests, and a smaller number of end-to-end tests, emphasizing confidence return on time invested. Dodds explicitly limits his original framing to a codebase under one ownership boundary and notes that test-level definitions vary ([Dodds, _The Testing Trophy and Testing Classifications_](https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications)).

### Meaning and boundary

The Testing Trophy is a portfolio heuristic, not a fixed ratio and not a command-selection algorithm. It favors meaningful integration evidence for JavaScript applications while retaining static checks, focused units, and a small E2E layer.

It must stay distinct from:

- the **Test Pyramid**, attributed to Mike Cohn, which emphasizes more low-level tests and fewer tests as granularity rises ([Ham Vocke, _The Practical Test Pyramid_](https://martinfowler.com/articles/practical-test-pyramid.html));
- Test Impact Analysis, which selects regression evidence for a specific change;
- acceptance-test design, which asks what behavior proves a feature rather than how the whole portfolio is shaped.

The repository should not combine Trophy and Pyramid language into an unnamed hybrid. Its integration-first strategy is materially closer to the Trophy, while its small E2E lane is compatible with both.

### Semantic Anchor assessment

| Criterion | Assessment |
| --- | --- |
| Precise | **Medium.** The four layers are clear, but Dodds acknowledges that `unit`, `integration`, and `E2E` have competing definitions. A qualified attribution and local definitions are necessary. |
| Rich | **High.** The term carries portfolio shape, confidence/effort trade-offs, and a JavaScript context. |
| Consistent | **Medium.** Likely recognizable to coding models, but bare usage can trigger different layer definitions. The accepted Anchor Smoke Test must verify the actual main and reviewer models. |
| Attributable | **High.** Dodds documents the graphic, date, intent, and limits; the earlier integration emphasis is credited to Guillermo Rauch. |

### Website fit

Fit is strong at the portfolio level: static validation and distinct unit/integration/E2E commands exist in [`package.json`](../../../package.json#L20-L35), workflows deliberately lean on integration ([`docs/testing/strategy.md`](../../testing/strategy.md#L5-L11)), and E2E is intentionally small ([`docs/testing/strategy.md`](../../testing/strategy.md#L23-L28)). The repository defines one Payload/Next application ([`src/AGENTS.md`](../../../src/AGENTS.md#L9-L13)), which matches Dodds's stated codebase/monolith boundary better than a distributed-service interpretation would.

The following must remain explicit:

- the repository's definitions of unit, integration, tooling, data-integrity, Storybook, and E2E suites;
- access-control, auth, hook, and collection-contract obligations;
- exact smoke versus regression commands and environment prerequisites;
- the rule that the smallest affected local lane does not replace broader pipeline evidence.

### Evidence limit and disposition

No prompt ablation has yet shown that the phrase alone produces the same validation plan across the actual main and reviewer model classes. **Advance with qualification**, not as a bare replacement for the test strategy.

## Candidate 2: Example Mapping

### Canonical name and origin

Matt Wynne introduced **Example Mapping** in 2015 as a short, structured conversation for clarifying acceptance criteria. A story is explored through rules, concrete examples, and unanswered questions; the session stops when the scope is clear or time runs out ([Wynne, _Introducing Example Mapping_](https://medium.com/@mattwynne/introducing-example-mapping-42ccd15f8adf); [Cucumber documentation](https://cucumber.io/docs/bdd/example-mapping/)).

### Meaning and boundary

Example Mapping discovers testable behavior before implementation. It separates:

- the story or requested behavior;
- rules that summarize constraints;
- concrete examples that can become acceptance tests;
- unresolved questions or assumptions.

It is not synonymous with BDD, Gherkin, Given-When-Then syntax, a Definition of Done, or a demand to automate every example. It is a lightweight discovery method, not a test runner or a new issue template.

### Semantic Anchor assessment

| Criterion | Assessment |
| --- | --- |
| Precise | **High.** The four information types and stopping condition are concrete. |
| Rich | **High.** The term carries scope clarification, examples, questions, and a path to acceptance evidence. |
| Consistent | **Medium-high.** Cucumber documents one stable meaning, but model behavior still needs the accepted smoke test because some models may broaden it into full BDD ceremony. |
| Attributable | **High.** The original author, introduction, and maintained first-party documentation are identifiable. |

### Website fit

The method fits only when expected behavior is unclear. The repository already asks tests to prove product-facing behavior and to avoid implementation mirrors ([`tests/AGENTS.md`](../../../tests/AGENTS.md#L22-L29)). Root instructions also constrain completeness work to stated scope and acceptance criteria and require ambiguity-reducing examples to stay short ([`AGENTS.md`](../../../AGENTS.md#L36-L42)). Example Mapping gives those requirements a standard, time-bounded shape without requiring a comprehensive BDD process.

The following must remain explicit:

- the particular feature, rule, and domain boundary being explored;
- unresolved questions and assumptions rather than invented answers;
- which examples are acceptance evidence versus optional exploration;
- repository-specific test placement, fixtures, commands, and safety constraints.

### Evidence limit and disposition

Example Mapping does not require adopting Cucumber or Gherkin, and this report recommends no such adoption. The method's value is in planning behavior, not changing test syntax. **Advance as an optional ambiguity trigger**, not as a global requirement for every change.

## Candidate 3: Contract Testing

### Canonical name and origin

Martin Fowler describes **Contract Testing** as checking that calls made through a test double remain consistent with an external service's contract. Consumer-driven variants let consumers express the parts of a provider interface they rely on and let providers verify those expectations ([Fowler, _Contract Test_](https://martinfowler.com/bliki/ContractTest.html); [Ian Robinson, _Consumer-Driven Contracts_](https://martinfowler.com/articles/consumerDrivenContracts.html)).

### Meaning and boundary

The public method verifies a boundary between a service provider and one or more consumers. It focuses on compatible requests, responses, and observable interface obligations rather than deeply retesting provider behavior.

It must stay distinct from:

- ordinary integration tests that exercise multiple units inside one application;
- schema validation without a real consumer/provider obligation;
- Design by Contract inside program logic;
- the Website's local `Collection Contract Model`, which is a coverage registry for CRUD, denied writes, relationships, and hook effects.

### Semantic Anchor assessment

| Criterion | Assessment |
| --- | --- |
| Precise | **High in its public boundary context; low if applied to the current local model.** |
| Rich | **High.** It carries provider, consumer, compatibility, and independently verifiable expectations. |
| Consistent | **Medium-high.** Contract testing is well established, but `contract` is also used loosely for schemas and behavioral assertions. |
| Attributable | **High.** Fowler documents the category and Robinson documents the consumer-driven service-evolution pattern. |

### Website fit

The current `Collection Contract Model` has no external provider/consumer exchange. It registers integration suites against Payload collection slugs and enforces baseline/deep coverage ([`docs/testing/strategy.md`](../../testing/strategy.md#L30-L63), [`collectionContractRegistry.ts`](../../../tests/integration/contracts/collectionContractRegistry.ts#L1-L47)). Calling this simply `Contract Testing` would incorrectly suggest a service compatibility method and could cause an agent to propose Pact, provider verification, or extra service infrastructure.

If the public method is ever used for a real external boundary, the following must remain explicit:

- named provider and consumer;
- interface and compatibility obligations;
- ownership and execution cadence;
- whether the tests are provider-, consumer-, or consumer-driven;
- what deeper behavior remains outside the contract suite.

### Evidence limit and disposition

This research did not inventory every external integration route, so it does not rule out a future boundary-specific use. It does establish that the existing collection registry is not that method. **Do not advance as a replacement for current contract prose; reserve the public term for real service boundaries.**

## Candidate 4: Test Impact Analysis

### Canonical name and origin

**Test Impact Analysis** determines which parts of a system and which regression tests are affected by a change. The current ISTQB Advanced Level Test Analyst syllabus treats impact analysis as the most reliable automated regression-selection technique when tooling traces changed configuration items to tests; it also places regression scope inside risk control ([ISTQB CTAL-TA syllabus v4.0, section 2.2.1](https://www.istqb.org/wp-content/uploads/sdm-uploads/ISTQB-CTAL-TA-Syllabus-v4.0-EN.pdf)).

### Meaning and boundary

Test Impact Analysis selects relevant regression evidence from the change and its dependencies. It does not decide product risk on its own and does not guarantee that unselected tests are irrelevant unless traceability is complete.

It must stay distinct from:

- **risk-based testing**, which prioritizes effort using likelihood, impact, and criticality after affected scope is understood;
- **smoke testing**, which runs a small, usually stable subset to establish basic viability;
- path filters, which are one coarse implementation mechanism rather than proof of dependency impact;
- full regression, which intentionally executes the broader suite.

### Semantic Anchor assessment

| Criterion | Assessment |
| --- | --- |
| Precise | **High.** The input is a change and traceability; the output is affected regression scope. |
| Rich | **High.** The term carries change analysis, dependencies, traceability, regression selection, and residual-risk limits. |
| Consistent | **High when spelled out.** The acronym `TIA` should be avoided because it has unrelated meanings. Actual model behavior still needs the Anchor Smoke Test. |
| Attributable | **High.** ISTQB publishes a current, standardized testing syllabus and definitions. |

### Website fit

Fit is very strong. The root validation matrix is path-based ([`AGENTS.md`](../../../AGENTS.md#L44-L59)); tests should be selected for changed files ([`tests/AGENTS.md`](../../../tests/AGENTS.md#L20-L23)); and E2E changes run the smallest lane that proves the affected consumer behavior ([`tests/e2e/AGENTS.md`](../../../tests/e2e/AGENTS.md#L20-L27)). The repository's CI optimization research also already cites Test Impact Analysis as the name for incremental validation through automatic test selection ([`github-actions-pipeline-cost-optimization.md`](../github-actions-pipeline-cost-optimization.md#L224-L230)).

**Repository interpretation:** the current implementation is manual, policy-based Test Impact Analysis, not automated dependency tracing. The following must remain explicit:

- always-on gates such as formatting and any path-mandatory checks;
- known high-risk expansions for auth, access, hooks, shared E2E helpers, schema, migrations, and build output;
- the exact command or lane chosen and the affected behavior it proves;
- the broader CI or release evidence that covers uncertainty outside the local selection;
- escalation to broader regression when impact is unclear.

### Evidence limit and disposition

The repository contains path rules and human-readable mappings, not a verified test-to-code dependency graph. The anchor must not imply automatic precision. **Advance as `manual Test Impact Analysis` for local validation selection**, with the existing mappings retained as a local Semantic Contract.

## Comparison for the later decision

| Candidate | Concern | Repository fit | Bare-anchor safety | Process weight | Recommended status |
| --- | --- | --- | --- | --- | --- |
| Test Impact Analysis | Change-scoped regression evidence | Very strong | High when spelled out and qualified as manual | Low | Advance |
| Example Mapping | Behavioral acceptance and unresolved questions | Strong when behavior is ambiguous | Medium-high; guard against full-BDD expansion | Low and time-bounded | Advance as triggered method |
| Testing Trophy | Test-level portfolio and integration emphasis | Strong at portfolio level | Medium; local level definitions must survive | Low | Advance with attribution/qualifier |
| Contract Testing | Consumer/provider interface compatibility | Weak for current collection contracts | Low in the current vocabulary because `contract` collides | Potentially high if misapplied | Do not use for current model |

The **Testing Pyramid** should remain an explicitly rejected near-neighbor for the current integration-first portfolio, not silently blended with the Testing Trophy. It remains a useful public model for mixed test granularity and few high-level tests, but the unqualified phrase can pull the repository toward unit-count ratios that its current strategy does not specify.

## Lean Anchor Smoke Test

The accepted **Anchor Smoke Test** is a local evaluation constraint for the later decision. It is not a public Semantic Anchor and not a new software-testing process.

For each proposed replacement:

1. Freeze one real Website mini-case.
2. Compare the current explicit instruction with the shorter anchor variant while keeping the same non-compressible repository rules.
3. Score at most five must-have outcomes: correct method application, no confusion with the nearest method, preserved repository boundaries, equal-or-better usefulness, and material shortening.
4. Run once on the main model and once on the actually affected reviewer model.
5. Repeat twice only when the result is unclear or contradictory.

Record a small comparison table in the Wayfinder research context. Add broader evaluation only for safety-critical or hard-to-reverse rules. Passing the smoke test supports wording compression; it does not prove software correctness and does not replace repository validation commands.

## Decision constraints to carry forward

- Compose public methods only when they solve distinct concerns; do not invent an unnamed hybrid.
- Keep safety, access, environment, command, and ownership requirements explicit even when a method anchor is adopted.
- Treat the current `Collection Contract Model`, validation routing, and Anchor Smoke Test as local Semantic Contracts, not public anchors.
- Require actual main/reviewer model evidence before deleting explanatory prose.
- Prefer no anchor over a term whose public meaning conflicts with the repository's established vocabulary.

## Confidence

**High** on method definitions and the repository fit assessment because the findings use original author material, a current ISTQB syllabus, and current repository files. **Medium** on model consistency because no accepted Anchor Smoke Test has yet been executed against the actual main and reviewer model classes.
