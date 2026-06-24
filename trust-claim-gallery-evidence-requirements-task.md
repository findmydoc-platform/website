# Feature: Evidenzanforderungen für öffentliche Before-/After Case Gallery definieren

## Problem

Before-/After-Fälle sind öffentliche Trust Claims mit besonders hoher Sensibilität. Ein sichtbarer Fall kann implizieren, dass Bildmaterial, Behandlungskontext, Ergebnisdarstellung und Einwilligung geprüft wurden.

Ohne fallbezogenen Evidenzprozess reicht eine klinikweite Freigabe nicht aus. Jeder öffentliche Case braucht eigene Nachweise, Consent-Status, Review-Status und Runtime-Gating.

## Ziel

findmydoc braucht ein dokumentiertes und implementierbares Anforderungsset dafür, wann Before-/After-Fälle öffentlich angezeigt werden dürfen.

Das Team soll unterscheiden können zwischen:

- internen oder deaktivierten Case-Daten, die nicht öffentlich ausgespielt werden
- neutraler Galerieanzeige ohne stärkeren Ergebnis-Claim
- geprüfter öffentlicher Darstellung mit dokumentiertem Consent und fallbezogener Evidenz

## Nicht-funktionale Anforderungen

1. Claim-Integrität
   Öffentliche Case-Darstellung darf keine geprüfte Ergebnisqualität suggerieren, wenn die Fall-Evidenz das nicht belegt.

2. Consent-Sicherheit
   Kein Case darf öffentlich erscheinen, wenn Consent fehlt, unklar ist oder widerrufen wurde.

3. Fallbezogene Nachvollziehbarkeit
   Nachweise müssen pro Case referenziert werden, nicht nur auf Klinik- oder Behandlungsebene.

4. Aktualität
   Re-Check oder Ablaufregeln müssen definieren, wann ein Case erneut geprüft oder entfernt werden muss.

5. Auditierbarkeit
   Das System muss beantworten können, wer den Case geprüft hat, wann das passiert ist und auf welcher Grundlage.

6. Runtime Enforcement
   Öffentliche Case-Anzeige muss durch Runtime-Logik gesteuert werden, nicht nur durch redaktionelle Disziplin.

7. Fail-safe Verhalten
   Fehlende, ungültige oder abgelaufene Evidenz muss den Case aus der öffentlichen Anzeige entfernen.

8. Datenschutz
   Private Nachweise und Consent-Dokumente dürfen nicht öffentlich ausgeliefert werden.

9. Kompatibilität mit bestehenden Daten
   Bestehende Case-Daten dürfen neutral intern weiter bestehen, ohne automatisch public-eligible zu werden.

10. Operative Wartbarkeit
    Der Prozess muss wiederholbar sein. Wenn Review- oder Consent-Aufwand nicht leistbar ist, soll die Galerie deaktiviert bleiben statt riskant ausgespielt zu werden.

## Claim-Stufen

### Mit aktuellem Datenstil grundsätzlich erlaubbar

- Keine öffentliche Case Gallery.
- Interne Case-Erfassung.
- Neutraler interner Review-Status ohne öffentliche Ausgabe.

### Nur nach Evidenzprozess plus technischem Gating erlaubbar

- Öffentliche Before-/After Case Gallery.
- Fallbezogene Ergebnisdarstellung.
- Claims wie `verified case`, `reviewed result`, `checked before and after` oder vergleichbare Signale.

## Mindeststandard für öffentliche Case-Anzeige

Jeder öffentliche Case sollte mindestens haben:

- fallbezogenen Evidence-Status
- dokumentierten Consent-Status
- Consent-Referenz oder interne Consent-ID
- Review-Zeitpunkt
- verantwortliche prüfende Person oder Rolle
- Re-Check- oder Ablaufregel
- abgeleitete Public-Eligibility

Ohne diesen Mindeststandard sollte ein Case nicht öffentlich angezeigt werden.

## Vorgeschlagene technische Richtung

Der naheliegende Ort ist `clinicGalleryEntries`, weil dort die fallbezogenen Galerieeinträge liegen. Media-Collections können weiterhin die Dateien verwalten, aber die öffentliche Claim-Berechtigung sollte am konkreten Case hängen.

### Implementierungs-Feldtabelle: `clinicGalleryEntries`

| Schema-Feld            | Wofür ist es da?                                                                | Warum braucht man es?                                                                                   | Warum ggf. nicht oder nur optional?                                                                  |
| ---------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `caseEvidenceStatus`   | Prüfstatus des konkreten Before-/After-Falls.                                   | Ein veröffentlichter Case kann nur public-safe sein, wenn genau dieser Case geprüft wurde.              | Wenn die Galerie für MVP deaktiviert bleibt, wird das Feld erst mit der Gallery-Story benötigt.      |
| `caseConsentStatus`    | Status der dokumentierten Einwilligung, z. B. `missing`, `received`, `revoked`. | Before-/After-Bilder sind besonders sensibel; ohne Consent darf keine öffentliche Darstellung erfolgen. | Nicht optional, sobald echte Patientenfälle öffentlich gezeigt werden.                               |
| `caseConsentReference` | Interne Referenz auf die Einwilligung.                                          | Erlaubt spätere Prüfung, ohne private Dokumente öffentlich zu machen.                                   | Kann bei externer Dokumentenablage nur eine externe ID sein.                                         |
| `caseReviewedAt`       | Zeitpunkt der Fallprüfung.                                                      | Belegt, wann Bild, Text, Nachweis und Einwilligung geprüft wurden.                                      | Optional nur für nicht veröffentlichte Entwürfe.                                                     |
| `caseReviewedBy`       | Verantwortliche prüfende Person oder Rolle.                                     | Case-Freigaben brauchen Accountability.                                                                 | Eine Rolle kann fürs MVP reichen, wenn personenbezogene Reviewer-Zuordnung noch nicht gewünscht ist. |
| `caseValidUntil`       | Re-Check- oder Ablaufdatum.                                                     | Hilft, abgelaufene oder zu überprüfende Fälle automatisch zu neutralisieren oder zu verstecken.         | Nicht jeder Case braucht ein Ablaufdatum; Consent-Widerruf muss aber unabhängig davon möglich sein.  |
| `publicCaseEligible`   | Abgeleiteter Boolean oder Claim-Level für öffentliche Anzeige.                  | Das Frontend braucht eine einfache Entscheidung: anzeigen oder nicht anzeigen.                          | Sollte idealerweise aus Statusfeldern abgeleitet werden, damit keine manuelle Abweichung entsteht.   |

### Abgeleitetes Eligibility-Modell

UI-Komponenten sollten nicht selbst aus einzelnen Evidenzfeldern ableiten, ob ein Case öffentlich erscheinen darf. Dafür sollte es eine serverseitige Eligibility-Funktion geben, zum Beispiel:

- `isCaseConsentValid(caseEntry)`
- `isCaseEvidenceFresh(caseEntry)`
- `getPublicCaseEligibility(caseEntry)`

Vorgeschlagenes Verhalten:

- `hidden`
  Case ist nicht öffentlich sichtbar.
- `neutral`
  Case ist sichtbar, aber ohne stärkeren Prüf- oder Ergebnis-Claim.
- `reviewed`
  Case hat gültigen Consent, Evidence-Status, Review-Datum und ist nicht abgelaufen.
- `revoked`
  Case war ggf. früher erlaubt, ist aber wegen Consent-Widerruf oder Ablauf nicht mehr öffentlich sichtbar.

## Route-Level Runtime-Gating

Alle öffentlichen Galerieflächen müssen Case-Eligibility serverseitig prüfen, bevor Cases an UI-Komponenten übergeben werden.

Vorgeschlagener Ansatz:

- Default ist `hidden`.
- Nur `publicCaseEligible` oder eine zentrale Eligibility-Funktion erlaubt Rendering.
- Abgelaufene oder widerrufene Cases werden nicht ausgeliefert.
- Öffentliche Count- oder Trust-Copy darf nur sichtbare eligible Cases zählen.

## Admin- und Workflow-Anforderungen

Wenn der Prozess real sein soll, muss die Admin UI ihn unterstützen. Versteckte manuelle Konventionen reichen nicht.

Vorgeschlagene Workflow-Unterstützung:

- klare Admin-Beschreibungen, was als gültiger Consent zählt
- Reviewer-Hinweise für fallbezogene Evidence-Prüfung
- sichtbarer Status für fehlende, widerrufene oder ablaufende Einwilligungen
- Filter für Cases, die bald ablaufen oder erneut geprüft werden müssen
- keine einfache öffentliche Freigabe ohne Consent- und Evidence-Status

## Migration und Rollout

Vorgeschlagener Ablauf:

1. Öffentliche Galerie standardmäßig deaktiviert oder leer lassen.
2. Schema-Felder und Admin-Hinweise hinzufügen.
3. Nur Cases backfillen, die echte Evidenz und gültigen Consent haben.
4. Runtime-Gating hinzufügen.
5. Erst danach öffentliche Case-Darstellung aktivieren.

Wichtige Regel:

- Keine Migration darf Legacy-Cases automatisch public-eligible machen, wenn dafür keine echte Evidenz und kein gültiger Consent existieren.

## Akzeptanzkriterien

- Das Dokument definiert, wann Before-/After Cases öffentlich sichtbar sein dürfen.
- Consent, Evidence, Review und Ablauf sind getrennt beschrieben.
- Fail-safe Verhalten für fehlende, widerrufene oder abgelaufene Evidenz ist definiert.
- Jede vorgeschlagene Feldrolle erklärt Zweck, Nutzen und mögliche Gründe gegen das Feld.
- Es gibt eine plausible technische Richtung für eine spätere Implementierung.

## Out of Scope

- Finale Copy-Freigabe.
- Legal Sign-off.
- Sofortige Implementierung der Case Gallery.
- Bildbearbeitung oder Media-Upload UX.
- Demo-Seed Cleanup oder Storybook-only Content.
