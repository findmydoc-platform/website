# ADR: AI Anti-Slop Quality Gates and Lane Strategy

## Status (Table)

| Name    | Content |
| ---     | --- |
| Author  | Sebastian Schütze |
| Version | 1.0 |
| Date    | 20.02.2026 |
| Status  | draft |

## Background

The repository uses AI-assisted implementation and review workflows across instructions, prompts, CI updates, and code changes.
Without explicit quality enforcement, communication and delivery quality can drift over time:

- low-signal or filler language appears in instruction files
- dead code and dependency drift remain undetected until late
- CI becomes either too weak (missed issues) or too expensive (slow feedback)

The team adopted anti-slop guardrails and now needs a documented architectural decision that defines how these checks are enforced in CI and documentation.

## Problem Description

We need a quality-gate strategy that:

- blocks low-quality AI-guidance drift early
- keeps dependency and dead-code hygiene enforceable
- preserves practical PR velocity
- defines how to handle false positives and known findings transparently

The decision must be durable and visible so future CI or tooling changes do not weaken these controls by accident.

## Considerations

### Option A: Soft guidance only (documentation, no hard CI gates)

**Pros**
- fastest CI and lowest contributor friction
- minimal maintenance burden

**Cons**
- quality regressions are discovered late
- review load increases due to avoidable baseline issues
- no reliable anti-slop enforcement

### Option B: Full strict gate set on every PR

**Pros**
- strongest immediate enforcement
- predictable policy compliance

**Cons**
- higher CI cost and slower PR feedback
- reduced throughput on changes that do not touch relevant quality surfaces

### Option C: Fast/Deep lane strategy with changed-file gating

**Pros**
- keeps core quality gates enforceable in PRs
- runs expensive checks selectively in PRs and fully in deep lane runs
- balances enforcement with feedback speed

**Cons**
- requires clear documentation of what is gated in each lane
- requires ownership for exception handling and findings tracking

## Decision with Rationale

We adopt **Option C**: a **Fast/Deep lane strategy** with **block-first quality gates** and **changed-file gating in PR CI**.

Decision details:

1. Keep anti-slop policy checks mandatory in PR CI.
2. Keep dead-code and dependency hygiene checks enforceable, with selective execution in PRs based on changed files.
3. Preserve full-scope validation in deep lane runs (for example nightly or mainline runs).
4. Document false-positive handling and known findings tracking in engineering documentation.

Rationale:

- This design enforces the anti-slop objective without applying all expensive checks on every change.
- It improves signal quality in reviews while retaining practical delivery speed.
- It creates explicit operating rules that future contributors can follow and audit.

## Technical Debt

- Rule-based policy checks can produce edge-case false positives and require periodic tuning.
- Changed-file gating must stay aligned with CI path filters and repository structure.
- Quality finding records require active ownership to avoid stale exceptions.

## Risks (Optional)

- **Risk**: Teams overuse temporary exceptions and weaken enforcement.  
  **Mitigation**: require owner + due date + explicit rationale for each exception.

- **Risk**: Gating paths become outdated after repo reorganizations.  
  **Mitigation**: review CI path filters whenever workflow or folder structures change.

- **Risk**: Contributors misunderstand lane behavior and local validation expectations.  
  **Mitigation**: keep README and playbook sections concise and explicit.
