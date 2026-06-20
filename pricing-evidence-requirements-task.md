# Feature: Evidenzanforderungen für öffentliche Preis-Claims definieren

## Problem

Die öffentliche Listing-Comparison Route nutzt Preis-Wording, das eine Prüfung oder Qualitätssicherung nahelegen kann, die das aktuelle Runtime-Datenmodell noch nicht beweist. Die UI kann Preise anzeigen, aber sie erzwingt aktuell keinen dokumentierten Prozess für Quelle, Review-Status, Aktualität oder Claim-Berechtigung.

Solange diese Kontrollen fehlen, sind stärkere Aussagen wie `Transparent pricing`, `Reviewed prices`, `Verified prices` oder `Checked prices` riskant.

Aktuelle öffentliche Runtime-Fläche:

- `/listing-comparison`
- `src/app/(frontend)/listing-comparison/page.tsx`

Aktuelles Hochrisiko-Wording auf dieser Route:

- `Transparent pricing for medical treatments near you`
- `Reviewed prices`

## Ziel

findmydoc braucht ein dokumentiertes und implementierbares Anforderungsset dafür, wann öffentliche Preis-Claims erlaubt sind.

Das Team soll unterscheiden können zwischen:

- neutraler Preisanzeige, die mit dem aktuellen Datenmodell grundsätzlich möglich ist
- stärkeren Pricing Claims, die erst nach definiertem Evidenzprozess, Datenmodell und Runtime-Gating erlaubt sind

Das Ergebnis soll konkret genug sein, damit Product, Content, Engineering und Compliance entscheiden können, ob findmydoc:

- nur neutrales Wording nutzt
- später einen geprüften Pricing-Prozess einführt
- technische Enforcement-Regeln für stärkere Claims baut

## Nicht-funktionale Anforderungen

1. Claim-Integrität
   Öffentliche Copy darf keine stärkere Preisqualität versprechen, als die Runtime-Daten beweisen.

2. Quellennachvollziehbarkeit
   Jeder Preis, der für stärkere Claims zählt, braucht eine gespeicherte Quelle.

3. Aktualität
   Jeder qualifizierende Preis braucht ein Erfassungs- oder Review-Datum und eine definierte Re-Check-Regel.

4. Auditierbarkeit
   Das System muss beantworten können, wer einen Preis eingegeben oder geprüft hat, wann das passiert ist und auf welcher Grundlage.

5. Runtime Enforcement
   Starke Pricing Claims müssen durch Runtime-Logik gesteuert werden, nicht nur durch redaktionelle Disziplin.

6. Fail-safe Verhalten
   Fehlende, ungültige oder abgelaufene Evidenz muss auf neutrales Wording zurückfallen, statt stärkere Claims sichtbar zu lassen.

7. Scope-Klarheit
   Die Regeln müssen trennen zwischen:
   - reiner Preisanzeige
   - quellenbasierter Preisanzeige
   - geprüfter oder bestätigter Preisanzeige

8. Redaktionelle Kontrolle
   Content Owner dürfen aus freigegebenen Wording-Stufen wählen, aber technische Eligibility-Regeln für stärkere Claims nicht umgehen.

9. Kompatibilität mit bestehenden Daten
   Bestehende Preisdatensätze müssen neutral weiter angezeigt werden können, ohne vorher vollständig backfilled zu sein.

10. Operative Wartbarkeit
    Der Prozess muss wiederholbar sein. Wenn Review-Aufwand zu hoch ist, soll das System schwächeres Wording wählen statt versteckte Prozessschuld zu erzeugen.

## Claim-Stufen

### Mit aktuellem Datenstil grundsätzlich erlaubbar

- `Compare clinic prices`
- `Price information`
- `Listed starting prices`
- `Price fields where available`
- `From`
- `Price range`

### Nur nach Evidenzprozess plus technischem Gating erlaubbar

- `Transparent pricing`
- `Reviewed prices`
- `Verified prices`
- `Checked prices`

## Mindeststandard für stärkere Preis-Claims

Wenn findmydoc stärkere öffentliche Pricing Claims nutzen will, sollte jeder qualifizierende öffentliche Preis mindestens haben:

- einen Quellentyp
- eine Quellenreferenz oder interne Quellennotiz
- ein Datum der Einreichung, Erfassung oder Übernahme
- einen Review-Status
- einen Review-Zeitpunkt
- eine verantwortliche prüfende Person oder Rolle
- eine Gültigkeitsregel oder ein Ablaufdatum

Ohne diesen Mindeststandard sollten stärkere Pricing Claims deaktiviert bleiben.

## Vorgeschlagene technische Richtung

Der naheliegende Ort für Pricing Evidence ist `clinictreatments`, weil dort die öffentlichen klinikspezifischen Preise bereits liegen.

### Implementierungs-Feldtabelle: `ClinicTreatments`

| Schema-Feld            | Wofür ist es da?                                                                                                                       | Warum braucht man es?                                                                                                     | Warum ggf. nicht oder nur optional?                                                                                                                   |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `priceSourceType`      | Klassifiziert die Preisquelle, z. B. `clinic_submitted`, `clinic_document`, `email_confirmation`, `contract`, `manual_platform_entry`. | Ohne Quellentyp ist nicht klar, ob der Preis von einer Klinik, einem Dokument, einer E-Mail oder interner Eingabe stammt. | Für MVP kann ein grober Typ reichen. Wenn alle Preise nur aus einer einzigen Quelle kommen, ist das Feld zunächst weniger wichtig.                    |
| `priceSourceReference` | Interne Referenz oder Notiz zur Quelle.                                                                                                | Ermöglicht spätere Prüfung, ohne Quellendokumente öffentlich zu machen.                                                   | Wenn Nachweise in einem externen System liegen, kann nur eine externe ID gespeichert werden.                                                          |
| `priceSubmittedAt`     | Zeitpunkt, an dem der Preis eingereicht, übernommen oder erfasst wurde.                                                                | Trennt das Eingangsdatum vom Review-Datum und hilft bei Aktualitätsregeln.                                                | Wenn Preise nur direkt im Review erfasst werden, kann `priceReviewedAt` für den Start reichen.                                                        |
| `priceReviewStatus`    | Status des Preisreviews, z. B. `unreviewed`, `reviewed`, `expired`, `rejected`.                                                        | Stärkere Claims wie `Reviewed prices` brauchen eine eindeutige Freigabe.                                                  | Nicht nötig für rein neutrale Preisanzeige. Für stärkere Claims aber zentral.                                                                         |
| `priceReviewedAt`      | Zeitpunkt, an dem der Preis geprüft wurde.                                                                                             | Freshness und Ablaufregeln brauchen ein belastbares Datum.                                                                | Optional nur, solange kein stärkerer Preis-Claim öffentlich ausgespielt wird.                                                                         |
| `priceReviewedBy`      | Verantwortliche prüfende Person oder Rolle.                                                                                            | Macht die Freigabe auditierbar und verhindert unklare manuelle Claims.                                                    | Eine Rolle kann fürs MVP reichen, wenn personenbezogene Reviewer-Zuordnung nicht gewünscht ist.                                                       |
| `priceReviewNotes`     | Interne Notiz dazu, was geprüft wurde.                                                                                                 | Hilft bei Grenzfällen, z. B. wenn Preise aus mehreren Quellen oder mit Einschränkungen übernommen wurden.                 | Kann optional bleiben, wenn strukturierte Felder die Entscheidung ausreichend erklären.                                                               |
| `priceValidUntil`      | Ablaufdatum oder expliziter Re-Check-Zeitpunkt.                                                                                        | Verhindert, dass alte Preise dauerhaft als geprüft oder transparent gelten.                                               | Wenn kein fixes Ablaufdatum existiert, kann die Gültigkeit aus `priceReviewedAt` plus Regel abgeleitet werden.                                        |
| `publicPriceClaimTier` | Öffentliche Claim-Stufe, z. B. `neutral`, `source_backed`, `reviewed`.                                                                 | Das Frontend soll eine einfache, sichere Entscheidung bekommen und nicht selbst Compliance-Felder interpretieren.         | Besser als abgeleiteter Wert, wenn die Berechnung einfach und performant ist. Als gespeichertes Feld nur, wenn Reporting oder Performance es braucht. |

### Abgeleitetes Eligibility-Modell

UI-Komponenten sollten nicht selbst aus einzelnen Evidenzfeldern ableiten, wie stark ein Claim sein darf. Dafür sollte es eine serverseitige Eligibility-Funktion geben, zum Beispiel:

- `isPriceEvidenceFresh(record)`
- `isPriceReviewed(record)`
- `getPublicPriceClaimTier(record)`

Vorgeschlagenes Verhalten:

- `neutral`
  Preis existiert, unabhängig von vollständiger Evidenz.
- `source_backed`
  Preis existiert und hat eine nachvollziehbare Quelle.
- `reviewed`
  Preis existiert, Quellenfelder sind vorhanden, Review-Status ist `reviewed`, und die Evidenz ist noch gültig.
- `expired`
  Preis existiert, aber stärkere Claim-Berechtigung ist abgelaufen.

### Implementierungs-Feldtabelle: abgeleitete Felder und Funktionen

| Feld oder Funktion                | Wofür ist es da?                                                                                   | Warum braucht man es?                                                              | Warum ggf. nicht oder nur optional?                                                                        |
| --------------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `isPriceEvidenceFresh(record)`    | Prüft, ob Review-Datum und Gültigkeit noch aktuell sind.                                           | Starke Claims dürfen nicht auf alten Preisen hängen bleiben.                       | Kann in `getPublicPriceClaimTier` aufgehen, wenn keine separate Wiederverwendung nötig ist.                |
| `isPriceReviewed(record)`         | Prüft, ob ein Preis den Review-Mindeststandard erfüllt.                                            | Trennt neutrale Preisanzeige von `Reviewed prices`.                                | Kann entfallen, wenn nur Claim-Tier statt Boolean genutzt wird.                                            |
| `getPublicPriceClaimTier(record)` | Liefert die erlaubte öffentliche Claim-Stufe pro Preis.                                            | Das Frontend braucht eine sichere, einheitliche Entscheidung.                      | Kann als gespeichertes Feld umgesetzt werden, wenn Runtime-Berechnung zu teuer wird.                       |
| `routePriceClaimTier`             | Aggregierte Claim-Stufe für die gesamte Listing-Comparison Route oder den aktuellen Ergebnis-Satz. | Die Route darf keinen Claim versprechen, der stärker ist als die sichtbaren Daten. | Kann on demand berechnet werden; als Feld nur nötig, wenn die Route stark gecacht oder voraggregiert wird. |

## Route-Level Runtime-Gating

Die wichtigste aktuelle öffentliche Claim-Fläche ist:

- `src/app/(frontend)/listing-comparison/page.tsx`

Vorgeschlagener Ansatz:

- neutrales Wording bleibt Default
- Preis-Evidenzmetriken werden serverseitig aggregiert
- stärkeres Wording rendert nur, wenn die aggregierte Eligibility erfüllt ist

Beispielregeln:

- Wenn die Route nur neutrale Preisdatensätze hat:
  - Subtitle bleibt neutral
  - Bullet nutzt z. B. `Price fields where available`
- Wenn alle sichtbaren Preisdatensätze die reviewed-Schwelle erfüllen:
  - stärkeres Wording wird berechtigt
- Wenn der sichtbare Datensatz gemischt ist:
  - Route bleibt bei neutralem Wording

So verspricht die Route nie mehr als der schwächste sichtbare Preisdatensatz belegt.

## Admin- und Workflow-Anforderungen

Wenn der Prozess real sein soll, muss die Admin UI ihn unterstützen. Versteckte manuelle Konventionen reichen nicht.

Vorgeschlagene Workflow-Unterstützung:

- klare Admin-Beschreibungen, was als gültige Evidenz zählt
- Reviewer-Hinweise, wann ein Preis auf `reviewed` gesetzt werden darf
- Listen oder Filter für stale oder bald ablaufende Preis-Evidenz
- optionaler Reminder- oder Reporting-Pfad für Re-Checks

Ohne diese Unterstützung existiert das Evidenzmodell nur im Schema und wird operativ schnell unzuverlässig.

## Migration und Rollout

Vorgeschlagener Ablauf:

1. Neutrales Wording ausliefern.
2. Schema-Felder und internen Workflow hinzufügen.
3. Nur Preise backfillen, die echte Evidenz haben.
4. Runtime-Gating hinzufügen.
5. Erst danach öffentliches Wording auf stärkere Claims umstellen, wenn die Datenabdeckung ausreicht.

Wichtige Regel:

- Keine Migration darf Legacy-Preise automatisch als reviewed markieren, wenn dafür keine echte Evidenz existiert.

## Akzeptanzkriterien

- Das Dokument definiert, wann neutrales Pricing Wording erlaubt ist und wann stärkere Claims Evidenz brauchen.
- Es ist klar dokumentiert, dass ein Prozesspapier allein für stärkere Runtime Claims nicht reicht.
- `/listing-comparison` ist als aktuelle öffentliche Hauptfläche benannt.
- Das minimale Evidenzmodell für stärkere Pricing Claims ist beschrieben.
- Fail-safe Verhalten für fehlende, veraltete oder unvollständige Evidenz ist definiert.
- Jede vorgeschlagene Feldrolle erklärt Zweck, Nutzen und mögliche Gründe gegen das Feld.
- Es gibt eine plausible technische Richtung für eine spätere Implementierung.

## Out of Scope

- Finale Copy-Freigabe für `/listing-comparison`.
- Legal Sign-off.
- Sofortige Implementierung des Pricing-Prozesses.
- Demo-Seed Cleanup oder Storybook-only Pricing Copy.
- Vollständige Trust-Claim Policy außerhalb pricing-spezifischer Claims.
