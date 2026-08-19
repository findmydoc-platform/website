# Website Instruction Semantics and Ownership

Date: 2026-08-19

## Scope and method

This inventory covers repository-owned instruction surfaces for the Website: layered `AGENTS.md` files, specialist agents, command rules, local skills, instruction playbooks, and their deterministic gates. It does not select a UI, testing, or architecture vocabulary and does not change instruction behavior.

The repository was inspected as the primary source. A full-scope `pnpm ai:slop-check --mode report` run passed and reported 49 scanned instruction files. A filesystem inventory found 24 layered `AGENTS.md` files with 904 lines, eight specialist definitions, two command-rule files, five local skill entry points, and three instruction-oriented playbooks. The checker owns the exact scan rules in [`scripts/ai-slop-policy-check.mjs`](../../../scripts/ai-slop-policy-check.mjs#L163-L207).

## Facts

### Active surfaces and current semantics

| Surface | Activation | Current owner | Current semantic role |
| --- | --- | --- | --- |
| 24 layered `AGENTS.md` files | Automatically by repository path | Root for repository-wide behavior; nearest directory for local behavior | Mandatory local invariants, routing, validation, and output contracts. The root declares this hierarchy as canonical ([`AGENTS.md`](../../../AGENTS.md#L3-L5)). |
| Eight `.codex/agents/*.toml` files | Explicit specialist delegation | One concern per reviewer | Read-only semantic review contracts. The root owns when reviewers may be recommended and run ([`AGENTS.md`](../../../AGENTS.md#L16-L21)). |
| Two `.codex/rules/*.rules` files | Command-prefix match | Repository command policy | Deterministic pre-execution blocks or prompts for destructive and workflow-sensitive commands ([`safety.rules`](../../../.codex/rules/safety.rules#L1-L19), [`workflow.rules`](../../../.codex/rules/workflow.rules#L1-L20)). |
| Five local `SKILL.md` entry points plus references and interface metadata | Opt-in or description-triggered | One reusable workflow per skill | Procedural workflows with discovery, decisions, stop conditions, output contracts, or external mutations. For example, the cache planner resolves exactly one of three repository cache outcomes ([`cache-impact-planner`](../../../.codex/skills/cache-impact-planner/SKILL.md#L12-L37)). |
| Mobile and instruction-quality playbooks | Explicit references from `AGENTS.md` or reviewer prompts | Subject-specific documentation | Detailed heuristics, checklists, source snapshots, and prompt scaffolding that should not all be always-loaded. The mobile playbook states this boundary directly ([`mobile-ai-playbook.md`](../../frontend/mobile-ai-playbook.md#L1-L3)). |
| `ai:slop-check`, pre-push hook, and deep-quality workflow | Local command, hook, scheduled/manual CI | Repository automation | Deterministic syntax, phrase, line/rule/example budget, and three regex conflict checks ([`ai-slop-policy-check.mjs`](../../../scripts/ai-slop-policy-check.mjs#L239-L264), [`ai-slop-policy-check.mjs`](../../../scripts/ai-slop-policy-check.mjs#L331-L403), [`deep-quality-lane.yml`](../../../.github/workflows/deep-quality-lane.yml#L43-L55)). |
| `docs:check` | Docs-only PR/push workflow | Documentation automation | Deterministic internal-link, inline-path, and documented-pnpm-command validation for `docs/**` and the root README ([`docs-consistency-check.mjs`](../../../scripts/docs-consistency-check.mjs#L6-L20), [`docs-check.yml`](../../../.github/workflows/docs-check.yml#L27-L54)). |

The repository already names public concepts such as Mobile First, Atomic Design, React Server Components, controlled components, table-driven tests, and behavior contracts. It does not currently define a `Semantic Anchor` vocabulary or a registry that distinguishes a public method name from a repository-specific contract. The strongest evidence is UI: Atomic Design is named as the organizing method ([`atomic-architecture.md`](../../frontend/atomic-architecture.md#L1-L4)), while the actual Payload/UI boundary is separately defined by repository instructions ([`src/AGENTS.md`](../../../src/AGENTS.md#L19-L27)).

### Ownership and reference drift

1. **The root instruction map is not exhaustive.** It calls a non-hidden `rg --files` command exhaustive and lists the active layers, but it omits `.github/AGENTS.md`, `src/migrations/AGENTS.md`, and `docs/roadmap/AGENTS.md` ([`AGENTS.md`](../../../AGENTS.md#L23-L34)). All three files exist and declare active path-local rules ([`.github/AGENTS.md`](../../../.github/AGENTS.md#L1-L17), [`src/migrations/AGENTS.md`](../../../src/migrations/AGENTS.md#L1-L15), [`docs/roadmap/AGENTS.md`](../../roadmap/AGENTS.md#L1-L6)). Without `--hidden`, the documented discovery command cannot find `.github/AGENTS.md`.

2. **The documented specialist inventory omits an implemented reviewer.** The repository has `cache_architecture_reviewer` with a narrow cache-policy contract ([`cache-architecture-reviewer.toml`](../../../.codex/agents/cache-architecture-reviewer.toml#L1-L27)), and the root routes cache-sensitive instruction work to it ([`AGENTS.md`](../../../AGENTS.md#L18-L21)). The specialist guide lists seven reviewers but not that reviewer ([`codex-specialists.md`](../../integrations/codex-specialists.md#L36-L53)).

3. **One active component instruction points to a missing file.** `src/components/AGENTS.md` requires the path .github/instructions/stories.instructions.md, but the .github/instructions directory does not exist ([`src/components/AGENTS.md`](../../../src/components/AGENTS.md#L36-L42)). The actual story owners are `src/stories/AGENTS.md` and `docs/frontend/story-governance.md` ([`src/stories/AGENTS.md`](../../../src/stories/AGENTS.md#L9-L21)).

4. **Reviewer skill exclusions use non-portable, stale paths in the current environment.** Seven reviewer definitions contain 34 references to versioned plugin-cache paths under a fixed `2abb1c44` segment; none of those 34 paths exists in the current machine snapshot. Examples are the six missing plugin paths in [`agent-instruction-reviewer.toml`](../../../.codex/agents/agent-instruction-reviewer.toml#L50-L72) and five in [`mobile-ui-reviewer.toml`](../../../.codex/agents/mobile-ui-reviewer.toml#L43-L61). The repository guide already warns that these cache paths change after plugin refreshes ([`codex-specialists.md`](../../integrations/codex-specialists.md#L28-L34)). The unversioned global skill paths referenced by the same definitions do exist in this snapshot.

5. **A semantic cross-reference is false even though its file exists.** The Atomic Architecture checklist says multi-part UI must strictly follow the Compound Component pattern and points to `src/components/AGENTS.md` ([`atomic-architecture.md`](../../frontend/atomic-architecture.md#L72-L79)). That instruction file permits context for local compound-component coordination but does not require the Compound Component pattern ([`src/components/AGENTS.md`](../../../src/components/AGENTS.md#L15-L25)).

### Conflicting or duplicated semantics

1. **The documented Atomic Design variant conflicts with the active Payload/UI boundary.** The architecture document says organisms may accept Payload types and templates often fetch data ([`atomic-architecture.md`](../../frontend/atomic-architecture.md#L18-L33)). The active `src/**` contract says all presentational UI under `src/components/**` must remain Payload-free and that Payload-aware mapping belongs in blocks or route adapters ([`src/AGENTS.md`](../../../src/AGENTS.md#L19-L27)); the closest component instructions repeat that prohibition ([`src/components/AGENTS.md`](../../../src/components/AGENTS.md#L28-L34)). Naming only "Atomic Design" therefore cannot encode the repository's intended variant.

2. **Mobile behavior has multiple prose owners.** The mobile playbook calls itself canonical and says path-local instructions should reference the matrix and evidence thresholds instead of restating them ([`mobile-ai-playbook.md`](../../frontend/mobile-ai-playbook.md#L1-L3)). The root nevertheless repeats the viewport, failure-mode, evidence, and handoff requirements ([`AGENTS.md`](../../../AGENTS.md#L60-L68)), while route and component instructions add overlapping variants ([`src/app/(frontend)/AGENTS.md`](<../../../src/app/(frontend)/AGENTS.md#L59-L65>), [`src/components/AGENTS.md`](../../../src/components/AGENTS.md#L64-L68)).

3. **Architecture and validation sentences are copied across path layers without narrowing.** Examples include the same admin validation command in four files ([`src/app/(payload)/AGENTS.md`](<../../../src/app/(payload)/AGENTS.md#L25-L29>), [`AdminBranding/AGENTS.md`](../../../src/components/organisms/AdminBranding/AGENTS.md#L17-L21), [`DeveloperDashboard/AGENTS.md`](../../../src/components/organisms/DeveloperDashboard/AGENTS.md#L20-L24), [`adminDashboard/AGENTS.md`](../../../src/dashboard/adminDashboard/AGENTS.md#L16-L20)); the same permission-matrix update rule in collections, hooks, API, and seed instructions ([`src/collections/AGENTS.md`](../../../src/collections/AGENTS.md#L25-L29), [`src/hooks/AGENTS.md`](../../../src/hooks/AGENTS.md#L20-L23), [`src/app/api/AGENTS.md`](../../../src/app/api/AGENTS.md#L20-L23), [`src/endpoints/seed/AGENTS.md`](../../../src/endpoints/seed/AGENTS.md#L16-L19)); and the same Payload-free component boundary across `src`, frontend routes, components, and stories ([`src/AGENTS.md`](../../../src/AGENTS.md#L19-L27), [`src/stories/AGENTS.md`](../../../src/stories/AGENTS.md#L23-L36)). These copies make ownership unclear and can diverge independently.

4. **Reviewer execution guidance has an approval ambiguity.** The root requires explicit user confirmation before reviewers run ([`AGENTS.md`](../../../AGENTS.md#L18-L21)). The mobile playbook says to use reviewers in a fixed order without restating that gate ([`mobile-ai-playbook.md`](../../frontend/mobile-ai-playbook.md#L129-L137)), and the specialist guide's operating model starts with running specialists ([`codex-specialists.md`](../../integrations/codex-specialists.md#L87-L100)). The root has precedence, but the lower-level procedure is unsafe to read in isolation.

5. **The deterministic-gate description is broader than its actual enforcement.** The instruction-review playbook calls `pnpm ai:slop-check` a blocking gate ([`agent-instruction-review-playbook.md`](../agent-instruction-review-playbook.md#L42-L55)). The root and anti-slop playbook clarify that it is local/pre-push and deep-lane enforcement, not a blocking step in the main PR lane ([`AGENTS.md`](../../../AGENTS.md#L48-L59), [`ai-anti-slop-playbook.md`](../ai-anti-slop-playbook.md#L19-L39)).

### Deterministic coverage gaps

The successful 49-file AI-slop run proves only the implemented checks. The checker limits files to 180 lines, 24 hard-rule lines, and one example block in most instruction files ([`ai-slop-policy-check.mjs`](../../../scripts/ai-slop-policy-check.mjs#L44-L50), [`ai-slop-policy-check.mjs`](../../../scripts/ai-slop-policy-check.mjs#L351-L375)). It does not validate referenced paths, router-map completeness, specialist-document parity, ownership, or architecture claims. Its only semantic conflict checks are three regex pairs for language, filler, and build policy ([`ai-slop-policy-check.mjs`](../../../scripts/ai-slop-policy-check.mjs#L64-L80), [`ai-slop-policy-check.mjs`](../../../scripts/ai-slop-policy-check.mjs#L378-L403)).

Line count is also not a context-size measure. The root file is 15,384 bytes and 179 physical lines, while its reviewer-routing line alone is 843 bytes. The checker counts newline-separated entries and compares only that count with the 180-line ceiling ([`ai-slop-policy-check.mjs`](../../../scripts/ai-slop-policy-check.mjs#L239-L240), [`ai-slop-policy-check.mjs`](../../../scripts/ai-slop-policy-check.mjs#L351-L360)).

The docs checker already demonstrates a low-cost model for reference validation, but its input is only `docs/**` and the root README ([`docs-consistency-check.mjs`](../../../scripts/docs-consistency-check.mjs#L193-L229)). It therefore cannot catch the missing path in `src/components/AGENTS.md` or stale paths in reviewer TOML files.

### Rules that are not safe public-anchor replacements

The following meanings depend on this repository and must remain explicit even if a public method name is added:

| Repository meaning | Evidence | Why a public term is insufficient |
| --- | --- | --- |
| Website and Clinic Dashboard share a platform release rather than independent Website releases | [`AGENTS.md`](../../../AGENTS.md#L7-L10) | Product topology and release authority are private operating facts. |
| Reviewer approval, severity, and fix gates | [`AGENTS.md`](../../../AGENTS.md#L16-L21) | These are user-governance decisions, not properties of code review as a general method. |
| Path-based validation commands and build prerequisites | [`AGENTS.md`](../../../AGENTS.md#L44-L59) | Commands and applicability depend on this toolchain and repository. |
| Vercel project, team, domains, and authentication boundary | [`AGENTS.md`](../../../AGENTS.md#L71-L82) | Deployment identity and safety constraints are repository-specific. |
| Payload/UI adapter boundary and normalized UI shapes | [`src/AGENTS.md`](../../../src/AGENTS.md#L19-L27) | The boundary is a local architecture contract that specializes any public architecture vocabulary. |
| Cache decisions, tags, owners, and stop conditions | [`src/AGENTS.md`](../../../src/AGENTS.md#L40-L45), [`cache-impact-planner`](../../../.codex/skills/cache-impact-planner/SKILL.md#L14-L37) | The vocabulary names accepted local architecture and approval boundaries. |
| E2E admin account, fixture, artifact, and lane rules | [`tests/e2e/AGENTS.md`](../../../tests/e2e/AGENTS.md#L9-L27) | These are concrete test infrastructure contracts, not a generic testing method. |
| Destructive command blocks and prompts | [`safety.rules`](../../../.codex/rules/safety.rules#L1-L19), [`safety.rules`](../../../.codex/rules/safety.rules#L86-L124) | Enforcement must not depend on a model inferring a named safety principle. |

## Recommendations

### Proposed classification

| Concern | Proposed owner | Classification | Treatment |
| --- | --- | --- | --- |
| Public UI, testing, or architecture method names | A small vocabulary document selected by later research/decision tickets | Public Semantic Anchor | Use only when the term has a stable public meaning and rejected near-neighbours are recorded. Do not repeat its textbook definition in every instruction. |
| Payload/UI, cache, deployment, validation, and reviewer-governance meanings | Nearest stable `AGENTS.md` or an explicitly linked repository contract | Local Semantic Contract | Keep the repository-specific delta explicit. A public anchor may introduce the method, but it cannot replace the delta. |
| Multi-step collection, cache, design-handoff, screenshot, release, migration, PR, or authenticated-browser work | One local skill per reusable workflow | Skill | Keep only a short trigger, hard invariant, and stop condition in always-loaded instructions; retrieve steps when invoked. |
| Destructive commands, path/reference validity, import boundaries, metadata parity, and stable validation selection | `.codex/rules`, lint/scripts, hooks, or CI | Deterministic check | Enforce mechanically when false positives can remain low; keep prose as the human-readable reason, not the only control. |
| User authorization, secret boundaries, destructive semantics, external identity, and unresolved architecture decisions | Root or nearest governing `AGENTS.md` plus command rules where possible | Non-compressible invariant | Keep explicit and testable. Do not replace with a Semantic Anchor. |
| Specialist review criteria | One `.codex/agents/*.toml` file per concern | Specialist contract | Keep concern-specific criteria in the reviewer; inherit shared severity and approval behavior from one owner. |

### Decision order

1. Repair the factual graph before shortening prose: complete the instruction map, remove or replace broken references, align the Atomic Design document with the active Payload/UI boundary, and bring the specialist guide in sync with implemented reviewers.
2. Assign one owner for each repeated concern. Child `AGENTS.md` files should reference the owner or state only a true local exception; they should not copy the parent contract unchanged.
3. Classify each remaining statement as public anchor, local contract, skill procedure, deterministic check, or non-compressible invariant. If a statement does not fit one class, split it before editing.
4. Move only repeatable procedures behind skills. First candidates are Payload migration execution, PR/issue assembly, authenticated mobile verification, and admin journey selection. Preserve their authorization and stop conditions in the governing instruction layer.
5. Add narrow deterministic checks before relying on shorter prompts: instruction-reference existence, router/specialist inventory parity, a byte or long-line budget alongside line count, and stable import-boundary rules such as the Payload-free `src/components/**` contract. Exact duplicate-line reporting can remain advisory because some repetition is intentional.
6. Evaluate any proposed anchor substitution with one frozen repository case against the current prose. The substitution should retain method accuracy, adjacent-method separation, repository boundaries, usefulness, and materially reduce instruction size before migration proceeds.

## Decision-ready conclusion

The repository already has the correct high-level instruction architecture: path-scoped contracts, opt-in specialists, opt-in skills, command rules, and deterministic gates. The main problem is not the absence of more prompt terminology. It is that several concerns have multiple prose owners, some referenced sources are stale or contradictory, and existing gates validate form more strongly than meaning.

Semantic Anchors should therefore be introduced only after ownership repair. They are suitable for the stable public portion of methods such as Mobile First or Atomic Design. The findmydoc-specific variant, validation commands, safety boundaries, and approval rules remain explicit local contracts or deterministic controls. This separation allows shorter prompts without asking a method name to carry facts it cannot contain.
