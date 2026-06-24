# Feature: Evidenzanforderungen für öffentliche Akkreditierungsclaims definieren

## Problem

Öffentliche Akkreditierungen wirken als starke Vertrauenssignale. Wenn Klinikdaten Namen von Akkreditierungen, Zertifikaten oder Qualitätssiegeln enthalten, heißt das noch nicht automatisch, dass findmydoc Aussteller, Scope, Gültigkeit und Nachweis geprüft hat.

Ohne Evidenzprozess können öffentliche Chips, Counts oder Texte mehr Verlässlichkeit suggerieren, als die aktuelle Implementierung beweisen kann.

## Ziel

findmydoc braucht ein dokumentiertes und implementierbares Anforderungsset dafür, wann Akkreditierungen öffentlich als Trust Claim angezeigt werden dürfen.

Das Team soll unterscheiden können zwischen:

- intern erfassten oder von Kliniken gelieferten Akkreditierungsdaten
- neutraler Anzeige ohne stärkeren Prüfclaim
- geprüften öffentlichen Akkreditierungsclaims mit dokumentierter Quelle, Scope und Gültigkeit

## Nicht-funktionale Anforderungen

1. Claim-Integrität
   Öffentliche Akkreditierungs-Copy darf keine geprüfte Anerkennung behaupten, wenn Aussteller, Scope und Gültigkeit nicht geprüft wurden.

2. Quellennachvollziehbarkeit
   Jede öffentliche Akkreditierung braucht eine gespeicherte Quelle oder interne Referenz.

3. Scope-Klarheit
   Das System muss wissen, worauf die Akkreditierung gilt, damit sie nicht zu breit ausgespielt wird.

4. Aktualität
   Akkreditierungen brauchen ein Ablaufdatum oder eine Re-Check-Regel.

5. Auditierbarkeit
   Das System muss beantworten können, wer die Akkreditierung geprüft hat, wann das passiert ist und auf welcher Grundlage.

6. Runtime Enforcement
   Public Chips, Counts und Claims müssen durch Runtime-Logik gesteuert werden, nicht nur durch redaktionelle Disziplin.

7. Fail-safe Verhalten
   Fehlende, ungültige oder abgelaufene Evidenz muss auf neutrale Darstellung zurückfallen oder die Akkreditierung ausblenden.

8. Kompatibilität mit bestehenden Daten
   Bestehende Akkreditierungsdaten dürfen nicht automatisch als geprüft gelten.

9. Operative Wartbarkeit
   Der Prozess muss wiederholbar sein und stale Akkreditierungen sichtbar machen.

10. Datenmodell-Klarheit
    Wenn Akkreditierungen bereits als eigene Collection existieren, darf die neue Evidenzlogik nicht unnötig doppelte Stammdaten erzeugen.

## Claim-Stufen

### Mit aktuellem Datenstil grundsätzlich erlaubbar

- interne Akkreditierungserfassung
- neutrale Anzeige von hinterlegten Informationen, wenn keine Prüfung behauptet wird
- ausgeblendete Akkreditierungsdaten bis zur Prüfung

### Nur nach Evidenzprozess plus technischem Gating erlaubbar

- `Accredited clinic`
- `Verified accreditation`
- `Certified`
- Public Chips oder Counts, die geprüfte Akkreditierungen implizieren

## Mindeststandard für öffentliche Akkreditierungsclaims

Jede öffentlich ausgespielte Akkreditierung sollte mindestens haben:

- offiziellen Aussteller
- Scope oder Geltungsbereich
- Evidenzstatus
- Quellenreferenz
- Prüfzeitpunkt
- verantwortliche prüfende Person oder Rolle
- Ablaufdatum oder Re-Check-Regel
- abgeleitete Public-Eligibility

Ohne diesen Mindeststandard sollten Akkreditierungsclaims neutral bleiben oder nicht öffentlich angezeigt werden.

## Vorgeschlagene technische Richtung

Wenn eine eigene `accreditation` Collection existiert, sollten Stammdaten wie Name und Aussteller dort normalisiert werden. Die öffentliche Claim-Berechtigung kann am Klinik-Akkreditierungs-Link oder einem Accreditation-Evidence-Record hängen, damit eine Klinik nicht automatisch public-eligible wird, nur weil ein Akkreditierungsname existiert.

### Implementierungs-Feldtabelle: Accreditation Evidence

| Schema-Feld                    | Wofür ist es da?                              | Warum braucht man es?                                                                      | Warum ggf. nicht oder nur optional?                                                                 |
| ------------------------------ | --------------------------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `accreditationIssuer`          | Offizieller Aussteller der Akkreditierung.    | Ohne Aussteller ist der Claim nicht prüfbar.                                               | Wenn der Aussteller bereits in einer eigenen `accreditation` Collection steht, reicht die Relation. |
| `accreditationScope`           | Beschreibt, worauf die Akkreditierung gilt.   | Verhindert, dass eine allgemeine oder fachfremde Akkreditierung zu breit ausgespielt wird. | Kann optional starten, wenn nur einfache, gut definierte Akkreditierungen erlaubt sind.             |
| `accreditationEvidenceStatus`  | Prüfstatus des Nachweises.                    | Public Chips oder Counts dürfen nur bei geprüfter Evidenz erscheinen.                      | Nicht nötig, wenn Akkreditierungen nur intern gespeichert und nicht öffentlich angezeigt werden.    |
| `accreditationSourceReference` | Interne Referenz auf Dokument oder Quelle.    | Macht den Claim auditierbar.                                                               | Kann eine externe ID sein, wenn Dokumente nicht in Payload liegen.                                  |
| `accreditationReviewedAt`      | Zeitpunkt der Prüfung.                        | Gültigkeit und Aktualität brauchen ein Datum.                                              | Optional nur bei rein internem Draft-Status.                                                        |
| `accreditationReviewedBy`      | Prüfer oder prüfende Rolle.                   | Stellt Verantwortlichkeit her.                                                             | Rolle statt Person kann fürs MVP reichen.                                                           |
| `accreditationValidUntil`      | Ablaufdatum der Akkreditierung.               | Akkreditierungen laufen oft ab; Runtime-Gating muss das beachten.                          | Wenn eine Quelle kein Ablaufdatum hat, kann ein Re-Check-Intervall genutzt werden.                  |
| `publicAccreditationEligible`  | Abgeleitete Freigabe für öffentliche Anzeige. | Das Frontend braucht eine einfache, sichere Anzeigeentscheidung.                           | Sollte abgeleitet statt manuell gepflegt werden, wenn die Felder vollständig genug sind.            |

### Abgeleitetes Eligibility-Modell

UI-Komponenten sollten nicht selbst aus einzelnen Evidenzfeldern ableiten, ob eine Akkreditierung öffentlich erscheinen darf. Dafür sollte es eine serverseitige Eligibility-Funktion geben, zum Beispiel:

- `isAccreditationEvidenceFresh(accreditationEvidence)`
- `getPublicAccreditationEligibility(clinicAccreditation)`

Vorgeschlagenes Verhalten:

- `hidden`
  Akkreditierung wird nicht öffentlich angezeigt.
- `neutral`
  Akkreditierung kann ohne stärkeren Prüfclaim angezeigt werden, falls fachlich erlaubt.
- `verified`
  Akkreditierung hat Quelle, Scope, Review und gültige Aktualität.
- `expired`
  Akkreditierung existiert, darf aber nicht mehr als aktueller Trust Claim erscheinen.

## Route-Level Runtime-Gating

Alle öffentlichen Flächen mit Akkreditierungen müssen Eligibility prüfen, bevor Chips, Counts oder Texte gerendert werden.

Vorgeschlagener Ansatz:

- Default ist `hidden` oder neutrale Darstellung ohne Trust-Signal.
- Public Counts zählen nur eligible Akkreditierungen.
- Public Chips erscheinen nur bei gültiger Eligibility.
- Abgelaufene Akkreditierungen werden nicht als Trust Signal ausgespielt.

## Admin- und Workflow-Anforderungen

Wenn der Prozess real sein soll, muss die Admin UI ihn unterstützen. Versteckte manuelle Konventionen reichen nicht.

Vorgeschlagene Workflow-Unterstützung:

- klare Admin-Beschreibungen, welche Quelle als Akkreditierungsnachweis zählt
- Pflicht oder Hinweis für Aussteller, Scope und Gültigkeit
- Filter für ablaufende, abgelaufene oder ungeprüfte Akkreditierungen
- Hinweis, dass Klinikangaben nicht automatisch öffentliche Trust Claims sind

## Migration und Rollout

Vorgeschlagener Ablauf:

1. Bestehende Akkreditierungsdaten neutral halten.
2. Schema-Felder und Admin-Hinweise ergänzen.
3. Nur Akkreditierungen backfillen, die echte Evidenz haben.
4. Runtime-Gating für Public Chips, Counts und Texte hinzufügen.
5. Erst danach stärkere öffentliche Akkreditierungsclaims aktivieren.

Wichtige Regel:

- Keine Migration darf bestehende Akkreditierungen automatisch als verified markieren, wenn dafür keine echte Evidenz existiert.

## Akzeptanzkriterien

- Das Dokument definiert, wann öffentliche Akkreditierungsclaims erlaubt sind.
- Aussteller, Scope, Quelle und Gültigkeit sind als Mindeststandard beschrieben.
- Fail-safe Verhalten für fehlende oder abgelaufene Evidenz ist definiert.
- Jede vorgeschlagene Feldrolle erklärt Zweck, Nutzen und mögliche Gründe gegen das Feld.
- Es gibt eine plausible technische Richtung für eine spätere Implementierung.

## Out of Scope

- Finale Copy-Freigabe.
- Legal Sign-off.
- Sofortige Implementierung der Akkreditierungs-Evidenz.
- Vollständige Normalisierung aller Akkreditierungs-Stammdaten.
- Demo-Seed Cleanup oder Storybook-only Content.
