# Feature: Evidenzanforderungen für öffentliche Rating-Eligibility definieren

## Problem

Rating-Sortierung, Rating-Filter, Sterne-Durchschnitte und Review-Counts wirken wie objektive Qualitäts- oder Trust-Signale. Wenn sie ungeprüfte, gemischte oder nicht eindeutig berechtigte Daten aggregieren, kann die öffentliche UI mehr Sicherheit suggerieren, als die Datenbasis erlaubt.

Diese Aufgabe erzeugt keine eigene Review-Wahrheit. Sie definiert, wie Rating-Funktionen nur auf berechtigten Review-/Rating-Daten aufbauen dürfen.

## Ziel

findmydoc braucht ein dokumentiertes und implementierbares Anforderungsset dafür, wann Rating-Aggregate, Filter und Sortierungen öffentlich genutzt werden dürfen.

Das Team soll unterscheiden können zwischen:

- neutralen oder deaktivierten Rating-Funktionen
- Rating-Anzeige auf Basis moderierter Reviews
- stärkeren Rating-Funktionen, die nur mit verified oder public-eligible Reviews erlaubt sind

## Nicht-funktionale Anforderungen

1. Claim-Integrität
   Rating UI darf keine geprüfte Qualität suggerieren, wenn die zugrunde liegenden Reviews dafür nicht berechtigt sind.

2. Input-Nachvollziehbarkeit
   Aggregationen müssen nachvollziehbar machen, welche Review-Menge einbezogen wurde.

3. Trennung von Review-Verifikation und Rating-Aggregation
   Rating-Logik darf Review-Verifikation nicht ersetzen oder selbst erfinden.

4. Aktualität
   Rating-Aggregate brauchen einen Berechnungszeitpunkt oder müssen live berechnet werden.

5. Auditierbarkeit
   Das System muss erklären können, warum ein Rating angezeigt, gefiltert oder sortiert wurde.

6. Runtime Enforcement
   Rating-Filter und Sortierungen müssen von Eligibility abhängen, nicht nur von UI-Copy.

7. Fail-safe Verhalten
   Fehlende oder gemischte Eligibility muss auf neutrale Darstellung oder deaktivierte Rating-Funktionen zurückfallen.

8. Kompatibilität mit bestehenden Daten
   Bestehende Ratings dürfen nicht automatisch als verified oder public-eligible gelten.

9. Performance
   Aggregation darf effizient sein, muss aber korrekt bleiben. Voraggregation darf keine stale Trust-Signale erzeugen.

10. Operative Wartbarkeit
    Rating-Regeln müssen zentral sein, damit mehrere Routes nicht verschiedene Wahrheiten erzeugen.

## Claim-Stufen

### Mit aktuellem Datenstil grundsätzlich erlaubbar

- neutrale Rating-Anzeige, wenn klar nicht als geprüft behauptet
- Review-Count ohne stärkeren Verifikationsclaim
- deaktivierte Rating-Sortierung, wenn Datenbasis unklar ist

### Nur nach Evidenzprozess plus technischem Gating erlaubbar

- Rating-Sortierung als Qualitätsindikator
- Rating-Filter, die geprüfte Review-Qualität implizieren
- `verified rating`, `reviewed rating`, `trusted rating` oder vergleichbare Claims

## Mindeststandard für stärkere Rating-Funktionen

Jede stärkere Rating-Funktion sollte mindestens haben:

- definierte Review-Input-Menge
- Eligibility-Regel für einbezogene Reviews
- Aggregationsstatus
- Berechnungszeitpunkt
- Regel für gemischte oder unvollständige Daten
- abgeleitete Route- oder Komponenten-Eligibility

Ohne diesen Mindeststandard sollten Rating-Funktionen neutral bleiben oder deaktiviert werden.

## Vorgeschlagene technische Richtung

Rating-Eligibility sollte auf dem Review-Prozess aus `trust-claim-review-evidence-requirements-task.md` aufbauen. Die Rating-Aufgabe darf `publicReviewClaimTier` oder eine zentrale Review-Eligibility-Funktion verwenden, aber nicht eigene Verifikationslogik duplizieren.

### Implementierungs-Feldtabelle: Rating-Aggregate und Eligibility

| Schema-Feld oder Funktion      | Wofür ist es da?                                                                  | Warum braucht man es?                                                                                       | Warum ggf. nicht oder nur optional?                                                                 |
| ------------------------------ | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `publicRatingEligible`         | Markiert Reviews oder Aggregate als verwendbar für öffentliche Rating-Funktionen. | Sortierung und Filter dürfen nicht ungeprüfte oder gemischte Rating-Daten wie geprüfte Qualität darstellen. | Wenn Review-Eligibility eine serverseitige Funktion liefert, sollte Rating diese Funktion nutzen.   |
| `ratingAggregationStatus`      | Status eines Klinik-Rating-Aggregats, z. B. `none`, `partial`, `eligible`.        | Die Listing-Seite braucht eine einfache Entscheidung, ob Rating-Sortierung angeboten werden darf.           | Kann virtuell bleiben, wenn Aggregation on demand günstig genug ist.                                |
| `ratingAggregatedAt`           | Zeitpunkt der letzten Aggregation.                                                | Hilft bei Caching und Nachvollziehbarkeit.                                                                  | Nicht nötig, wenn Ratings immer live berechnet werden.                                              |
| `ratingEligibleReviewCount`    | Anzahl der Reviews, die in das öffentliche Rating eingeflossen sind.              | Public Counts und Durchschnitte müssen zur tatsächlich verwendeten Datenbasis passen.                       | Kann on demand berechnet werden, wenn Performance reicht.                                           |
| `ratingExcludedReviewCount`    | Anzahl ausgeschlossener Reviews wegen fehlender Eligibility.                      | Macht gemischte Datenlagen intern sichtbar und hilft beim Debugging.                                        | Für öffentliche UI nicht nötig; intern optional, wenn Monitoring anders gelöst ist.                 |
| `ratingEligibilityReason`      | Interner Grund, warum ein Rating eligible, partial oder nicht eligible ist.       | Hilft Admins und Support zu verstehen, warum Sortierung oder Filter deaktiviert sind.                       | Kann durch strukturierte Statusfelder ersetzt werden, wenn kein Freitext gewünscht ist.             |
| `getPublicRatingEligibility()` | Zentrale Funktion für Anzeige, Filter und Sortierung.                             | Verhindert, dass jede UI-Fläche eigene Rating-Regeln implementiert.                                         | Kann später in einen gespeicherten Wert überführt werden, wenn Performance oder Caching es fordert. |

### Abgeleitetes Eligibility-Modell

UI-Komponenten sollten nicht selbst aus Review- und Aggregationsfeldern ableiten, welche Rating-Funktion erlaubt ist. Dafür sollte es eine serverseitige Eligibility-Funktion geben, zum Beispiel:

- `getEligibleReviewsForRating(clinic)`
- `getPublicRatingEligibility(clinic)`
- `getRouteRatingEligibility(results)`

Vorgeschlagenes Verhalten:

- `disabled`
  Rating-Funktion wird nicht angeboten.
- `neutral`
  Rating kann neutral angezeigt werden, aber nicht als geprüftes Trust Signal.
- `eligible`
  Rating-Filter, Sortierung oder stärkerer Rating-Claim darf genutzt werden.
- `partial`
  Rating-Daten sind gemischt; die Route bleibt bei neutraler Darstellung.

## Route-Level Runtime-Gating

Betroffene öffentliche Flächen können unter anderem Listing- und Klinikdetailseiten sein. Die konkrete Route muss beim Implementierungsticket erneut gegen Runtime-Code geprüft werden.

Vorgeschlagener Ansatz:

- Rating-Sortierung wird nur angeboten, wenn `getRouteRatingEligibility` sie erlaubt.
- Rating-Filter erscheinen nur, wenn die sichtbare Datenbasis eligible ist.
- Public Copy darf keinen stärkeren Claim anzeigen als die schwächste sichtbare Datenlage erlaubt.
- Gemischte Ergebnisse fallen auf neutrale Darstellung zurück.

## Admin- und Workflow-Anforderungen

Wenn der Prozess real sein soll, muss die Admin UI ihn unterstützen. Versteckte manuelle Konventionen reichen nicht.

Vorgeschlagene Workflow-Unterstützung:

- Anzeige, welche Reviews ins Rating einfließen
- Hinweis auf ausgeschlossene Reviews oder unvollständige Eligibility
- Filter für Kliniken mit partial oder disabled Rating-Eligibility
- Debug-Ansicht für Aggregationsstatus und Aktualität

## Migration und Rollout

Vorgeschlagener Ablauf:

1. Bestehende Rating-Anzeige neutral halten.
2. Review-Eligibility als Input stabilisieren.
3. Rating-Eligibility und Aggregationsregeln hinzufügen.
4. Runtime-Gating für Filter und Sortierung ergänzen.
5. Erst danach stärkere Rating-Claims oder prominente Rating-Funktionen aktivieren.

Wichtige Regel:

- Keine Migration darf bestehende Ratings automatisch als public-eligible markieren, wenn die zugrunde liegenden Reviews nicht eindeutig berechtigt sind.

## Akzeptanzkriterien

- Rating-Eligibility ist von Review-Verifikation getrennt, nutzt sie aber als Input.
- Das Dokument definiert, wann Rating-Filter, Sortierung und Aggregate erlaubt sind.
- Fail-safe Verhalten für gemischte oder unvollständige Daten ist definiert.
- Jede vorgeschlagene Feldrolle erklärt Zweck, Nutzen und mögliche Gründe gegen das Feld.
- Es gibt eine plausible technische Richtung für eine spätere Implementierung.

## Out of Scope

- Finale Copy-Freigabe.
- Legal Sign-off.
- Sofortige Implementierung der Rating-Aggregation.
- Definition, wann eine einzelne Review verified ist.
- Demo-Seed Cleanup oder Storybook-only Content.
