# Full Session Handoff: findmydoc Trust Claim Guardrails

## Purpose

This handoff captures the abstract context of the full session, not only the latest branch state. It is for a fresh agent continuing the compliance/trust-claim cleanup around management issue `findmydoc-platform/management#237`, related Notion guardrails, and the website PR chain.

The user works in German. Code, code comments, PR docs, and repository documentation stay in English unless an existing template or source requires otherwise. Always write the brand as `findmydoc`.

## Core Problem

The user wanted a repository-wide review of public trust claims and seeded/demo content against a Notion page linked from `findmydoc-platform/management#248`. The management issue `#237` concerns unvalidated trust elements such as public reviews, verified badges, star ratings, before/after galleries, certification claims, satisfaction claims, and guarantee wording.

The important interpretation from the user:

- "verified" means verified by findmydoc through an explicit process, not just clinic-provided data or seed data.
- Several elements should be technically disabled before MVP unless verified and checked.
- The docs do not yet clearly define this verification/checking process.
- The user wants case-by-case decisions, not one broad automatic rewrite.

## Guardrail Model

The working model used throughout the session:

- Red: not publishable as-is, or technically disabled before MVP unless verified and checked.
- Yellow: may be publishable only with evidence, source, owner, proof type, proof date, and accountable check.
- Green: generally safe when phrased as comparison, organization, structured profile data, clinic-provided information, or direct contact, without medical advice or quality certification.

Cross-cutting process gap:

- The repo has review moderation references, but no single complete findmydoc verification/checking process for public reviews, verified badges, star ratings, before/after galleries, accreditations, or quality claims.
- This remains a decision gate for R2/R3/R4/R5/Y2/Y3/Y5/Y6.

## Main Artifact

The findings document now lives in the repository root:

- `trust-claim-guardrails-findings.md`

It was originally created under `tmp/` as a non-committed working note. Later the user asked to move it into the repo root and remove the `tmp/` copy. That root file has been committed and pushed on the active branch.

Do not duplicate its tables in future handoffs. Treat it as the current source of issue-level status.

## Work Completed

### R6: Demo blog disclaimer and `[Demo]` titles

Implemented as a PR before the later trust/stat work.

User clarified the disclaimer must live in the seed content itself, because demo posts are seed/demo content. It should not be a hardcoded UI block copy. The implementation added demo disclaimers at the beginning of demo seed post body content and prefixed demo seed titles/meta titles with `[Demo]`.

Tracking:

- Website PR: `findmydoc-platform/website#1303`
- Status in findings doc: solved

### R7: Storybook and fixture trust claims

The user rejected removing visual sample data from Storybook. The approved direction was:

- Keep visual examples for ratings, filters, review states, verification badges, and before/after visual states where needed for UI QA.
- Neutralize risky text/copy in Storybook and fixtures.
- Do not change runtime functionality in this item.
- Make stories support visual testing of appearance, not imply claims are approved for production.

Tracking:

- Website PR: `findmydoc-platform/website#1305`
- Status in findings doc: solved

Later, Storybook interaction tests failed and were fixed on the active branch:

- `BlogCard` fallback image play test now triggers image error before asserting fallback avatar.
- `DisclaimerOptions` play test scopes to the existing preview card rather than a missing region.
- `ListingComparison` story checks the status role instead of a broad `showing` text match.
- `TrustQualitySection` story narrows the `Treatment types` query to the metric label.

Validation result at that point:

- `pnpm vitest --project storybook --run`
- 105 story files passed
- 892 tests passed

### Y1 Step 1: Landing fallback removal

The user decided to remove static landing fallback content so landing copy has one auditable source: the `landingPages` seed/global JSON.

Implemented direction:

- Remove `DEFAULT_LANDING_PAGE_GLOBAL`.
- Make missing or incomplete `landingPages` payload/global fail fast.
- Avoid replacing content through embedded TypeScript fallback strings.
- Derive test fixtures from `src/endpoints/seed/data/baseline/globals.json`.
- Do not change actual landing copy yet.

Tracking:

- Website PR: `findmydoc-platform/website#1307`
- Status in findings doc: step 1 solved, copy decisions still needed

Follow-up context:

- The user expected all landing page content to be in seeds.
- The findings file contains a Y1 seed approval table for line-by-line decisions: `Approved` or `Needs review`.
- Remaining Y1 work is sentence-level content review/rewrite, not fallback mechanics.

### R1: Listing comparison trust block

The user focused on the green block near the bottom of `/listing-comparison`. The risky original concepts were satisfaction rate, guarantees, certification/TÜV, and similar trust claims.

Approved content direction:

- Keep `verified clinics` because it maps to an internal clinic profile state already used.
- Keep treatment types.
- Replace satisfaction with locations/cities.
- Replace TÜV/certification with a measurable third statistic: price entries / price fields where available.
- Use this title: `A clearer way to compare clinics`
- Use this subtitle: `We make clinic profiles easier to compare by showing key treatment, location, and price fields in one place.`
- If too few stats exist, hide the whole stats/trust block rather than display misleading zeroes.
- Use the `Hospital` icon for verified clinics.
- Phrase price transparency carefully as available fields, not a guarantee.

Tracking:

- Website PR: `findmydoc-platform/website#1309`
- Status in findings doc: solved

### Y7: Required disclaimers

First implemented as Storybook-only exploration. The user then approved runtime implementation.

Design direction:

- Legal/compliance disclaimer should be findable but low-noise.
- It must not look like a warning/alert blocker.
- English only.
- The copy must be content-appropriate, not generic story/exploration guidance.

Runtime placements implemented:

- Platform disclaimer in the global footer after copyright/all rights reserved as plain text.
- Blog disclaimer on post pages, with only the note box and no story/exploration instructional text.
- Clinic profile disclaimer near the clinic detail top content.
- Listing comparison disclaimer in the second/right column, visually near the comparison content rather than inside the green stats block.

Shared implementation pieces:

- `src/components/molecules/DisclaimerNotice/index.tsx`
- `src/utilities/legal/disclaimers.ts`

Tracking:

- Website PR: `findmydoc-platform/website#1333`
- Status in findings doc: solved
- Screenshots were captured and attached to the PR body for each disclaimer context: blog, comparison, clinic, footer.

User feedback already addressed:

- Removed Storybook-like instructional text from runtime disclaimers.
- Made disclaimer copy English.
- Moved platform disclaimer to footer plain text.
- Moved listing disclaimer out of the green stats block and into the right column.
- Kept tone consistent but content-specific.

## PR And Branch State

Active branch:

- `feature/listing-comparison-safe-trust-stats`

Latest local state before this handoff:

- Branch was rebased onto `origin/main`.
- Rebase completed successfully.
- Branch was pushed with `--force-with-lease`.
- Working tree was clean when checked.

Known PRs in the sequence:

- `#1303` `fix: label demo blog content and add disclaimer`
- `#1305` `fix: neutralize Storybook trust fixtures`
- `#1307` `fix: remove landing content fallback`
- `#1309` `fix: replace listing trust claims with safe stats`
- `#1333` `feat: add routed disclaimers to public pages`

Stacking confusion:

- The user clarified that `#1309` and `#1333` are not duplicates because their contents differ.
- The user wanted `#1333` stacked on `#1309`.
- GitHub PR bases are branches, not PR numbers.
- Earlier, `#1309` and `#1333` involved the same head branch, which prevented simply setting one as the other's base.
- After that, the branch was rebased onto `main`. If true stacking is still needed, a fresh branch split is required.

Current practical next step for stacking:

- Create a new branch for the later disclaimer work from the earlier R1 branch point, or reconstruct the stack with separate branches per PR.
- Do not assume the current PR relationship is correct without checking GitHub.

## Validation Already Run

Relevant validations from the session:

- `pnpm format` passed during multiple commits.
- `pnpm build` passed earlier in the disclaimer PR work.
- Targeted unit/component tests for disclaimers and templates were run earlier in the PR flow.
- `pnpm vitest --project storybook --run` passed after Storybook test fixes.
- Pre-push AI slop check passed for the root findings document.

If continuing implementation work, re-run the path-relevant checks because the branch was rebased after several pushes.

## Open Items

Still open in the findings doc:

- P1: define the verification/checking process.
- R2: before/after galleries.
- R3: public reviews and star ratings.
- R4: verification badges.
- R5: rating-based ranking and filters.
- Y1: landing/partner copy decisions after fallback removal.
- Y2/Y3/Y5/Y6: verification, accreditations, pricing/reviewed prices, verified visibility.

Do not solve these broadly without user approval. The user's preferred mode is one item at a time, with concrete options and decisions per problem.

## Communication Preferences

- User wants German chat responses.
- User prefers concise technical founder-style summaries.
- For implementation planning, give concrete plan and then execute when approved.
- For compliance decisions, separate facts/evidence from recommended actions.
- For UI changes, include screenshots when handing off visual work.

## Suggested Skills

- `github:gh-address-comments` for PR review comments on the active PRs.
- `gh-fix-ci` for failing GitHub Actions checks.
- `browser:control-in-app-browser` for local route or Storybook UI verification.
- `gh-ui-screenshots` for attaching UI screenshots to PR descriptions.
- `notion-research-documentation` if the Notion guardrails need to be re-read or reconciled with the findings file.

## Sensitive Data

No credentials, API keys, secrets, private hostnames, or account-local URLs are included in this handoff.
