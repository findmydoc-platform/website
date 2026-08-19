# Prompt Shortening and Stabilization Research

## Scope and evidence status

This note compares methods for shortening and stabilizing coding-agent prompts. It uses the linked Semantic Anchors project, official OpenAI and Anthropic documentation, and original research papers. It does not audit the repository's current prompt surfaces or decide which rules should change.

For this note, **Semantic Anchor** means the linked project's specific concept: an established, attributable term such as `TDD, London School` that points to a rich body of knowledge already present in a model. The project presents an open catalog and its own experiments, not a peer-reviewed theory or a provider guarantee. Its evaluation page explicitly treats cross-model reliability as something that must be measured. The reported anchor activation experiments are small and partly qualitative, including initial single runs per condition. ([About](https://llm-coding.github.io/Semantic-Anchors/about/), [evaluations](https://llm-coding.github.io/Semantic-Anchors/evaluations/), [training-data experiment](https://llm-coding.github.io/Semantic-Anchors/training-data-vs-practice/))

There is independent first-party evidence for the broader goal of prompt reduction. OpenAI reports that, in a sample of internal coding-agent evaluations, leaner system prompts improved scores by roughly 10–15% while reducing total tokens by 41–66% and cost by 33–67%. OpenAI marks these results as directional and recommends removing one instruction, example, or tool group at a time and rerunning representative evaluations. ([OpenAI model guidance](https://developers.openai.com/api/docs/guides/latest-model))

## Evidence-backed methods

### 1. Semantic Anchors: use public vocabulary as a compact prior

**Evidence.** The linked project defines an anchor as a precise, rich, consistent, and attributable public concept. Naming the concept does not teach the model a new rule; it attempts to activate knowledge learned during training. The project's Cockburn use-case experiment reports fuller and more consistent structure with a precise anchor than with a generic request across several model families. It also reports three failure modes for weak or recent terms: transparent substitution, silent substitution, and confabulation. ([quality criteria](https://llm-coding.github.io/Semantic-Anchors/about/), [experiment and limitations](https://llm-coding.github.io/Semantic-Anchors/training-data-vs-practice/))

**Tradeoff.** An anchor is short but intentionally delegates its meaning to a model's training prior. Its behavior can vary by model, version, language, alias, and surrounding system instructions. A niche, recent, overloaded, or internal term is therefore a poor anchor even when humans consider it well defined.

**Recommendation.** Use anchors only for stable public methods whose expected behavior can be stated and tested. Keep hard constraints, safety boundaries, exact project conventions, and acceptance criteria explicit. Qualify ambiguous anchors, for example `TDD, London School` instead of `TDD`.

### 2. Local semantic contracts: give project-specific shorthand an explicit definition

**Evidence.** The Semantic Anchors project distinguishes public anchors from **Semantic Contracts**: a contract defines what a term means inside a project, either by composing public anchors or by supplying a custom definition. OpenAI's official `ExecPlan` example uses the same underlying pattern without that label: `AGENTS.md` introduces an arbitrary project term, points to `PLANS.md`, and requires the agent to load that canonical definition when applicable. OpenAI explicitly notes that the model was not trained on the `ExecPlan` term. ([Semantic Contracts](https://llm-coding.github.io/Semantic-Anchors/contracts/), [OpenAI ExecPlans](https://github.com/openai/openai-cookbook/blob/main/articles/codex_exec_plans.md))

**Tradeoff.** A local alias saves tokens only when its definition is stored once and retrieved reliably. If the same alias is redefined across files, or its pointer is optional or stale, it hides ambiguity instead of reducing it.

**Recommendation.** Use a named contract for stable, project-specific policy bundles. Keep a one-line trigger and one canonical path in always-loaded guidance; keep the full definition in one referenced document. Do not present an invented internal label as though the base model already knows it.

### 3. File-scoped instruction layers: load rules only where they govern

**Evidence.** Codex discovers `AGENTS.md` files from the repository root down to the current directory. More specific files appear later and override broader guidance. The default combined project-instruction budget is 32 KiB, and OpenAI recommends nested files when guidance becomes too large. OpenAI also recommends placing code-review rules in the `AGENTS.md` closest to the code they govern and leaving formatting checks to CI. ([OpenAI AGENTS.md guide](https://developers.openai.com/codex/guides/agents-md/))

**Tradeoff.** Directory scoping reduces irrelevant context, but rules can disappear when work starts from a different directory or spans several subtrees. Deep override chains can also make effective policy harder to inspect.

**Recommendation.** Keep only repository-wide invariants at the root. Move module-specific architecture, test, UI, or operational rules to the nearest shared directory. Prefer additive local detail; use overrides only for genuine conflicts. Verify the loaded instruction chain from representative working directories.

### 4. Skills and policy modules: package repeatable procedures for on-demand loading

**Evidence.** OpenAI skills start with only a name and description in context and load the full `SKILL.md` when selected; references and scripts are read or run only as needed. OpenAI limits the initial skill catalog to 2% of the context window or 8,000 characters when the window is unknown, and recommends concise trigger descriptions with clear scope and boundaries. Anthropic independently describes the same progressive-disclosure structure: metadata first, full skill second, optional references later. ([OpenAI skills](https://developers.openai.com/codex/skills/), [Anthropic Agent Skills](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills))

**Tradeoff.** Skills reduce always-on prompt volume but introduce routing risk: a vague description can cause missed or accidental activation. Large skill catalogs can have shortened or omitted descriptions. Procedural text can also drift from the scripts and external systems it describes.

**Recommendation.** Use skills for repeatable multi-step workflows, not simple invariants. Give each skill one job, explicit inputs and outputs, positive and negative trigger boundaries, and deterministic scripts when procedural prose is insufficient.

### 5. Progressive disclosure and retrieval: load context and tools only when needed

**Evidence.** OpenAI tool search dynamically loads deferred tool definitions instead of putting every schema into the initial context, which can reduce token use and cost. Anthropic's context-engineering guidance similarly recommends agent-directed retrieval and progressive discovery, while noting the latency and navigation-quality tradeoff. ([OpenAI tool search](https://developers.openai.com/api/docs/guides/tools-tool-search), [Anthropic context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents))

**Tradeoff.** Retrieval moves cost from every request to runtime discovery. Weak indexing, vague descriptions, or missing routing instructions can make the agent chase irrelevant material or fail to load a critical rule.

**Recommendation.** Keep routing metadata compact but explicit: what source exists, when to load it, and what decision it supports. Retrieve reference material and large tool schemas on demand; do not defer always-applicable authorization or safety boundaries.

### 6. Few-shot and reference exemplars: show the local shape when words are ambiguous

**Evidence.** The original GPT-3 paper demonstrated task adaptation from textual examples without gradient updates. Later controlled research found that demonstrations can strongly communicate the label space, input distribution, and output format, even when their labels are not the primary performance driver. OpenAI's current model guidance recommends retaining examples when they encode a product requirement or correct a measured gap, while removing repeated examples that do not. ([Brown et al., 2020](https://arxiv.org/abs/2005.14165), [Min et al., 2022](https://aclanthology.org/2022.emnlp-main.759/), [OpenAI model guidance](https://developers.openai.com/api/docs/guides/latest-model))

**Tradeoff.** Examples consume more tokens than anchors, can overfit the output to accidental details, and become stale. One example can imply a rule that the team never intended.

**Recommendation.** Keep the smallest representative exemplar for a local format, tone, or edge case that prose or schemas do not capture reliably. Pair it with a short statement of the invariant; do not duplicate a large gallery of near-identical examples in every prompt.

### 7. Schemas and tool contracts: encode structure outside natural-language reminders

**Evidence.** OpenAI Structured Outputs enforce a supplied JSON Schema and remove the need for strongly worded formatting prompts. Strict function calling makes arguments adhere to the function schema rather than operating on a best-effort basis. Tool definitions also separate the tool name, usage description, parameter schema, and strictness. ([Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [function calling](https://developers.openai.com/api/docs/guides/function-calling))

**Tradeoff.** Schemas constrain syntax and enumerated choices, not factual correctness, policy compliance, or good judgment. Strict mode supports only a subset of JSON Schema and has operational constraints such as schema processing and caching behavior.

**Recommendation.** Move machine-checkable output shape, required fields, enums, and tool arguments into schemas. Leave intent, authorization, semantic quality, and exception handling in concise natural-language policy. Validate the returned meaning after validating its shape.

### 8. Checklists, rubrics, tests, and evals: move quality control out of repeated prose

**Evidence.** OpenAI recommends task-specific, scoped, automated evaluations; explicit objectives and metrics; continuous comparison; and pairwise, classification, or criteria-based judgments rather than open-ended impressions. The linked Semantic Anchors project likewise proposes comparing each anchor with a fair paraphrase across recognition, accuracy, depth, consistency, and application. ([OpenAI evaluation best practices](https://developers.openai.com/api/docs/guides/evaluation-best-practices), [Semantic Anchors evaluations](https://llm-coding.github.io/Semantic-Anchors/evaluations/))

**Tradeoff.** A checklist inside every prompt can become another long instruction block. A rubric or test outside the prompt stabilizes outcomes only if it actually runs and covers the real failure modes. Generic metrics and “vibe-based” review are weak substitutes for representative cases.

**Recommendation.** Keep a compact definition of success in the task prompt, then externalize repeatable checks into tests, linters, schemas, review rubrics, or eval fixtures. Treat the checks as evidence, not as a license to remove necessary domain or safety context.

## Selection matrix

| Information to encode | Preferred mechanism | Why | Do not compress away |
| --- | --- | --- | --- |
| Stable public methodology | Semantic Anchor | Dense, attributable shorthand | Qualifier when the term is ambiguous; expected behavior |
| Stable project-specific policy bundle | Named local contract + canonical definition | One local meaning, stored once | Definition, ownership, trigger, and precedence |
| Rule that applies only to a subtree | Nested `AGENTS.md` | File-scope relevance and precedence | Repository-wide invariants |
| Repeatable multi-step procedure | Skill | On-demand instructions, references, and scripts | Trigger boundaries and deterministic validation |
| Large or situational reference set | Retrieval / progressive disclosure | Avoids always-on context | Routing metadata and must-load conditions |
| Local output style or edge case | Minimal exemplar | Shows format and distribution directly | The invariant the example represents |
| Required output or tool shape | JSON Schema / strict tool contract | Machine-enforced structure | Semantic correctness and authorization policy |
| Acceptance and regression criteria | Tests, rubric, eval fixtures | Repeatable evidence across prompt changes | Task-specific success criteria |
| Safety, destructive-action, secret, or approval boundary | Explicit always-loaded policy | Failure cost is too high for inferred shorthand | Exact boundary, exception, and stop condition |

## Preliminary recommendation

The methods should be composed rather than treated as alternatives:

1. Keep a small always-loaded policy kernel containing authority, safety, precedence, and repository-wide invariants.
2. Scope path-specific rules through nested instruction files.
3. Replace repeated project procedures with named skills.
4. Replace stable internal bundles with named contracts that point to one canonical definition.
5. Use Semantic Anchors only inside those contracts or task prompts when the public term is precise and proven on the target models.
6. Move machine-checkable shape and quality gates into schemas, tests, and evals.
7. Retrieve large references, examples, and tool definitions only when the task requires them.

This ordering reduces prompt volume without making critical behavior depend on an unverified model prior.

## Validation before adopting a shorter prompt

Facts and recommendations should be tested separately. A practical evaluation should:

1. Freeze a representative baseline prompt and task set, including normal, edge, and adversarial cases.
2. Classify each current instruction as invariant, file-scoped rule, procedure, local contract, public anchor, example, schema, or validation rule.
3. Change one class at a time; do not combine deduplication, new anchors, and routing changes in one comparison.
4. Compare anchor and explicit-paraphrase variants on the actual model versions, in German and English where both are used, and with the real system/project instructions present.
5. Measure task success, required evidence, instruction adherence, false skill activation, missed retrieval, input and output tokens, latency, and cost.
6. Keep a shortened form only when quality is non-inferior and the token or maintenance reduction is material.

For an anchor specifically, test recognition, correct application, differentiation from adjacent methods, and consistency across aliases and prompt variants. A term that only labels the output correctly but does not change behavior is merely shorthand; a term that silently substitutes another method is unsafe.
