# Issue Gap Analysis Report (Editable)

This file is intended to be **manually editable**.
It is the working artifact produced by the `issue-gap-analysis` skill and can later be used to update issues.

Rules:
- Every issue section MUST include an issue number in the form `#123`.
- Prefer keeping the section heading unchanged so it remains easy to reference.
- Use checkboxes for gaps/follow-ups so you can track progress locally.

---

## Scope
- Repo: findmydoc-platform/website
- Issues: open | all
- Filters: <labels/milestones/projects/search>
- Stale threshold (days): 30
- Code reference for “implemented”: main | <branch> | <commit sha>
- Generated at: <YYYY-MM-DD>

## Inventory
| # | title | type | state | project(s) | status/column | updated_at | stale? |
|---:|---|---|---|---|---|---|---|
| #123 | <title> | Bug\|Feature\|Task\|Epic | open\|closed | <...> | <...> | <...> | Y\|N |

## Project coverage summary
- In projects: <n>
- Not in projects: <n>
- Notes: <optional>

## Stale issues (review)
- #123 — <title> — <days stale> days — Proposed next action: <comment/close/keep>

---

## Issues

### #123 — <title>
- Type: Bug | Feature | Task | Epic
- Status: implemented | partially implemented | unimplemented | needs verification
- Project context: <project name(s) + status/iteration>

#### Requirements (from issue)
- <requirement / AC-1>
- <requirement / AC-2>

#### Evidence
- PR/commit: <link(s)>
- Code pointers: <paths/symbols>
- Tests/verification: <test names> | manual steps | CI evidence

#### Gaps / follow-ups
- [ ] <gap 1>
- [ ] <gap 2>

#### Proposed GitHub updates
- Comment: yes | no
- Labels/type changes: <...>
- Project status changes: <...>
- Close: no | completed | duplicate | not_planned
- Notes: <short rationale>

---

### #124 — <title>
(duplicate the section above)
