---
name: PR Review Analysis
summary: Analyze PR review comments, classify their correctness, and produce an ordered implementation plan.
inputs:
  - name: pr
    description: PR URL or PR number.
    required: true
  - name: focus_areas
    description: Optional focus areas (e.g., security, performance, UX, tests).
    required: false
outputs:
  - name: analysis
    description: Numbered list of per-comment analysis with a final plan section.
---

# PR Review Analysis

## Input
- PR URL or PR number.
- Optional focus areas to prioritize the analysis.

## Steps
1. Fetch PR review comments using the GitHub API or GitHub CLI.
2. For each review comment:
   - Classify the comment as **correct**, **uncertain**, or **incorrect**.
   - Explain the rationale with precise file and line references.
   - Assess usefulness and impact on correctness, maintainability, performance, security, or tests.
3. Consolidate all actionable, correct feedback into an ordered implementation plan.
4. Ask for confirmation before making any code changes.
5. Ensure any future changes follow repository conventions (tests live in `tests/`, use Payload hooks/access patterns, avoid `any`).

## Output Format
1. **Comment N**
   - Location: `path/to/file` lines X-Y
   - Classification: correct | uncertain | incorrect
   - Rationale: ...
   - Usefulness/Impact: ...
2. **Comment N+1**
   - Location: ...
   - Classification: ...
   - Rationale: ...
   - Usefulness/Impact: ...

**Final Plan (ordered)**
1. ...
2. ...

**Confirmation**
- Ask for confirmation before implementing any changes.
