---
name: findmydoc-design-handoff
description: Ground an explicitly requested design handoff after a visual direction is selected. Provide visual constraints and verified repository facts as input to the canonical PRD or spec.
---

# findmydoc Design Handoff

1. Resolve the selected visual reference: a committed image, stable Figma URL, or image attached to the authoritative issue. Ask for an accessible reference if it is missing; an option number alone is insufficient.
2. Read the nearest `AGENTS.md`, `GLOSSARY.md`, relevant ADRs, and current routes, components, and data sources. Treat dormant code as historical context.
3. Identify the visual constraints, reuse boundaries, data ownership, permissions, and supported interactions. Verify visible claims and metrics; mark unsupported capabilities as `Data Gap`.
4. Return concise design input in English: visual reference, constraints and exclusions, repository evidence, and unresolved gaps. Preserve the canonical PRD or spec's scope and decisions; link them rather than creating a competing implementation plan.
5. Keep the input in chat unless the user names a persistent destination.

Product Design owns visual exploration, audits, prototypes, and design QA through its own router. This skill does not require that plugin to document an existing selected design. Spec synthesis and ticket planning remain with `to-spec` and `to-tickets` under `product-development-flow`; preserve their invocation and approval requirements.

Done when the selected visual is accessible, each requirement has repository evidence or a `Data Gap`, and the input's destination and scope are clear.
