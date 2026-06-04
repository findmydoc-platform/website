---
name: findmydoc-collection-planner
description: Plan and safely implement Payload CMS collections for the findmydoc website. Use when Codex is asked to create, change, evaluate, or implement a new Payload collection, join collection, media collection, collection access model, permission-matrix row, collection tests, Payload migration, or CMS/admin data model in this repository. Default to discovery, questions, recommendation, and a proposed plan before editing unless the user explicitly provides an approved plan and asks for implementation.
---

# findmydoc Collection Planner

## Overview

Use this skill to prevent accidental or overbuilt Payload collections in findmydoc. The default behavior is planning-first: inspect the repo, ask only decision-changing questions, recommend the smallest coherent model, and propose a plan before implementation.

This skill does not require or activate the technical Plan Mode. It works as a native workflow in normal Codex sessions.

## Planning Gate

- Do not edit files when the user asks for a new or unclear collection design and no approved plan exists.
- Treat technical Plan Mode as optional. If it is not active, keep using this planning-first workflow in the current session.
- First run repo discovery, then summarize facts, ask targeted questions, recommend an approach, and produce one `<proposed_plan>`.
- After the proposed plan, ask in normal prose whether the user wants it implemented.
- If the user explicitly provides an approved plan or says to implement a previously proposed plan, proceed to implementation using the checklist in `references/collection-planning-playbook.md`.
- If the requested change is obviously tiny and fully specified, still run discovery and state why no questions are needed before proposing or implementing.

## Workflow

1. Read applicable instructions:
   - `AGENTS.md`
   - `src/AGENTS.md`
   - `src/collections/AGENTS.md`
   - `tests/AGENTS.md` when tests are in scope
2. Read `references/collection-planning-playbook.md`.
3. Read `references/payload-field-modeling.md` before deciding fields, joins, access, hooks, validation, or indexes.
4. Run a cross-reference scan before asking questions:
   - similar collections, slugs, relationships, joins, and `defaultPopulate`
   - existing access helpers and field access helpers
   - existing hooks and lifecycle utilities
   - permission matrix entries and unit access matrix tests
   - integration contract registry, lifecycle tests, and seeds
5. Summarize discovery in concrete facts:
   - existing patterns that fit
   - likely affected domains
   - whether the feature looks like a new collection, field, join collection, global, media collection, or extension of an existing collection
6. Ask questions only when answers would change schema, access, lifecycle, migration, tests, or docs:
   - ask at most 3 questions per round
   - include a recommended default for each question
   - do not ask questions answerable from repo inspection
7. Recommend the smallest coherent solution:
   - name the preferred model
   - briefly name rejected alternatives
   - call out hooks or helpers that would reduce custom logic
   - mark unresolved assumptions explicitly
8. Produce a `<proposed_plan>` with implementation changes, validation, and assumptions.
9. After the plan, ask whether to implement it.

## Anti-Overengineering Check

Before recommending a new collection, explicitly test these alternatives:

- Add a field to an existing collection.
- Use a relationship field instead of a join collection.
- Use a join collection only when the relationship needs attributes, ownership, deduplication, or lifecycle hooks.
- Use a Payload global for singleton platform settings.
- Use field validation instead of a hook when no side effects or cross-document checks are needed.
- Reuse an existing access helper or hook before adding a new one.
- Avoid storing computed values unless query performance, sorting, or admin visibility requires persistence.

## Output Contract

When planning, respond in German for the user-facing explanation and keep code/file names in English. Use this sequence:

1. `Discovery`: short facts with file references.
2. `Questions`: only if required, max 3.
3. `Recommendation`: preferred model plus small alternatives.
4. `<proposed_plan>`: complete enough to implement without new decisions.
5. Follow-up question: ask whether the user wants implementation.

When implementing an approved plan, skip the question phase unless the approved plan is incomplete or contradicted by repo discovery.

## Resources

- `references/collection-planning-playbook.md`: discovery commands, decision rules, question bank, implementation checklist, and validation guidance for findmydoc Payload collection work.
- `references/payload-field-modeling.md`: concise Payload CMS collection and field modeling reference with field choices, access, hooks, validation, joins, indexes, and findmydoc-specific defaults.
