# ADR: Oeffentliches Lokalisierungsrouting, SEO und Domain-Strategie

## Status (Tabelle)

| Name    | Inhalt             |
| ------- | ------------------ |
| Author  | Sebastian Schuetze |
| Version | 1.0                |
| Date    | 20.06.2026         |
| Status  | draft              |

## Hintergrund

[ADR 018](./018-adr-native-payload-localization-strategy.md) standardisiert native Payload CMS Localization fuer lokalisierte Inhalte. [ADR 021](./021-adr-localization-source-ownership-and-readiness-governance.md) definiert Deutsch (`de`) als Phase-1 public default und source locale, Englisch (`en`) als erste public alternative und `locale-ready` als Readiness-Grenze fuer public localized experiences.

Der aktuelle Repository-Stand spiegelt noch einen frueheren Localization Pilot wider. Englisch ist der technische Default, localized content access kann Query Parameters nutzen, und Sitemap plus Metadata Behavior ist noch nicht locale-aware.

Diese ADR entscheidet die public URL, SEO, Domain, Redirect und Language-Switcher Strategy, die ADR-021-Readiness konsumiert. Sie definiert Source-Language Ownership, Translation Workflow oder Payload Content Readiness nicht neu.

## Problembeschreibung

Public Localization braucht stabile, crawlbare und teilbare URLs fuer jede indexierbare Sprachversion. Query-only, Cookie-only oder Browser-Language-only Localization reicht nicht fuer Canonical URLs, `hreflang`, Sitemap Entries, Redirects, Sharing oder verlaessliche Indexierung.

Ohne klare Routing- und SEO-Entscheidung kann `.eu` in eine dritte Pseudo-Locale driften, englische Paths koennen indexierbar wirken, bevor die English Experience ready ist, und dieselbe public URL kann je nach Request State unterschiedliche Sprachen rendern. Das wuerde Search Signals schwaechen und public locale behavior schwer auditierbar machen.

## Entscheidungskriterien

Die gewaehlte Strategie muss:

- DACH-first URL continuity fuer die German default experience erhalten
- English explizite public URLs geben, wenn English ready ist
- verhindern, dass fallback-only locale versions indexierbar werden
- korrektes canonical, `hreflang`, sitemap und alternate-link behavior erzeugen
- direkte Domain-Migrationsarbeit in Phase 1 vermeiden
- einen sauberen Pfad zu spaeterer `.de`- und `.com`-Domain-Trennung halten

## Abwaegungen

1. Jeden public locale path prefixen, inklusive Deutsch
   - Vorteile: erzeugt symmetrische Path-Regeln wie `/de/...` und `/en/...`.
   - Nachteile: erzwingt unnoetige deutsche URL-Migration fuer die primaere DACH-facing experience und erhoeht Redirect-Arbeit, bevor die Domain Strategy ready ist.

2. Browser Language, Cookies oder Query Parameters fuer Public Localization nutzen
   - Vorteile: vermeidet Route Changes und kann leichtgewichtige UX Preferences unterstuetzen.
   - Nachteile: erzeugt keine stabilen indexierbaren URLs und kann dazu fuehren, dass eine public URL unterschiedliche Sprachen rendert.

3. Sofort auf domain-based localization wechseln
   - Vorteile: passt zum langfristigen Language- und Market-Targeting-Modell.
   - Nachteile: fuegt Domain-, Redirect-, Canonical- und operative Migrationsarbeit hinzu, bevor Phase-1 Content Readiness abgeschlossen ist.

4. Deutsch unprefixed halten, English unter `/en/...` ausliefern und Domains spaeter migrieren (gewaehlt)
   - Vorteile: erhaelt German URL continuity, gibt English crawlbare URLs sobald ready, haelt Phase-1 operational cost niedriger und laesst einen klaren Pfad zu `.de` und `.com`.
   - Nachteile: das kurzfristige Path Model und das langfristige Domain Model muessen ueber eine spaeter geplante Migration verbunden werden.

## Entscheidung mit Begruendung

German public default URLs bleiben im kurzfristigen path-based rollout unprefixed und liefern deutschen Content. English public URLs nutzen `/en/...`, wenn die English Locale Version ready ist. Es gibt kurzfristig keine `/de/...` public route.

Die `.eu` Domain bleibt kurzfristig die German canonical domain. Sie darf keine dritte Locale, keine separate Content Source und keine eigenstaendige Market Experience werden. Das langfristige Ziel ist domain-based localization: `.de` liefert German/DACH ohne `/de`, und `.com` liefert English/international ohne `/en`.

Die spaetere `.eu` Migration braucht geplantes `301` und Canonical Handling. Diese ADR entscheidet Zielrichtung und SEO Principles, nicht Execution Timeline oder Redirect Table fuer diese Migration.

Public indexable locale resolution wird durch Host und Path gesteuert. Dieselbe indexierbare URL darf nicht auf Basis von Cookies, Browser Language oder anderen Request Preferences unterschiedliche Sprachen rendern. Cookies und Browser Language koennen non-indexable UX wie Suggestions oder remembered switcher state unterstuetzen, sind aber nicht die Source of Truth fuer indexable locale routing.

Query Locale ist fuer Preview, Legacy Behavior und temporaere Modi reserviert. Sie darf keine indexierbaren public alternate language URLs erzeugen.

Nur Locale Versions, die ADR-021-Readiness erfuellen, duerfen in Sitemap Output, `hreflang`, Alternate Links und indexable locale metadata erscheinen. Jede ready Locale Version ist self-canonical. `hreflang` enthaelt nur ready bidirectional alternates, und `x-default` zeigt auf die German canonical URL.

English `/en/...` Routes werden nur dann public exposed, linked, indexed und in SEO Signals aufgenommen, wenn die English Route ADR-021-Readiness erfuellt. Ein normaler public `GET` fuer eine English `/en/...` Route ohne ready English Content redirectet temporaer mit `302` zur German canonical URL.

Localized Slugs sind das Ziel fuer public models, die localized public URLs expose. Public Slugs sind pro Collection und Locale eindeutig, und Slug Collisions blockieren Changes. Vor Launch oder Pilot Indexing brauchen uebersetzte Slug Changes keine automatische Redirect Maintenance. Nach Public Indexing erzeugen Slug Changes locale-specific `301` Redirects.

Der Language Switcher erhaelt die Route Intent und expose English nur, wenn eine ready equivalent target route existiert.

Preview und Draft URLs muessen Locale, Collection, Slug oder Path und Fallback State explizit transportieren, damit Preview Behavior nicht mit public indexable behavior verwechselt wird.

## Beziehung zu ADR 018 und ADR 021

ADR 018 bleibt fuer die native Payload CMS Localization Strategy accepted. ADR 021 definiert Source-Language Ownership, Fallback Governance und Public Readiness. Diese ADR konsumiert ADR-021-Readiness und wendet sie auf public routing, SEO, Domain, Redirect, Sitemap und Language-Switcher Behavior an.

Diese ADR definiert Product UI Copy Ownership, Payload Content Ownership, Translation Operations oder `localizeStatus` Readiness nicht neu.

## Nicht-Ziele

Diese ADR entscheidet nicht:

- konkrete Next.js Route Group, Middleware oder Adapter Implementation
- Payload Schema Fields oder Migration Steps
- Redirect Table Contents fuer die spaetere `.eu` Migration
- Product UI Copy Source Format oder Translation Workflow
- Payload Content Readiness Mechanics
- einen managed TMS rollout oder ein Payload Admin Translation Dashboard

## Technische Schuld

Der aktuelle Repository-Stand nutzt noch pilot-era locale behavior und nicht-locale-aware Sitemap oder Metadata Output. Die Umsetzung dieser ADR braucht spaetere Arbeit an Routes, Metadata, Sitemap, Preview, Redirect, Cache und Revalidation, damit diese locale-aware werden.

Die spaetere `.eu` Migration zu `.de` und `.com` braucht einen separaten Execution Plan mit konkreten Redirect-, Canonical-, Analytics- und Search-Index-Monitoring-Schritten.

## Risiken (Optional)

- English Pages koennen exposed werden, bevor Content ready ist.
  - Massnahme: ADR-021-Readiness verlangen, bevor English Routes in Navigation, Sitemap, `hreflang` oder indexable metadata gelangen.
- `.eu` kann versehentlich zu einer separaten Locale oder Market Surface werden.
  - Massnahme: `.eu` nur als kurzfristige German canonical halten und die spaetere Migration bewusst planen.
- Query- oder Cookie-Locale-Behavior kann in public SEO paths leaken.
  - Massnahme: Host und Path als einzige indexable locale-resolution inputs behalten.
- Domain Migration kann SEO-Verlust erzeugen, wenn sie als Implementierungsdetail behandelt wird.
  - Massnahme: `.eu` Migration als geplante SEO Migration mit `301`, Canonical und Monitoring Controls behandeln.

## Abgeloest durch (Optional)

Nicht superseded.
