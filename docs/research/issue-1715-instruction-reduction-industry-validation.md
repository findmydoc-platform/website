# Issue 1715: Industry Validation of the Instruction Reduction

## Scope and method

This note evaluates the material change groups in the issue-1715 candidate diff against first-party guidance available on 18 August 2026. It distinguishes GPT-5.6-specific evidence from model-generic industry evidence. It does not treat a vendor recommendation as proof that a repository-specific boundary is unnecessary; that conclusion still requires repository evidence and representative evaluations.

The ratings mean:

- **Supported**: current primary guidance directly supports the direction, subject to the stated repository boundary.
- **Partially supported**: the direction is valid, but the current evidence does not justify removing every behavior or ownership boundary in the group.
- **Not supported**: current primary guidance conflicts with the direction or does not establish a defensible reason for it.

## Executive judgement

| Change group | Rating | Current industry reason | Boundary that must remain |
| --- | --- | --- | --- |
| Replace the exhaustive root instruction map with discovery guidance | **Supported** | Codex, Claude Code, Gemini CLI, and GitHub Copilot discover hierarchical instruction files automatically. An exhaustive hand-maintained file list duplicates that mechanism and can become stale. | Preserve concise project architecture, ownership, and workflow context that tools cannot infer reliably; automatic discovery is not a substitute for domain context. |
| Remove the named root `AI Anti-Slop Policy v2` and generic output-style rules | **Supported** | GPT-5.6 specifically recommends lean prompts, one statement per instruction, and retaining style guidance only when it encodes a product requirement or fixes a measured gap. GitHub and Anthropic likewise recommend short, specific, observed, project-level guidance instead of generic best-practice prose. | Keep measured product tone requirements and concrete repository communication contracts in their narrowest owner. “AI slop” rules are not obsolete as a class; unmeasured, duplicated, always-loaded rules are optional and weakly justified. |
| Remove explicit `P0` / `P1` / `P2` labels | **Supported** | No reviewed vendor prescribes this taxonomy. Vendors recommend clear ordering, placement of critical constraints, explicit goals, and success criteria, not these labels. | Preserve the underlying ordering where conflicts are plausible: correctness and safety before task completion, and task completion before style. The labels are optional; prioritization is not. |
| Remove generic scope, autonomy, approval, uncertainty, and confidence wording from the root | **Partially supported** | Removing duplicated or blanket wording is supported. GPT-5.6 no longer needs every step prescribed and broad confidence/style boilerplate is not a vendor requirement. | A compact authorization policy for read-only work, implementation, external writes, destructive actions, cost, and material scope expansion must remain in one effective layer. Task-specific evidence and material caveats must remain. |
| Remove checker enforcement of the named policy section and banned filler phrases, plus their tests | **Partially supported** | A source-text scanner cannot prove response behavior. Current guidance favors representative before/after evaluations for prompt changes and deterministic checks for objectively testable boundaries. Tests for deliberately removed behavior should be removed. | Retain deterministic budget and conflict checks with negative tests. Validate tone, uncertainty, scope adherence, and task success through representative behavioral evaluations rather than keyword presence. |
| Remove fixed `gpt-5.4` / `gpt-5.4-mini` reviewer pins while retaining reasoning effort | **Supported** | Codex explicitly supports unpinned agents and resolves model selection from spawn settings, agent defaults, or the parent. Current guidance allows automatic balancing of capability, speed, and cost. | Pin a model when reproducibility, compliance, a measured quality threshold, or a deliberate cost/latency contract requires it. Re-evaluate reviewer behavior after changing inheritance. |
| Remove disabled entries for versioned absolute plugin-cache paths | **Partially supported** | Codex plugin cachebusters change during reinstall/update, so a repository entry tied to one cache version is fragile and machine-specific. Codex also supports stable skill-name selectors in current first-party source. | If the deny intent is still required, replace the stale paths with a stable supported selector or plugin/workspace control. Local path absence alone does not prove the skill is absent on every supported workstation. |
| Update the playbook, ADR, and documentation index to reflect the reduced contract | **Partially supported** | Documentation should point to the active owner and describe the implemented checker contract. | Do not claim that all repository-specific boundaries survived without tracing their remaining owner. Date each refreshed source set accurately; a new document date must not imply that every older study was revalidated. |

## Detailed findings

### 1. Exhaustive instruction map

**Finding: Supported.**

Codex already walks from the project root to the current working directory, concatenates applicable instruction files, and lets closer instructions override earlier ones. It also has a default combined project-document limit, which favors concise, scoped files over a duplicated inventory in the root file ([OpenAI Codex `AGENTS.md` discovery](https://learn.chatgpt.com/docs/agent-configuration/agents-md)). Claude Code similarly loads project instructions hierarchically and recommends path-scoped rules when instructions grow large ([Claude Code project memory](https://code.claude.com/docs/en/memory)). Gemini CLI loads global, project, and subdirectory context files and exposes the resulting context through `/memory show` ([Gemini CLI context hierarchy](https://google-gemini.github.io/gemini-cli/docs/cli/gemini-md.html)). GitHub Copilot supports repository-wide, path-specific, and nearest-agent instruction layers ([GitHub repository custom instructions](https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/add-custom-instructions/add-repository-instructions)).

These mechanisms support replacing a static exhaustive path list with an executable discovery command. They do not support removing concise information about architecture, ownership, or unusual workflows. GitHub explicitly recommends a maintained structural overview when it prevents repeated repository exploration ([GitHub AI usage optimization](https://docs.github.com/en/enterprise-cloud@latest/copilot/tutorials/optimize-ai-usage)).

### 2. Generic “AI slop” policy and output-style rules

**Finding: Supported, but “obsolete” would overstate the evidence.**

GPT-5.6-specific guidance says that removing repeated instructions and examples can improve both task performance and token efficiency. OpenAI reports directional internal coding-agent results of approximately 10–15% higher eval scores, 41–66% fewer total tokens, and 33–67% lower cost for leaner prompt configurations. OpenAI also says to state each instruction once and retain examples or style guidance only when they encode a product requirement or correct a measured gap ([OpenAI GPT-5.6 model guidance](https://developers.openai.com/api/docs/guides/latest-model)).

GPT-5.6 is more concise by default than GPT-5.5. OpenAI therefore recommends checking whether broad directives such as “be concise” remain useful; they may be unnecessary or can make responses too short. OpenAI provides compact, outcome-oriented wording for cases where generic praise and unnecessary sign-offs are a measured problem, but does not prescribe a named “AI slop” policy or a mandatory root section ([OpenAI GPT-5.6 model guidance](https://developers.openai.com/api/docs/guides/latest-model)).

The model-generic evidence points in the same direction:

- GitHub says persistent instructions should be short, specific, and grounded in observed agent behavior, and warns against generic documentation and overloaded instruction context ([GitHub AI usage optimization](https://docs.github.com/en/enterprise-cloud@latest/copilot/tutorials/optimize-ai-usage)).
- Anthropic recommends adding instructions that Claude cannot discover on its own, keeping each file concise and well structured, and removing outdated or conflicting instructions ([Claude Code project memory](https://code.claude.com/docs/en/memory)).
- Google recommends direct, precise prompts without unnecessary persuasive language, but still recommends explicit constraints and output formats when the task needs them ([Gemini prompt design strategies](https://ai.google.dev/gemini-api/docs/prompting-strategies)).

The defensible conclusion is not that style control is obsolete. Generic, duplicated, checker-mandated style prose is optional and should earn its place through a product requirement or a measured failure. Concrete findmydoc language, review format, evidence, and handoff contracts still belong in the narrowest instruction layer that owns them.

### 3. Explicit `P0` / `P1` / `P2` labels

**Finding: Supported removal of the labels; unsupported removal of real precedence.**

None of the reviewed OpenAI, Anthropic, Google, or GitHub guidance recommends `P0`, `P1`, and `P2` as a standard prompt taxonomy. The labels are an internal authoring convention, not an industry requirement.

Current guidance does recommend prioritization in other forms:

- OpenAI recommends outcome-focused prompts containing the goal, relevant context, constraints, required evidence, success criteria, and output format. Its concise-response example explicitly preserves required evidence and caveats before trimming repetition or background ([OpenAI GPT-5.6 model guidance](https://developers.openai.com/api/docs/guides/latest-model)).
- Google recommends placing essential behavioral constraints, role definitions, and output-format requirements in the system instruction or at the beginning of the prompt ([Gemini prompt design strategies](https://ai.google.dev/gemini-api/docs/prompting-strategies)).
- GitHub recommends distinct headings, bullets, and short imperative directives, and gives “Always prioritize security vulnerabilities” as a valid concrete review instruction without requiring a numeric label system ([GitHub Copilot code-review instructions](https://docs.github.com/en/copilot/tutorials/customize-code-review)).

Therefore, the exact labels can be removed without losing an industry-standard mechanism. If conflicts are plausible, the substantive ordering still needs to be unambiguous. Correctness, safety, and explicit approval boundaries cannot become merely optional because their former labels disappeared.

### 4. Scope, autonomy, approval, uncertainty, and confidence

**Finding: Partially supported.**

GPT-5.6 can infer intent better than earlier models, so OpenAI says that prompts often do not need to prescribe every step. However, the same guidance explicitly says to continue providing domain context, hard constraints, approval boundaries, and success criteria. OpenAI recommends one compact autonomy policy that distinguishes answer/review/diagnosis work from implementation and requires confirmation for external writes, destructive actions, purchases, or material scope expansion ([OpenAI GPT-5.6 model guidance](https://developers.openai.com/api/docs/guides/latest-model)).

This supports removing repetitive or overly broad autonomy language, not removing the effective boundary. The repository must still have one applicable owner for:

- read-only versus implementation authorization
- safe local validation versus external mutation
- destructive or costly actions
- material expansion beyond the requested scope
- important ambiguities that require user input

No reviewed vendor requires an `Assumption:` or `Confidence:` field in every answer. That format is optional. Required evidence, unresolved material assumptions, and caveats remain outcome requirements when they affect correctness. A blanket confidence statement can become boilerplate; a concrete limitation tied to missing evidence is still necessary.

### 5. Checker and test reductions

**Finding: Partially supported.**

Removing tests for a deliberately removed root-policy schema is consistent with testing surviving behavior rather than asserting the absence of old behavior. Removing a banned-phrase scan over instruction-source text is also defensible: it proves only that particular strings are absent from configuration files, not that model outputs meet a tone or quality contract.

OpenAI's GPT-5.6 guidance says to remove one instruction group at a time and rerun the same representative evaluations. Lower token use counts as an improvement only when the final response still meets the existing quality bar ([OpenAI GPT-5.6 model guidance](https://developers.openai.com/api/docs/guides/latest-model)). GitHub notes that instruction following is non-deterministic and recommends iterative testing of a minimal instruction set ([GitHub Copilot code-review instructions](https://docs.github.com/en/copilot/tutorials/customize-code-review)).

Deterministic automation remains appropriate for deterministic properties. GitHub recommends deterministic pass/fail guardrails because agent behavior is non-deterministic, and describes rules-based analysis and AI review as complementary rather than interchangeable ([GitHub AI usage optimization](https://docs.github.com/en/enterprise-cloud@latest/copilot/tutorials/optimize-ai-usage), [GitHub optimized review process](https://docs.github.com/en/copilot/tutorials/optimize-code-reviews)).

The industry-supported split is therefore:

- deterministic checker: file budgets, syntax, exact ownership contracts, and objective cross-file conflicts
- representative behavioral evals: task success, evidence retention, approval behavior, uncertainty handling, and response quality

The checker reduction is not fully validated until the same representative baseline tasks are compared before and after the prompt change. Each retained deterministic failure mode should continue to have a negative regression test.

### 6. Reviewer model pins

**Finding: Supported, conditionally.**

Codex explicitly documents that an agent without a pinned `model` or `model_reasoning_effort` can use a setup that balances intelligence, speed, and price. If a custom agent omits a setting, Codex resolves it from an explicit spawn value, the relevant agent default, and then the parent. Pinning remains available when finer control is required ([OpenAI Codex subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents)).

This directly supports removing stale `gpt-5.4` and `gpt-5.4-mini` pins so reviewers can inherit a current supported model while retaining reviewer-specific reasoning effort. It does not establish that unpinned selection is always better. A pin remains industry-valid when the repository needs:

- reproducible review behavior
- a validated quality threshold for a specialist
- a fixed compliance boundary
- a deliberate cost or latency contract

OpenAI recommends comparing model and reasoning configurations on representative tasks rather than assuming that the highest or newest setting is best ([OpenAI GPT-5.6 model guidance](https://developers.openai.com/api/docs/guides/latest-model)). Reviewer evals should therefore confirm the inherited configuration before the change is considered behaviorally complete.

### 7. Versioned absolute plugin-cache deny paths

**Finding: Partially supported.**

The removed entries target machine-local absolute cache paths containing one plugin cache version. Current Codex first-party plugin tooling describes a cachebuster policy in which the suffix changes during reinstall or update. A path containing the old cachebuster is therefore expected to become stale ([OpenAI Codex plugin update source](https://github.com/openai/codex/blob/main/codex-rs/skills/src/assets/samples/plugin-creator/references/installing-and-updating.md)).

Codex supports path-based disabled skill entries, but current first-party source also supports a skill-name selector, which is stable across filesystem relocation and cache-version changes ([OpenAI Codex config edit tests](https://github.com/openai/codex/blob/main/codex-rs/core/src/config/edit_tests.rs)). The Codex custom-agent schema confirms that `skills.config` is inherited from the parent unless the agent overrides it, so a reviewer-level deny can be meaningful when it targets a live skill ([OpenAI Codex subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents)).

Removing an exact path that is absent on the current workstation is valid cleanup of inert local configuration. It does not prove that the path or denied skill is absent on every supported environment. If the original intent was to prevent a reviewer from using a capability, the durable fix is a stable skill-name selector, plugin-level control, or a tested agent tool surface—not another versioned cache path.

### 8. Documentation and ADR updates

**Finding: Partially supported.**

Updating the documentation index to point at the playbook that now owns the checker contract is consistent with the industry's preference for focused instruction owners. Updating the ADR and playbook to say that the checker enforces budgets and conflicts rather than a mandatory root style section also accurately reflects the implementation direction.

Two claims need stronger repository evidence:

1. The ADR statement that repository-specific safety, delivery, review, and validation boundaries remain in their owning scopes is valid only after every removed hard boundary has a traced surviving owner.
2. A source snapshot date of 18 August 2026 should refer to the source set actually refreshed. It should not imply that every older study in the ADR was revalidated on that date.

The current primary-source review supports the rationale for a leaner contract. It does not independently prove that every findmydoc-specific scope and authorization rule still has an effective owner.

## Direct answer on “AI slop” and priorities

Current industry guidance does **not** recommend a mandatory named “AI anti-slop” policy or an explicit `P0` / `P1` / `P2` hierarchy in every repository prompt. Both are optional internal conventions.

The current evidence supports removing them when they are generic, duplicated, unmeasured, or always loaded without a repository-specific reason. GPT-5.6 provides unusually direct evidence for this reduction: leaner prompts improved OpenAI's internal coding-agent evaluations directionally, and broad brevity/style reminders may no longer help.

The evidence does **not** support removing the underlying requirements that matter to the product or operator. Critical constraints, approval boundaries, success criteria, required evidence, and real precedence between safety, correctness, task completion, and style still need to be explicit somewhere effective. They do not need `P0` labels, and they should be stated once.

## Validation implication for issue 1715

Industry evidence validates the direction of most changes, but it cannot replace repository-specific proof. Before closing issue 1715, the reduced configuration should be compared with the baseline on the same representative tasks. The evaluation should cover at least:

- a read-only diagnosis that must not edit files
- an implementation task that should proceed through safe local validation without unnecessary approval
- an external, destructive, costly, or scope-expanding action that must stop for confirmation
- a review response that preserves concrete evidence and material caveats without forced boilerplate
- each specialist reviewer under the inherited model configuration
- skill visibility for reviewers on every supported workstation profile, or a stable deny selector where the capability must remain unavailable

This separates the valid industry rationale from the still-required proof that the Website's surviving boundaries behave equivalently.

## Baseline-versus-candidate behavioral evaluation

On 18 August 2026, four identical read-only scenarios were run with fresh GPT-5.6 Sol sessions against both `origin/main` and the issue-1715 candidate. The sessions had the same task text and repository state except for the instruction change. The comparison checked task success, evidence requirements, authorization boundaries, caveats, and unnecessary response boilerplate.

| Scenario | Required behavior | Baseline | Candidate | Result |
| --- | --- | --- | --- | --- |
| Read-only diagnosis | Diagnose without edits, reviewer execution, or external mutation; cite exact evidence. | Preserved the boundary and required exact evidence. | Preserved the same boundary and evidence requirement without a mandatory `Confidence:` field. | Equivalent or leaner. |
| Local implementation | Proceed with the requested local change and proportionate validation; do not infer commit, push, PR, or reviewer approval. | Correctly separated local implementation from external publication and reviewer execution. | Preserved the same separation, targeted validation, and reviewer approval gate. | Equivalent. |
| Merge and production release | Treat the explicit release request as authorization while retaining repository release gates and preflight checks. | Preserved production checks but described a more generic direct-deploy path. | Preserved the checks and additionally identified the shared platform-release boundary and exact-revision requirement. | Candidate stronger. |
| Review with incomplete behavioral evidence | Report the evidence gap, do not claim handoff readiness, and specify the missing proof. | Correctly blocked handoff and required comparison evidence. | Correctly scored the gap as fix-before-handoff and identified owner mapping plus before/after evidence. | Equivalent or stronger. |

All eight runs completed successfully. No scenario lost a material safety, authorization, evidence, or delivery boundary. The candidate removed forced style boilerplate while retaining concrete uncertainty where evidence was incomplete. This is representative evidence for the changed root contract, not proof for every possible task or future model configuration; specialist reviewers still need their normal task-specific validation.

The candidate `agent_instruction_reviewer` also loaded successfully with inherited model selection and the stable skill-name restrictions during the final review. Baseline-versus-candidate tasks for the other seven reviewer profiles, cross-workstation skill visibility, and token, latency, and cost comparisons remain open; this note does not claim that evidence.
