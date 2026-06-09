# ADR: Database Migration Quality Gate

## Status (Table)

| Name    | Content            |
| ------- | ------------------ |
| Author  | Sebastian Schuetze |
| Version | 1.0                |
| Date    | 08.06.2026         |
| Status  | accepted           |

## Background

findmydoc is moving closer to production operation while still working within a lean MVP toolset: Payload migrations, Supabase, Vercel, GitHub Actions, and the limits of the free or low-cost tiers currently available to the project.

Database changes are one of the highest operational risks in that phase. A broken migration, forgotten migration file, destructive schema change, or untested backfill can affect production data more severely than most application-code regressions.

This decision raises database migration quality and production readiness with the tools available now, while keeping a clear path toward stronger production-data rehearsal later.

The first step is a CI-backed safety baseline because stronger production-shaped rehearsals require backup, restore, and data-handling controls that are not mature yet in the current free or low-cost toolset.

## Problem Description

Database migration quality had been mixed into the general PR validation workflow. That made the change look like a workflow concern, but the underlying problem is operational: the project needs a safer path for database evolution before production usage increases.

The project needs a stable merge gate that:

- improves production readiness for schema changes within the current tool constraints
- always reports a required check result when configured in branch protection
- runs heavier database checks only for database-relevant changes
- blocks missing or broken migrations before merge
- keeps advisory semantic risk detection separate from hard correctness checks
- avoids production database access from normal CI
- remains small enough to operate before a dedicated backup and production-data rehearsal strategy exists

## Decision with Rationale

Database and migration validation belongs to a dedicated workflow that runs for every pull request.

The workflow has a final mandatory result that must be green before merge. Earlier jobs may run only when database-relevant changes exist, but the final outcome always exists and evaluates whether the skipped or executed jobs satisfy the database quality policy.

General PR validation remains responsible for formatting, linting, tests, build validation, and runtime-oriented checks. It may prepare a disposable local build database when the build requires one, but it does not own missing-migration enforcement, migration status decisions, or migration risk policy.

DB Quality starts with a fresh local Postgres/PostGIS service and validates that migrations apply cleanly and leave Payload in a clean migration status. This is a deliberate baseline: it catches missing files, syntax/runtime failures, and broken migration ordering without coupling merge validation to production data.

This baseline fits the current toolset. GitHub Actions can run disposable database containers, while Vercel remains focused on deployment builds. Supabase Free does not replace an explicit backup, restore, branching, or rehearsal strategy, so normal merge validation must stay independent from production data until those controls are designed.

The migration risk scan remains advisory at first. Blocking semantic rules should be added only when the rule is narrow, evidence-backed, and has a low false-positive rate.

## Consequences

### Positive

- Database changes receive an explicit production-readiness boundary instead of being treated as ordinary application validation.
- Branch protection can require one stable DB quality check that always exists.
- Pull requests without database-relevant changes stay green without running heavy database jobs.
- Missing migrations and broken migration application are blocked before merge.
- Database quality ownership is explicit and easier to evolve independently from general PR validation.
- The deploy workflow stays focused on application validation instead of becoming the migration policy owner.
- The repository now has a practical stepping stone toward later backup-based migration rehearsal.

### Trade-offs

- A fresh local database proves migration executability, not production compatibility.
- Advisory risk scanning can miss semantic risks until blocking rules are intentionally narrowed and promoted.
- Build and integration workflows may still prepare disposable databases for their own runtime needs; that preparation is not the source of truth for migration quality.
- The workflow structure is more visible than the operational reason behind it unless PR and release documentation keep the production-readiness framing explicit.

## Non-goals

- DB Quality does not query production databases.
- DB Quality does not use production data in the normal PR merge gate.
- DB Quality does not replace backup, restore, point-in-time recovery, or release-runbook discipline.
- DB Quality does not prove lock duration, data distribution, backfill correctness, or destructive-change safety on existing production data.

## Future Work

Migration quality should later include a protected production-shape rehearsal path backed by a real backup strategy. That path should restore a recent backup or dump into an isolated database, run pending migrations against the restored data, and verify migration status plus targeted data assertions.

That future rehearsal should be separate from the normal required PR gate at first. It needs stronger operational controls because it may handle production-shaped data: protected workflow triggers, restricted secrets, encrypted backup storage, no plaintext dump artifacts, and no untrusted pull request code.

## Deprecated (Optional)

None.

## Superseded by (Optional)

None.
