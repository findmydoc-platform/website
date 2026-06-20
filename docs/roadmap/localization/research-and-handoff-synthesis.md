# Localization Research and Handoff Synthesis

## Purpose

This document preserves the local planning context from the evaluation of a Git-backed translation management system and the follow-up handoff discussion. It is a planning source for refreshed GitHub issues and a likely ADR follow-up. It is not an implementation specification.

## Source Material

- Evaluation: [Evaluation of a Git-backed Translation Management System with a Migration Path](./research.md)
- Handoff: `FindMyDoc Lokalisierungsstrategie aus Nachbesprechung`
- Existing architecture reference: [ADR 018 - Native Payload CMS Localization Strategy](../../adrs/018-adr-native-payload-localization-strategy.md)

## Core Decision

findmydoc should separate localization by content ownership and lifecycle, not by text length or by where the text appears visually.

The current ownership model is:

- Product UI copy belongs in JSON/i18n.
- Editorial, SEO-relevant, and domain-specific content belongs in Payload CMS.
- SEO, routing, and indexing rules are a governance layer above content storage.
- Payload Admin remains English for phase 1. Admin-label localization is an admin-operator ergonomics concern and should not be mixed with public product copy or the DACH-facing public localization rollout.

The current phase-1 market assumption is that findmydoc starts with the DACH region. German is therefore the public default and source language. English is the first public alternative for international users, partners, and later expansion. Turkish is not part of phase 1.

## Payload CMS Content

Payload CMS is the source of truth for structured, editorial, SEO-sensitive, and domain-specific content. The Pages and Posts localization pilot proves that native Payload localization can work for editorial content, but it does not answer the full rollout question for all content models.

Payload-owned examples include:

- Home page editorial sections
- Landing page content
- Clinic profiles
- Treatment category content
- Blog and guide content
- FAQ entries
- Trust explanations
- SEO intro text
- Meta title and meta description
- Slugs, when localized slug behavior is explicitly selected
- H1, H2, and H3 copy for SEO pages
- Clinic descriptions
- Media alt text
- For Clinics and Claim Profile content
- Founder or company narrative content

The practical rule is that content with search intent, conversion weight, trust claims, medical context, or editorial ownership should stay in Payload.

## Product UI Copy

Product UI copy belongs in JSON/i18n when it exists because a UI component needs it. This includes reusable product labels and operational microcopy that should be consumed by web and potentially mobile clients.

JSON/i18n-owned examples include:

- Buttons
- Global CTA labels when reused across product surfaces
- Navigation labels
- Form labels
- Placeholders
- Validation messages
- Error messages
- Empty states
- Toasts
- Filter labels
- Sorting options
- Table headers
- Tabs
- Technical status labels
- Generic product microcopy
- Pluralized and interpolated strings

The evaluation recommends treating the Git repository as a canonical translation source format, not merely as app runtime JSON. A later move to Lokalise, Crowdin, or Phrase should be a workflow migration rather than a data model rewrite.

## Internal Translation System Direction

The internal translation system should be TMS-shaped from the start:

- Use flat, stable keys.
- Use canonical BCP 47 locale identifiers.
- Keep message values separate from metadata.
- Store translator context such as descriptions, placeholders, examples, screenshots, tags, platforms, namespaces, review state, and source hashes.
- Generate consumer-specific runtime files from canonical source data.
- Validate placeholders, plural rules, locale identifiers, and stale translations in CI.
- Use deterministic serialization with stable ordering and formatting.
- Prefer atomic Git commits and optimistic concurrency for PR automation.

The source format should remain vendor-neutral. It should not become an i18next-only or next-intl-only repository format.

## Payload Admin Labels

Payload admin labels are a separate concern from both product UI copy and localized content. They include collection names, field labels, field descriptions, tabs, helper text, and other editor-facing admin metadata.

Payload Admin stays English for now. German admin-label localization should only be reopened when real editor or operator workflow pressure appears. It should not become a complete public UX copy translation initiative or a broad industry-grade product localization effort.

## Static Product Pages With Marketing Copy

A statically implemented route can still have Payload-owned content. The route, layout, and components may live in code while SEO and marketing copy come from Payload.

For a Clinic Comparison page:

- Route and component layout belong in code.
- Buttons, filters, table labels, empty states, and validation copy belong in JSON/i18n.
- Eyebrow, H1, subheadline, SEO intro, meta title, meta description, FAQ, and trust explanations belong in Payload.

The presence of a header is not enough to decide ownership. The important distinction is whether the text is product-screen microcopy or editorial, marketing, SEO, trust, or domain content.

## Scale and TMS Migration Position

The research supports an internal Git-backed translation management system as a phase-one operating model if it is designed for later migration.

The internal system is most credible while findmydoc has:

- A small number of active locales.
- Internal translators or editors.
- Mostly web delivery.
- Weekly or less frequent localization release waves.
- Limited external agency involvement.

Migration to a managed TMS becomes more attractive when multiple signals appear together:

- More than eight to ten production languages.
- External translators or agencies.
- More than five concurrent reviewers or linguists.
- Screenshot-heavy in-context review needs.
- Persistent terminology drift.
- More than one engineering day per sprint spent on localization tooling and reconciliation.

## Open Strategic Questions

The current ADR-level question backlog is tracked in [Localization ADR decision questions](./localization-adr-questions.md). Item-specific questions are tracked in the three planning item documents.

## Planning Item Structure

The current planning shape keeps three documents under a broader localization epic, but only two are phase-1 public localization implementation candidates:

- Product UI copy localization
- Payload content localization
- Payload admin labels localization, currently deferred because Payload Admin remains English for phase 1

SEO, routing, and indexing governance remains a cross-cutting topic. It may become its own issue if it starts to blur the Payload content item.
