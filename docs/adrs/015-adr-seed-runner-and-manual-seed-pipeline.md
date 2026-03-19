# ADR: Consolidated Seed Runner and Dashboard Job Queue

## Status (Table)

| Name | Content |
| --- | --- |
| Author | Sebastian Schütze |
| Version | 2.0 |
| Date | 19.03.2026 |
| Status | accepted |

## Version History

| Version | Date | Comment |
| --- | --- | --- |
| 1.1 | 11.03.2026 | Seeding ran through `pnpm seed:run` and a manual GitHub workflow to avoid request-bound timeouts. |
| 2.0 | 19.03.2026 | Seeding moved into the Developer Dashboard and now runs through queued Payload jobs with `runId` persistence and chunked media uploads. |

## Background

Version 1.1 of this ADR standardized seeding around a CLI runner and a manual GitHub workflow. That solved the request-bound execution problem, but it kept seeding outside the Developer Dashboard and required a separate operational path. Version 2.0 moves that path into the app so the dashboard can start, monitor, and resume runs without relying on the old pipeline.

## Problem Description

We need a dashboard-driven way to execute baseline and demo seeds that:

- starts from the Developer Dashboard,
- keeps long-running media uploads off the request path,
- preserves production safety rules,
- exposes job progress and failures inline,
- and survives reloads through a stable run identifier.

## Considerations

1. Keep the CLI + manual workflow model from version 1.1
   - Pros: simple operational story, clear separation from the app
   - Cons: seed execution stays outside the dashboard and still needs extra operational steps

2. Keep a request-bound seed endpoint but call it from the dashboard
   - Pros: minimal UI change
   - Cons: still hits request timeouts for media-heavy runs

3. Move seeding into Payload jobs and trigger it from the dashboard (chosen)
   - Pros: async execution, progress visibility, chunked media handling, one operational path
   - Cons: adds job queue orchestration and run-state storage

## Decision with Rationale

We consolidate seeding around the Developer Dashboard and Payload jobs queue.
The dashboard starts a run, stores a `runId`, and polls the server for job state until the run reaches a terminal status.
The underlying seed work is split into jobs and media chunks so that uploads stay within safe execution windows.
Policy still applies:

- Baseline is allowed in all runtimes.
- Demo is blocked in production.
- Reset is blocked in production.

## Technical Debt

This solution introduces job-run state tracking and queue orchestration that are more complex than the previous CLI-only model.
The server now owns run reconstruction through KV-backed state and `payload-jobs` records.

## Risks (Optional)

- Job queue misconfiguration can leave a run active without progress.
  - Mitigation: the dashboard polls `runId`, the server clears terminal runs, and the cron runner only advances queued jobs.
- Chunk sizing may need tuning if new media assets change upload duration.
  - Mitigation: chunk limits are centralized and can be adjusted without changing dashboard behavior.
- Persistent run metadata could outlive a failed run if the queue is interrupted.
  - Mitigation: terminal states clear the active pointer and the dashboard can reload by `runId`.

## Exit Criteria for Replacement

This ADR should be revisited when at least one of the following becomes true:

- seeding no longer needs to be triggered from the Developer Dashboard,
- Payload jobs are replaced by a different background execution model,
- seed data is no longer stored as repository-backed assets,
- or demo/baseline provisioning moves to a different platform-level import system.

## Deprecated (Optional)

The manual GitHub seed workflow from version 1.1 is deprecated and removed.

## Superseded by (Optional)

Not superseded.
