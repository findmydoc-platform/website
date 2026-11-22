# ADR: Review changes to agent instructions

## Status

| Name   | Content    |
| ------ | ---------- |
| Date   | 22.11.2026 |
| Status | accepted   |

## Background

[ADR 014](./014-adr-ai-anti-slop-quality-gates.md) introduced a blocking check for instruction length, wording, and a small set of possible conflicts. Local checks showed that it can flag compatible rules scoped to different paths and miss conflicting rules in nested files when scanning only changed files. In the nightly workflow, a failed instruction check could also prevent later scans from running.

## Considerations

Keeping the check as an advisory report would avoid blocking pushes and nightly scans. It would still need maintenance, and its pattern matches would still require someone to interpret the affected instructions. A targeted review can trace the instructions that govern a specific action, including exceptions and precedence.

## Decision with rationale

Remove the instruction heuristic from local hooks and CI. Use the Agent Instruction Reviewer for changes to approval rules, instruction precedence, or skill scope, following the repository's reviewer approval process. The [root instructions](../../AGENTS.md) define when to recommend the reviewer, and the [review playbook](../engineering/agent-instruction-review-playbook.md) describes how to conduct the review.

Keep repository-specific instructions at the scope where they apply. Command approval rules continue to live in [`.codex/rules`](../../.codex/rules) and cover the documented direct and wrapped invocation forms. Existing formatting, lint, Semgrep, dead-code, and dependency checks retain their own workflow steps.

## Consequences

Instruction length and wording no longer produce automated findings. Reviewers assess the effect of changes in the three stated areas. A heuristic finding can no longer stop a push or prevent the nightly workflow from reaching its Semgrep step.

## Supersedes

[ADR 014](./014-adr-ai-anti-slop-quality-gates.md).
