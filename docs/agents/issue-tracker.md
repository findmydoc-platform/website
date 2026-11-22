# Issue tracker: GitHub

Issues and specs for this repository live in GitHub Issues. Use the `gh` CLI for issue operations.

## Choose the issue body

- Put the Engineering Spec in one lead issue for a material data-model or access-model change, an externally consumed
  contract change, a cross-repository change, a consequential runtime or migration decision, or work spanning multiple
  implementation sessions. Discuss the draft in that issue and agree on the Spec before creating implementation
  tickets. [Shared Engineering Spec template](https://github.com/findmydoc-platform/platform-architecture/blob/main/templates/engineering-spec.md)
- Use the local [feature form](../../.github/ISSUE_TEMPLATE/feature.yml) or
  [bug form](../../.github/ISSUE_TEMPLATE/bug_report.yml) for implementation issues, including routine work. Use the
  matching form when rewriting a feature or bug issue. Describe the existing problem, need, or opportunity. Keep
  task-specific implementation details in the lead Spec, issue comments, or pull request as appropriate. Link
  repository documentation for supported behavior and durable decisions.

## Conventions

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
