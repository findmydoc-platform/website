# ADR: Prefer Parent-Controlled (Controlled) Components for Interactive UI

## Status (Table)

Name        | Content
------------|----------------
Author      | Sebastian Schütze
Version     | 1.0
Date        | 05.01.2026
Status      | approved

## Background

In React applications, interactive UI controls (checkboxes, selects, toggles, etc.) are typically implemented as either:

- **Controlled components (parent-controlled)**: the source-of-truth value lives in the parent and is passed down via props (e.g. `value` + `onValueChange`).
- **Uncontrolled components**: the component owns its value internally (optionally initialized via `defaultValue`) and is not kept in sync with parent state.

The findmydoc frontend is an application codebase (not a reusable component library). Our UI architecture favors “Smart Shells & Dumb UI” where shells own state and pass data/actions down via props. We also prioritize testability and Storybook coverage.

## Problem Description

We need a consistent, enforceable pattern for interactive UI components so that:

- state is predictable and debuggable
- multiple controls can be synchronized (e.g. “Reset filters”, dependent filters)
- values can be persisted and derived (e.g. URL query params)
- components are easy to test in isolation via props and Storybook

Without a standard, we end up with hidden internal state and inconsistent behavior across call sites.

## Considerations

We evaluated three approaches for interactive UI components.

### Option A: Parent-controlled (controlled) components

**Description**: Parent owns the value; the component renders from props and emits changes via callbacks.

**Pros**
- Single source of truth; no synchronization issues
- Enables cross-control coordination (reset all, dependent controls, validation)
- Natural fit for URL/query persistence and server-driven defaults
- Easier to test: vary props and assert output; Storybook args map cleanly
- Aligns with Smart Shells pattern (logic/state in shells)

**Cons**
- Slight boilerplate in parents (`useState` + handlers)
- Requires passing state through component boundaries (prop plumbing)

### Option B: Uncontrolled components

**Description**: Component owns its internal value (optionally `defaultValue`), no required `value` prop.

**Pros**
- Minimal parent boilerplate for simple use cases
- Familiar HTML-like ergonomics

**Cons**
- Hidden state makes behavior less predictable and harder to debug
- Resets, persistence, and synchronization require imperative APIs/refs
- Storybook/testing is more awkward because the “truth” is inside the component
- Increases complexity when application requirements grow (filters, validation, cross-control sync)

### Option C: Support both controlled and uncontrolled modes

**Description**: Component conditionally switches behavior depending on whether `value` is provided.

**Pros**
- Migration path when converting older uncontrolled components
- Allows “easy mode” usage at the expense of strictness

**Cons**
- More code paths and higher long-term maintenance cost
- Creates ambiguity at call sites (“which mode should I use?”)
- Easy to accidentally mix modes and introduce bugs

## Decision with Rationale

We will implement interactive UI components as **parent-controlled (controlled) by default**.

- The primary control value must be passed in via props (e.g. `value`/`checked`) and updated via callbacks (e.g. `onValueChange`/`onCheckedChange`).
- Components must not keep internal React state for the primary control value.
- Internal state is acceptable only for **ephemeral UI** (e.g. popover open/closed) or **compound-component coordination**, not for the source-of-truth value.

This decision optimizes for application needs: explicit data flow, predictable behavior, and easier testing/Storybook integration. Because we are not building a public UI library, we do not need uncontrolled fallbacks for unknown consumers.

## Technical Debt

- Existing components that currently manage their own primary value must be migrated to controlled APIs over time.
- During migrations, avoid introducing “dual mode” APIs unless there is a short, explicit deprecation plan.

## Risks (Optional)

- **Increased boilerplate in shells**: mitigated by small local hooks (e.g. `useFiltersState`) and consistent prop naming.
- **More re-renders from prop updates**: mitigated by keeping state local to the shell, using memoization where needed, and avoiding unnecessary derived state.
