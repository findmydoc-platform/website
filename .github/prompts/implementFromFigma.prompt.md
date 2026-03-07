---
name: implementFromFigma
description: Implement or refine UI components from Figma designs using repository conventions
argument-hint: Provide the Figma URL/node, target file path, and acceptance constraints
agent: agent
---

Implement or refine a UI component from Figma using this repository's conventions.

## Priorities

1. Match intended layout and behavior without breaking architecture boundaries.
2. Keep components accessible, responsive, and deterministic.
3. Minimize API surface changes unless explicitly required.

## Workflow

1. Gather context from:
   - Figma node metadata and screenshot (when available).
   - Repository instructions (`.github/copilot-instructions.md` and scoped files).
2. Summarize 3-5 implementation guidelines before editing.
3. Update existing components when possible; create new files only when justified.
4. Keep presentation logic in UI layers and domain/business logic outside UI components.
5. Add or update Storybook coverage when component behavior or variants change.

## Output Format

- List changed files with a brief summary per file.
- List applied guidelines.
- List open questions or follow-up items.
