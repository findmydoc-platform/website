# ADR: PostHog Event Taxonomy and Usage Governance

## Status (Table)

| Name    | Content            |
| ------- | ------------------ |
| Author  | Sebastian Schuetze |
| Version | 1.0                |
| Date    | 19.05.2026         |
| Status  | accepted           |

## Background

ADR 001 selects PostHog as the product analytics, event tracking, session recording, feature flagging, and experimentation tool for findmydoc. ADR 010 also places PostHog next to the structured logging approach for client-side error tracking and server-side exception capture.

PostHog can collect many signals automatically, but long-term product analytics require governed event names, predictable property names, and privacy boundaries that remain stable across features, teams, and reporting needs.

This ADR defines the event-taxonomy governance for findmydoc. It does not define individual events, event payloads, dashboards, funnels, Actions, code modules, storage models, or delivery mechanics.

## Problem Description

Analytics events become hard to trust when teams use inconsistent names, dynamic event strings, loosely defined properties, or event labels that describe implementation details instead of durable product facts. In a healthcare-adjacent product, poorly governed analytics also increases the risk that sensitive contact data, medical details, or free-text inquiry content enters analytics systems unnecessarily.

findmydoc needs one durable event taxonomy that works beyond a single feature phase. The taxonomy must support product analysis, privacy review, and future automation without coupling event names to UI structure, backend internals, campaign wording, or short-lived project labels.

## Considerations

### Existing Decisions

- [ADR 001](./001-adr-technology-stack-web-react-payloadcms.md) chooses PostHog as part of the platform stack.
- [ADR 010](./010-structured-logging-approach.md) defines PostHog's logging and error-tracking adjacency.

### PostHog Guidance

PostHog recommends explicit custom events for important product and business events because autocapture is not reliable enough for key conversions. PostHog also recommends naming conventions, static event and property names, and thoughtful privacy controls for collected data.

Relevant references:

- [PostHog: Send events](https://posthog.com/docs/getting-started/send-events)
- [PostHog: Product analytics best practices](https://posthog.com/docs/product-analytics/best-practices)
- [PostHog: Actions](https://posthog.com/docs/data/actions)
- [PostHog: Controlling data collection](https://posthog.com/docs/privacy/data-collection)

### Taxonomy Options

1. **Tool-oriented category syntax**
   - Pros: can mirror analytics-tool grouping conventions and make large catalogs easier to scan inside the tool.
   - Cons: can make product language secondary to tool structure and may require translation between product planning, code, and reporting.

2. **Product-fact snake case**
   - Pros: keeps event names stable, readable, implementation-neutral, and easy to use across planning, code, documentation, and reporting.
   - Cons: requires governance discipline so the catalog does not grow into loosely related names over time.

## Decision with Rationale

PostHog remains the analytics and event-analysis system for product telemetry. Custom findmydoc business events use static lowercase `snake_case` names that describe durable product facts or user/business actions, not implementation mechanics.

The event taxonomy is product-owned and centrally governed before events are captured or used for reporting. Event names must be stable contracts that can survive UI redesigns, backend refactors, campaign changes, and reporting changes.

findmydoc chooses product-fact `snake_case` over tool-oriented category syntax because the taxonomy must be understandable outside PostHog and should not encode the structure of one analytics tool. PostHog Actions can still group events for tool-specific analysis without changing the canonical event names.

### Event Naming Rules

- Custom business event names are static lowercase `snake_case`.
- Event names describe product facts, completed actions, or meaningful user intent.
- Event names do not describe component names, route structure, storage tables, SDK calls, experiments, project phases, or temporary campaign labels.
- Event names and property names are fixed strings, never generated dynamically.
- Event property names are static lowercase `snake_case`.
- Boolean properties use `is_` or `has_` prefixes when practical.
- Timestamp properties end in `_timestamp`; date-only properties end in `_date`.
- Breaking event-shape changes require a deliberate versioning decision instead of silent mutation.

### Event Governance Rules

- A new event must have an owner, trigger definition, required properties, optional properties, privacy note, and target analysis purpose before it is captured.
- Event properties must be the minimum needed for analysis.
- Event properties use controlled enums or stable identifiers where practical.
- Autocapture may support exploration, but it is not the canonical source for business-critical conversion reporting.
- Reporting labels may be friendlier than event names, but they must map back to the governed event taxonomy.

### Privacy Rules

PostHog event properties must not include:

- patient or contact names
- email addresses
- phone numbers
- raw inquiry messages or free text
- appointment notes or medical details
- exact street addresses or other unnecessary location detail
- secrets, tokens, cookies, or raw request headers

Allowed event properties should describe product context, routing context, object identifiers, boolean state, and controlled enums needed for analysis.

### PostHog Actions

PostHog Actions may group governed events for analysis, reporting, funnels, or dashboards. Actions are analysis aliases over captured events, not the canonical taxonomy. Code, documentation, and planning must not treat Action names as replacements for governed event names.

## Technical Debt

- Existing analytics usage may need alignment with this taxonomy.
- Future event work needs an explicit event definition workflow so new events remain governed before capture.
- Static checks may later enforce the boundary between governed event names and ad hoc analytics strings.

## Risks (Optional)

- **Analytics drift:** dashboard labels, Actions, and local reporting language can diverge from governed event names. Reviews should verify that reporting artifacts map back to the taxonomy.
- **Data overcollection:** event properties can become too detailed over time. Keep properties minimal and review healthcare-adjacent payloads for privacy before capture.
- **Tool coupling:** analytics-tool features can encourage naming optimized for the tool instead of the product. Keep canonical names product-facing and use tool-specific aliases only in the tool layer.

## Deprecated (Optional)

None.

## Superseded by (Optional)

None.
