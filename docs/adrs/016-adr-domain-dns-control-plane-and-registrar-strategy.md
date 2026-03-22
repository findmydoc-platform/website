# ADR: Domain DNS Control Plane and Registrar Strategy

## Status (Table)

| Name | Content |
| --- | --- |
| Author | Sebastian Schütze |
| Version | 1.1 |
| Date | 21.03.2026 |
| Status | accepted |

## Version History

| Version | Date | Comment |
| --- | --- | --- |
| 1.1 | 21.03.2026 | Synced with Notion domain inventory as source of truth and removed duplicated inventory assumptions. |
| 1.0 | 20.03.2026 | Initial domain consolidation decision. |

## Background

The platform currently operates a small domain portfolio across multiple providers. Domain operations are fragmented between registrar workflows and DNS management surfaces, which increases operational overhead and change risk.

The operational source of truth for domains is the Notion inventory page:
- Domain inventory: `https://www.notion.so/2fd283c73e618028bbefded48a82dc8d?v=2fd283c73e6180abbc00000c702501b3&source=copy_link`

Key domains include `findmydoc.eu` (GoDaddy), `findmydoc.xyz` (Natro), the Turkish `.tr/.com.tr` pair at Natro, plus `findmydoc24.com/.de` at Alfahosting.

Current inventory includes six active domains and mixed current providers (GoDaddy, Natro, Alfahosting) with transfer notes and renewal metadata maintained in Notion.

- The team requires a transparent and actionable decision including:
- provider comparison,
- technical security/governance assessment,
- final operating model for DNS and registrar selection,
- and founder-ready decision framing.

## Problem Description

We need a practical model that:
- keeps daily DNS operations in one control plane,
- supports mandatory TLDs (including Turkish ccTLDs),
- maintains baseline security and team-governance controls,
- and avoids over-engineering for a small domain set.

## Considerations

1. Full single-provider consolidation at Cloudflare (registrar + DNS)
   - Pros: strongest operational simplicity for one provider
   - Cons: incomplete TLD fit for current portfolio; registrar constraints are strict

2. Keep or consolidate registrar and DNS around Natro
   - Pros: strong practical fit for `.tr` and `.com.tr`
   - Cons: weaker evidence for governance depth and API-first operations

3. Consolidate around INWX for both registrar and DNS
   - Pros: strong API and security baseline
   - Cons: lower operational centralization value than Cloudflare DNS-first model

4. Use GoDaddy als Registrar mit Cloudflare DNS
   - Pros: bewährte 2SV/2FA-Options sowie DNSSEC bei GoDaddy-Nameservern; `findmydoc.eu` bleibt stabil
   - Cons: beschränkte Rollensteuerung und weniger Governance-Features im Vergleich zu Cloudflare/INWX; der Wechsel zu Cloudflare Registrar braucht einen Transfer-Plan

4. Hybrid model: Cloudflare for DNS control plane + mixed registrar (chosen)
   - Pros: best balance of operational centralization and TLD feasibility
   - Cons: registrar operations remain split for unsupported/special-case TLDs

## Decision with Rationale

We adopt a **Cloudflare DNS control plane** with a **mixed registrar strategy**:
- Default registrar for new domains: **Cloudflare Registrar** when TLD support and transfer conditions allow.
- Fallback registrar standard: **INWX** for unsupported/non-transferable TLDs outside Turkish ccTLD exceptions.
- Turkish ccTLD exception: keep `.tr` and `.com.tr` at **Natro** unless a later validated path proves equivalent certainty with lower total risk.
- Alfahosting is not a target registrar in the new model; move `findmydoc24.com` and `findmydoc24.de` away when transfer preflight checks pass.
- Recognize GoDaddy as the incumbent registrar for `findmydoc.eu`; Cloudflare DNS remains the control plane while GoDaddy stays as registrar until a transfer path is proven.

Why this decision:
- It maximizes single-pane DNS operations.
- It preserves strong governance capabilities (roles, auditability, DNSSEC workflow).
- It acknowledges real TLD and transfer constraints instead of forcing single-registrar purity.

## Operating Rules

1. DNS authority should be centralized in Cloudflare for all active production domains where technically possible.
2. Registrar decisions should follow this priority:
   - Cloudflare Registrar
   - INWX fallback
   - Natro only for Turkish ccTLD exception cases
   - Alfahosting only as temporary legacy state until migration of `findmydoc24.com` and `findmydoc24.de`
3. Domain-Übersicht (Notion) ist die einzige, gepflegte Quelle für Registrar-, DNS-Host- und Statusinformationen; dokumentiere dort neue Domains bevor du sie im ADR oder in Tickets aufnimmst.
4. Any domain transfer must pass a preflight checklist:
   - transfer lock and 60-day constraints,
   - DNSSEC state and DS sequence,
   - rollback path validation.
5. Domain-level inventory data must not be duplicated in ADRs or static docs. The Notion domain inventory remains the canonical source.

## Technical Debt

- Some registrar capabilities for niche workflows are documented unevenly across providers.
- A dedicated migration runbook issue is still required to operationalize this ADR domain-by-domain.

## Risks (Optional)

- Transfer restrictions can delay consolidation.
  - Mitigation: keep registrar exception model and move DNS first.
- DNSSEC sequencing errors can impact availability.
  - Mitigation: enforce migration runbook order and validation gates.

## Exit Criteria for Replacement

This ADR should be revisited when one of the following is true:
- the domain portfolio grows materially and changes risk profile,
- Cloudflare TLD support expands to cover all required TLDs,
- registrar governance/API capabilities change enough to simplify to a single registrar.

## Deprecated (Optional)

No prior ADR superseded directly.

## Superseded by (Optional)

Not superseded.
