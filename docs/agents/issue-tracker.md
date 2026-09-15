# Issue tracker: GitHub

Issues and specs for this repository live in GitHub Issues. Use the `gh` CLI for issue operations.

## Conventions

- Create and update issues with the repository feature or bug template.
- Use a temporary Markdown body file for multiline issue or pull request bodies.
- Verify rendered issue bodies after publishing.
- Use GitHub native sub-issues for parent and child relationships. Verify each relationship from parent and child.
- The Wayfinder map is a GitHub issue labelled `wayfinder:map`; its decisions and Fog are maintained in the issue body.
- Use GitHub native issue dependencies for blockers.
- Do not use pull requests as a triage request surface.

## When a skill says "publish to the issue tracker"

Create a GitHub issue in this repository.

## When a skill says "fetch the relevant ticket"

Use `gh issue view <number> --comments`.
