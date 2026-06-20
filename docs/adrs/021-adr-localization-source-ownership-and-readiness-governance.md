# ADR: Lokalisierungsquelle, Ownership und Readiness-Governance

## Status (Tabelle)

| Name    | Inhalt             |
| ------- | ------------------ |
| Author  | Sebastian Schuetze |
| Version | 1.0                |
| Date    | 20.06.2026         |
| Status  | draft              |

## Hintergrund

[ADR 018](./018-adr-native-payload-localization-strategy.md) standardisiert native Payload CMS Localization fuer lokalisierte Inhalte. Diese Entscheidung bleibt gueltig, wurde aber um `en` als redaktionelle Default-Basis geschrieben und hat public routing, SEO, Publishing-Nuancen, Fallback-Verhalten und Translation Operations fuer spaetere Entscheidungen offen gelassen.

findmydoc braucht jetzt ein oeffentliches Lokalisierungsmodell, das zum DACH-first Product Rollout passt. Deutsch ist die public default und source language fuer die erste Lokalisierungsphase. Bestehende englische Arbeit bleibt wertvoll und wird zur `en` alternative locale, statt verworfen oder als entbehrlicher Pilot-Inhalt behandelt zu werden.

Diese Entscheidung definiert das Source-Language-Modell, die Ownership-Grenzen und die public readiness rules, von denen spaetere Routing- und SEO-Entscheidungen abhaengen. Sie entscheidet nicht die public URL shape, canonical strategy, sitemap output oder das `hreflang`-Verhalten.

## Problembeschreibung

Ohne ein klares Localization-Governance-Modell koennen Product UI Copy und Payload Content in getrennte Source Languages, Review-Regeln und Fallback-Verhalten auseinanderlaufen. Das erzeugt drei Risiken:

- Englisch kann die implizite Source Language bleiben, obwohl der erste oeffentliche Marktfokus DACH ist.
- Englische public experiences koennen vollstaendig wirken, waehrend sie deutsche Fallback-Inhalte rendern.
- Implementierungsarbeit kann Product Copy, CMS Content und Payload Admin Labels ohne klare Ownership vermischen.

Das Projekt braucht ein Phase-1-Modell, das bestehende englische Arbeit erhaelt, Deutsch die korrekte public source role gibt und definiert, wann eine Locale-Version fuer spaetere public routing und indexing decisions ready genug ist.

## Entscheidungskriterien

Das gewaehlte Modell muss:

- die DACH-first public product direction abbilden
- bestehende englische UI-, Seed- und Pilot-Inhalte als nutzbare `en` locale work erhalten
- irrefuehrende public locale experiences verhindern, die still fallback-only content zeigen
- Phase-1 Operations klein genug fuer Git und PR Review halten
- Source Formats fuer spaetere mobile exports und managed translation tooling bereit halten
- Product UI Copy, Payload Content und Payload Admin Labels getrennt halten

## Abwaegungen

1. `en` als Source und Default Locale behalten
   - Vorteile: passt zur aktuellen Pilot-Konfiguration und reduziert direkte Migrationsarbeit.
   - Nachteile: haelt das falsche Source-Language-Modell fuer einen DACH-first Rollout fest und laesst Deutsch wie eine Uebersetzungsschicht statt wie die public source wirken.

2. Source-/Default-Modell auf `de` umstellen und bestehendes Englisch als `en` erhalten (gewaehlt)
   - Vorteile: passt zum public market focus, erhaelt bestehende englische Arbeit und gibt spaeteren Routing- und SEO-Entscheidungen eine klare Readiness-Basis.
   - Nachteile: braucht sorgfaeltige Seed- und Content-Migrationsplanung, damit bestehende englische Werte uebernommen und nicht ueberschrieben werden.

3. Readiness ad hoc pro Route oder Feature entscheiden
   - Vorteile: einzelne Teams koennen schnell arbeiten.
   - Nachteile: erzeugt inkonsistentes public behavior, schwaecht SEO Governance und macht Fallback-Regeln schwer auditierbar.

4. Sofort ein managed translation system oder translation dashboard einfuehren
   - Vorteile: koennte Workflow und Review State zentralisieren.
   - Nachteile: fuegt Platform- und Operations-Overhead hinzu, bevor das Projekt genug aktive Locales, externe Uebersetzer oder Translation Throughput hat, um das zu rechtfertigen.

## Entscheidung mit Begruendung

Deutsch (`de`) ist in Phase 1 die public default und source locale fuer Product UI Copy und Payload Content. Englisch (`en`) ist die erste public alternative locale. Tuerkisch (`tr`) ist nicht Teil von Phase 1 und bleibt Future Backlog.

Bestehende englische UI Strings, Seed-Inhalte und lokalisierte Pilot-Inhalte muessen als `en` alternative-locale content erhalten bleiben, wenn sie in das neue Source-Modell ueberfuehrt werden. Deutsche Source-Werte duerfen aus dieser englischen Baseline uebersetzt oder adaptiert werden, werden nach der Migration aber reviewt und als deutscher Source Content behandelt, nicht als aus dem Englischen abgeleitete Platzhalter.

Product UI Copy und Payload Content haben getrennte Ownership:

- Product UI Copy umfasst wiederverwendbare Interface Strings wie Labels, Buttons, Validation Messages, Form Copy, Navigation Microcopy, Empty States und generischen UI Text.
- Payload Content umfasst redaktionelle, SEO-relevante, trust-relevante, conversion-relevante, rechtliche, medizinische und Domain-Inhalte, die vom CMS verantwortet werden.
- Payload Admin Labels und Helper Text bleiben Englisch und liegen ausserhalb des public localization rollout.

Product UI Copy nutzt ein Git-backed, vendor-neutrales Source Format auf Basis ICU-kompatibler Messages plus Translation Metadata. Das Source Format muss spaetere Mobile Exports und spaeteres managed translation tooling unterstuetzen, aber Phase 1 bleibt ein Git- und PR-Review-Workflow.

Payload Content nutzt native Payload Localization wie in ADR 018 entschieden. Payload per-locale draft/publish state ueber `localizeStatus` ist das vorgesehene Readiness-Signal fuer localized public content, aber erst nachdem das installierte Payload-Verhalten mit automatisierten Tests verifiziert wurde. Wenn `localizeStatus` nicht belastbar genug fuer public readiness ist, muss diese ADR wieder geoeffnet werden, statt sie still durch heuristic-only readiness zu ersetzen.

Eine Locale-Version ist nur public-ready, wenn die benoetigte Product UI Copy der Route und alle sichtbaren localized required Payload Content Dependencies in derselben Locale ready sind. Public indexable locale experiences duerfen keinen sichtbaren fallback-only content rendern.

Fallback Content darf in Preview- und Admin-Review-Workflows erscheinen, aber diese Workflows muessen Locale, Route oder Slug/Path und Fallback State explizit anzeigen. Legal, Cookie Consent, medizinische und trust-sensitive Inhalte brauchen vollstaendigen reviewten Locale Content vor public locale exposure.

## Beziehung zu ADR 018

Diese ADR superseded ADR 018 nur teilweise dort, wo ADR 018 `en` als default editorial baseline und source locale ausgewaehlt hat. ADR 018 bleibt fuer die native Payload CMS Localization Strategy accepted, inklusive der Entscheidung, keine Shadow Fields, parallelen lokalisierten Collections oder Custom Translation Tables zu bauen.

Diese ADR aendert ADR 018 nicht direkt. Eine spaetere ADR kann das public routing und SEO behavior entscheiden, das das hier definierte Readiness-Modell konsumiert.

## Nicht-Ziele

Diese ADR entscheidet nicht:

- localized public URL structure
- Domain Strategy fuer `.eu`, `.de` oder `.com`
- canonical, `hreflang`, sitemap, redirect oder language-switcher behavior
- Next.js oder Web-Runtime-Adapter-Implementierung
- konkrete Payload Schema Fields oder Migration Steps
- einen managed TMS rollout
- ein Payload Admin Translation Dashboard

## Akzeptanzszenarien

- Bestehende englische UI-, Seed- und Pilot-Inhalte bleiben als `en` alternative-locale content erhalten, waehrend `de` zum Source-/Default-Modell wird.
- Fehlende oder stale englische Product UI Copy wird vom Source Workflow gemeldet und darf nicht still deutsche Copy in einer public indexable English Experience rendern.
- Payload Content mit unverifiziertem oder defektem `localizeStatus` blockiert die Public-Readiness-Implementierung, bis diese ADR wieder geoeffnet wird.
- Legal, trust-sensitive, medizinische und cookie-relevante Inhalte koennen nicht durch fallback-only content public-ready werden.
- Preview und Admin Review koennen Fallback Content nur zeigen, wenn der Fallback State sichtbar ist.
- Eine spaetere public English route kann nur indexierbar werden, wenn das Readiness-Modell in dieser ADR erfuellt ist.

## Technische Schuld

Der aktuelle Repository-Stand spiegelt noch einen frueheren Localization Pilot mit `en` als Default Locale wider. Der Wechsel zum `de` Source Model braucht Follow-up-Planung fuer Seed Data, generated types, localized content migration und route-level public behavior.

Die spaetere Routing- und SEO-ADR muss das Readiness-Modell aus dieser ADR konsumieren, statt Readiness unabhaengig neu zu definieren.

## Risiken (Optional)

- Englischer Pilot Content kann waehrend des Source-Language-Reset verloren gehen oder ueberschrieben werden.
  - Massnahme: English Migration als Preservation Work behandeln und reviewbare Seed-/Content-Bewegung verlangen.
- Fallback Behavior kann fehlende Uebersetzungen waehrend der Implementierung verdecken.
  - Massnahme: public indexable fallback-only experiences blockieren und Fallback in Preview/Admin Review sichtbar halten.
- `localizeStatus` Behavior kann das vorgesehene Readiness-Modell in der installierten Payload-Version moeglicherweise nicht tragen.
  - Massnahme: Verhalten mit Tests verifizieren, bevor es als Grundlage genutzt wird; diese ADR wieder oeffnen, wenn die Verifikation scheitert.
- Ein Git- und PR-Workflow kann bei wachsender Locale-Zahl oder wachsender Uebersetzerzahl zu manuell werden.
  - Massnahme: managed translation tooling neu bewerten, wenn Translation Volume, aktive Locales oder externe Uebersetzerbeteiligung steigen.

## Abgeloest durch (Optional)

Nicht superseded.
