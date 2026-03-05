# ADR: AI Anti-Slop Quality Gates and Lane Strategy

## Status (Table)

| Name    | Content |
| ---     | --- |
| Author  | Sebastian Schütze |
| Version | 1.1 |
| Date    | 05.03.2026 |
| Status  | accepted |

## Background

The repository relies on AI-assisted implementation and review.
Earlier instruction files grew in size and overlap, which increased ambiguity and quality variance.
Recent research on instruction following and prompt design shows that too many constraints, long context windows, and conflicting directives can reduce model reliability.

## Problem Description

We need an enforcement model that:

- reduces AI slop without bloating instruction payloads
- keeps guidance conflict-free and scoped
- maintains practical PR velocity
- provides predictable governance for updates to instruction sources

## Decision

We adopt **AI-Slop v2** with a **pre-push + deep-lane enforcement model**.

1. Local pre-push gate is mandatory for instruction-source changes.
2. Main PR CI remains focused on runtime and CI quality gates; AI-slop is not a blocking step there.
3. Deep quality lane (main + nightly) runs full-scope AI-slop checks.
4. Instruction sources must follow priority-first and budget-aware design.
5. Global `applyTo: '**/*'` usage requires explicit `Scope exception:` rationale.

## Rationale

This model preserves strict quality control where it is most effective, without adding avoidable PR-lane latency.
It also aligns with research findings that shorter, clearer, non-conflicting instruction sets outperform overloaded prompt bundles.

## Consequences

### Positive

- Better instruction signal quality.
- Lower conflict risk across instruction files.
- Faster PR feedback compared with full blocking in main CI.

### Trade-offs

- Requires local hook installation discipline.
- Checker budgets need periodic tuning as repository conventions evolve.

## Technical Debt

- Keyword and heuristic checks can still miss nuanced conflicts.
- Scope and budget thresholds require periodic recalibration.

## Governance Notes

- Update `docs/engineering/ai-anti-slop-playbook.md` whenever checker contracts or lane policies change.
- Keep instruction changes reviewable with explicit reasoning when adding global scope.

## Study Basis

- What Prompts Don’t Say (arXiv:2505.13360)
- The Few-shot Dilemma (arXiv:2509.13196)
- Context Length Alone Hurts Reasoning Performance (arXiv:2510.05381)
- Lost in the Middle (arXiv:2307.03172)
- Instruction Hierarchy (arXiv:2404.13208)
- IHEval (arXiv:2502.08745)
- MOSAIC (arXiv:2601.18554)
- RIFT (arXiv:2601.18924)
- Prompt Underspecification Revisited (arXiv:2602.04297)
