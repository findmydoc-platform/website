# Agent Instruction Review Playbook

This playbook is the repository-local source snapshot for reviewing Codex instruction files, specialist subagents, rules, and local skills in the website repository.

## Scope

Review these instruction surfaces together:

- `AGENTS.md` and nested `AGENTS.md` or `AGENTS.override.md`
- `.codex/agents/*.toml`
- `.codex/rules/*.rules`
- `.codex/skills/**/SKILL.md`
- `.codex/skills/**/references/*.md` when a skill depends on them
- `.codex/skills/**/agents/openai.yaml`
- governance docs under `docs/engineering/` that shape AI instruction behavior

## Review Heuristics

Use these checks before recommending more prompt text:

1. Prefer hierarchy over volume. Put durable, cross-cutting rules in the nearest stable `AGENTS.md`; put specialist behavior in `.codex/agents`; put reusable workflows in skills.
2. Keep one owner per concern. If two files tell the agent how to resolve the same decision, one should point to the other or clearly narrow the scope.
3. Convert broad natural-language rules into deterministic checks when they are stable enough to block in CI or hooks.
4. Treat user-visible warnings, validation commands, and scope boundaries as part of the instruction contract, not optional prose.
5. Keep skill descriptions front-loaded with trigger words because Codex may shorten large skill lists before the full `SKILL.md` is loaded.
6. Do not treat prompt hierarchy as a perfect safety boundary. Use path scoping, deterministic gates, and explicit review handoffs for conflicts.
7. Prefer short summaries plus links to research. Do not paste long study excerpts into always-loaded prompts.
8. When a rule exists only because of model behavior, name the source or local evidence that justifies it.

## Finding Severity

- `9-10`: A conflict or stale rule can cause destructive actions, secret exposure, broken release/deploy behavior, or systematic violation of a higher-priority repository rule.
- `7-8`: A broad or contradictory instruction can regularly misroute agents, skip required validation, or weaken a specialist reviewer.
- `6`: A concrete instruction gap can cause repeated incorrect work unless fixed.
- `5`: Real risk exists, but the cost or benefit of fixing needs a user decision. Always explain both sides and ask whether to fix.
- `3-4`: Quality or maintainability issue that should be known but does not need immediate work alone.
- `1-2`: Minor wording, navigation, or consistency issue.

The reviewer reports every credible finding from `1/10` upward. Findings scored `6/10` or higher are fix-before-handoff. Findings scored exactly `5/10` are decision gates.

## Deterministic Gate Coverage

`pnpm ai:slop-check` is the blocking deterministic gate for instruction quality. It should scan:

- layered `AGENTS.md` and `AGENTS.override.md`
- `docs/frontend/mobile-ai-playbook.md`
- `docs/engineering/*ai*playbook.md`
- `docs/engineering/*instruction*playbook.md`
- `.codex/agents/*.toml`
- `.codex/rules/*.rules`
- `.codex/skills/**/*.md`
- `.codex/skills/**/agents/openai.yaml`

Use the reviewer for semantic issues the checker cannot prove, such as stale research interpretation, unclear ownership, weak trigger boundaries, and tradeoffs around `5/10` findings.

## Source Snapshot

Snapshot date: 2026-06-02. Re-check the web when the user asks for latest/current guidance or when a source-sensitive claim would change implementation.

- [AGENTS.md](https://agents.md/): AGENTS.md is standard Markdown for coding-agent context, with no required fields. Nested AGENTS files are expected for large repositories; the nearest file should narrow or override broader guidance.
- [OpenAI Codex AGENTS.md](https://developers.openai.com/codex/guides/agents-md): Codex loads global and project guidance once per run, walking from project root to current directory and concatenating closer files later. The default project-doc limit makes concise, scoped instructions materially better than one large root file.
- [Unrolling the Codex agent loop](https://openai.com/index/unrolling-the-codex-agent-loop/): Codex aggregates user instructions, environment context, skills metadata, and the task into the request. This supports separating always-loaded rules from opt-in skills and specialist reviewers.
- [OpenAI Codex Subagents](https://developers.openai.com/codex/subagents): Subagents are useful for narrow, mostly read-only work that can be delegated and summarized back to the parent thread. Specialist reviewers should therefore have tight scope, no edit authority, and clear output contracts.
- [OpenAI Codex Skills](https://developers.openai.com/codex/skills): Skills use progressive disclosure: Codex initially sees name, description, and path, then reads `SKILL.md` only after selecting the skill. Skill descriptions must be concise, trigger-focused, and explicit about when the skill should and should not run.
- [OpenAI Auto-review](https://developers.openai.com/codex/auto-review): Auto-review is a reviewer swap at approval boundaries, not a permission grant. For this repo, blocking should remain deterministic through scripts/hooks/CI while semantic reviewers return findings.
- [OpenAI Instruction Hierarchy Challenge](https://openai.com/index/instruction-hierarchy-challenge/): OpenAI frames instruction priority as system > developer > user > tool and notes that hierarchy training improves robustness. Repository instructions should still avoid preventable conflicts because the model must resolve them at inference time.
- [The Instruction Hierarchy](https://arxiv.org/abs/2404.13208): Training models to prefer higher-priority instructions improves robustness against prompt injection and jailbreaks. Repo guidance should make priority and trust levels explicit instead of relying on implicit wording.
- [Control Illusion](https://arxiv.org/abs/2502.15851): Experiments show models do not consistently enforce instruction hierarchy even in simple conflicts. This supports deterministic conflict checks and lower tolerance for contradictory instructions.
- [Many-Tier Instruction Hierarchy](https://arxiv.org/abs/2604.09443): Agentic settings can contain many instruction levels, and frontier models perform poorly when conflicts scale. This supports keeping repo layers few, scoped, and explicitly ordered.
- [Reasoning Up the Instruction Ladder](https://arxiv.org/abs/2511.04694): Treating hierarchy resolution as a reasoning task improves instruction-following benchmarks and reduces attack success. Reviewers should ask agents to identify conflicts and justify precedence in reports.
- [ASPI](https://arxiv.org/abs/2605.17324): Clarification-seeking states can increase prompt-injection vulnerability in agents. Instruction files should avoid needless user-question loops and should distinguish required ambiguity from discoverable repo facts.
- [A Survey of Context Engineering](https://arxiv.org/abs/2507.13334): Context engineering treats retrieval, processing, and context management as a managed system. This supports moving long references into playbooks or skill references instead of always-loaded prompts.
- [Automatic Prompt Optimization via Heuristic Search](https://aclanthology.org/2025.findings-acl.1140.pdf): Prompt optimization research emphasizes systematic refinement over intuition-only prompt editing. For this repo, stable reviewer criteria and repeatable checks are preferable to ad hoc prompt growth.
- [NCSC prompt injection guidance](https://www.ncsc.gov.uk/blog-post/prompt-injection-is-not-sql-injection): LLMs do not enforce a native boundary between data and instructions. Instruction governance should reduce impact with deterministic safeguards and least-privilege reviewer scopes.

## Reviewer Output Contract

Instruction reviews should include:

- Scope Confirmation
- Findings ordered by `1-10` severity
- Decision Gates for exactly `5/10` findings
- Knowledge Gaps
- Deterministic Gate Coverage
- Recommendation: `fix now`, `ask user`, or `accept residual risk`

Each finding must cite a file, heading, command, or source snapshot item. Separate local facts from research-based recommendations.
