# Feature: Trust-Core Verification Badges implementierbar machen

## Problem

Verification Badges sind die genannte Ausnahme unter den Trust-Claim Themen: Der Trust-Core Prozess ist als Konzept bereits definiert, aber noch nicht als Story implementiert.

Das Problem ist deshalb nicht primär, einen neuen Prozess zu erfinden. Die offene Aufgabe ist, den vorhandenen Trust-Core in Datenmodell, Admin-Workflow und Runtime-Gating zu übersetzen, damit Badges nicht aus Demo-Daten, manuellen Tiers oder UI-Copy entstehen.

## Ziel

findmydoc braucht ein implementierbares Anforderungsset dafür, wie der bestehende Trust-Core Prozess technisch in öffentliche Verification Badges übersetzt wird.

Das Team soll unterscheiden können zwischen:

- Trust-Core Konzept, das fachlich bereits existiert
- fehlender technischer Implementierungsstory
- öffentlicher Badge-Anzeige, die erst nach implementiertem Trust-Core Gating erlaubt ist

## Nicht-funktionale Anforderungen

1. Prozess-Treue
   Die Implementierung muss das bestehende Trust-Core Konzept abbilden und darf keine konkurrierende Badge-Logik erfinden.

2. Claim-Integrität
   Ein Badge darf nur erscheinen, wenn die Trust-Core Bedingungen erfüllt sind.

3. Nachvollziehbarkeit
   Jede Badge-Entscheidung braucht eine interne Referenz auf die zugrunde liegenden Trust-Core Nachweise oder Checks.

4. Aktualität
   Trust-Core Prüfungen brauchen entweder Gültigkeit, Re-Check-Regel oder eine dokumentierte Entscheidung gegen Ablauf.

5. Auditierbarkeit
   Das System muss beantworten können, wer die Trust-Core Prüfung freigegeben hat, wann das passiert ist und auf welcher Grundlage.

6. Runtime Enforcement
   Badge-Anzeige muss durch Runtime-Logik gesteuert werden, nicht nur durch Admin-Tiers oder UI-Copy.

7. Fail-safe Verhalten
   Fehlende, ungültige oder nicht implementierte Trust-Core Daten müssen Badge-Anzeige verhindern.

8. Kompatibilität mit bestehenden Daten
   Bestehende Klinikdaten oder Demo-Werte dürfen nicht automatisch als verified gelten.

9. Operative Wartbarkeit
   Trust-Core Status muss für Admins verständlich und überprüfbar sein.

10. Konzeptbindung
    Wenn das Trust-Core Dokument andere Feldnamen oder Statuswerte definiert, müssen diese übernommen werden.

## Claim-Stufen

### Mit aktuellem nicht implementiertem Trust-Core grundsätzlich erlaubbar

- keine öffentliche Badge-Anzeige
- neutrale Klinikdarstellung ohne `verified` Claim
- interne Trust-Core Vorbereitung oder manuelle Prüfung ohne öffentliche Ausgabe

### Nur nach Trust-Core Implementierung plus technischem Gating erlaubbar

- `Verified clinic`
- Verification Badge
- Badge-Level wie Bronze/Silver/Gold, falls so im Trust-Core Konzept definiert
- andere öffentliche Claims, die eine findmydoc Prüfung der Klinik behaupten

## Mindeststandard für öffentliche Verification Badges

Jeder öffentliche Badge sollte mindestens haben:

- technischen Trust-Core Status
- Badge-Level oder abgeleitete Badge-Stufe
- Review-Zeitpunkt
- verantwortliche prüfende Person oder Rolle
- Gültigkeit oder Re-Check-Regel
- interne Evidenzreferenz auf Trust-Core Nachweise
- abgeleitete Public-Badge-Eligibility

Ohne diesen Mindeststandard sollte kein Verification Badge öffentlich erscheinen.

## Vorgeschlagene technische Richtung

Diese Aufgabe muss aus dem bestehenden Trust-Core Konzept abgeleitet werden. Falls das Konzept bereits konkrete Status, Tiers oder Checklisten definiert, sind diese Namen und Regeln maßgeblich.

### Implementierungs-Feldtabelle: Trust-Core Feldrollen

Diese Tabelle ersetzt nicht das bestehende Trust-Core Dokument. Sie benennt nur die Feldrollen, die die spätere Implementierungsstory aus dem Trust-Core Konzept ableiten muss.

| Schema-Feld                     | Wofür ist es da?                                                                     | Warum braucht man es?                                                          | Warum ggf. nicht oder nur optional?                                                                            |
| ------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `verificationStatus`            | Technischer Status, ob die Klinik nach Trust-Core Regeln geprüft ist.                | Badge-Anzeige darf nicht direkt aus Demo-Daten oder manuellen Tiers kommen.    | Falls das Trust-Core Dokument andere Statusnamen definiert, müssen diese übernommen werden.                    |
| `verificationTier`              | Öffentliches Badge-Level, z. B. Bronze/Silver/Gold oder ein anderes Trust-Core Tier. | Das Frontend braucht eine klare, begrenzte Badge-Ausprägung.                   | Sollte abgeleitet sein, wenn Tier aus mehreren Trust-Core Checks berechnet wird.                               |
| `verificationReviewedAt`        | Zeitpunkt der letzten Trust-Core Prüfung.                                            | Badge-Freshness und Re-Check brauchen ein Datum.                               | Nicht optional, sobald der Badge als geprüfte Aussage verstanden wird.                                         |
| `verificationReviewedBy`        | Verantwortliche prüfende Person oder Rolle.                                          | Verhindert nicht nachvollziehbare Badge-Freigaben.                             | Rolle statt Person kann fürs MVP reichen.                                                                      |
| `verificationValidUntil`        | Ablauf oder nächster Re-Check.                                                       | Badge darf nicht dauerhaft gültig bleiben, wenn der Prozess zeitgebunden ist.  | Kann entfallen, wenn Trust-Core bewusst ohne Ablauf arbeitet; dann braucht es aber eine andere Re-Check-Regel. |
| `verificationEvidenceReference` | Interne Referenz auf die Trust-Core Nachweise.                                       | Macht Badge-Entscheidungen auditierbar.                                        | Kann durch mehrere spezifische Nachweisfelder ersetzt werden, wenn das Trust-Core Konzept das genauer vorgibt. |
| `publicBadgeEligible`           | Abgeleitete Freigabe für öffentliche Badge-Anzeige.                                  | Die UI soll nicht selbst aus Rohfeldern ableiten, ob ein Badge angezeigt wird. | Kann virtuell sein, wenn eine zentrale Eligibility-Funktion genutzt wird.                                      |

### Abgeleitetes Eligibility-Modell

UI-Komponenten sollten nicht selbst aus einzelnen Trust-Core Feldern ableiten, ob ein Badge erscheinen darf. Dafür sollte es eine serverseitige Eligibility-Funktion geben, zum Beispiel:

- `getTrustCoreVerificationStatus(clinic)`
- `getPublicBadgeEligibility(clinic)`

Vorgeschlagenes Verhalten:

- `hidden`
  Kein Badge erscheint.
- `pending`
  Trust-Core Prüfung ist offen oder unvollständig; kein öffentlicher Badge.
- `verified`
  Trust-Core Bedingungen sind erfüllt und nicht abgelaufen.
- `expired`
  Frühere Prüfung ist abgelaufen; kein öffentlicher Badge oder nur neutrale interne Anzeige.

## Route-Level Runtime-Gating

Alle öffentlichen Badge-Flächen müssen Trust-Core Eligibility prüfen, bevor Badges gerendert werden.

Vorgeschlagener Ansatz:

- Default ist keine Badge-Anzeige.
- Badge-Level wird nur aus Trust-Core Eligibility abgeleitet.
- Public Copy darf nicht `verified` sagen, wenn `publicBadgeEligible` false ist.
- Abgelaufene oder unvollständige Trust-Core Prüfungen verhindern die Badge-Anzeige.

## Admin- und Workflow-Anforderungen

Wenn der Prozess real sein soll, muss die Admin UI ihn unterstützen. Versteckte manuelle Konventionen reichen nicht.

Vorgeschlagene Workflow-Unterstützung:

- Admin-Ansicht für Trust-Core Status und fehlende Checks
- klare Hinweise, welche Trust-Core Bedingungen für Badge-Anzeige fehlen
- Filter für pending, verified und expired Kliniken
- Schutz gegen manuelle öffentliche Badge-Freigabe ohne Trust-Core Eligibility

## Migration und Rollout

Vorgeschlagener Ablauf:

1. Trust-Core Konzept als technische Story referenzieren.
2. Status, Tiers und Checks aus dem Konzept in Schema und Funktionen übersetzen.
3. Bestehende Klinikdaten neutral lassen.
4. Nur Kliniken mit echter Trust-Core Evidenz backfillen.
5. Runtime-Gating für Badge-Anzeige hinzufügen.
6. Erst danach öffentliche Verification Badges aktivieren.

Wichtige Regel:

- Keine Migration darf bestehende Kliniken automatisch als verified markieren, wenn dafür keine Trust-Core Evidenz existiert.

## Akzeptanzkriterien

- Das Dokument erfindet keinen neuen Trust-Core Prozess.
- Die Aufgabe ist als Implementierungslücke des bestehenden Trust-Core Konzepts beschrieben.
- Fail-safe Verhalten für fehlende oder nicht implementierte Trust-Core Daten ist definiert.
- Jede vorgeschlagene Feldrolle erklärt Zweck, Nutzen und mögliche Gründe gegen das Feld.
- Es gibt eine plausible technische Richtung für eine spätere Implementierung.

## Out of Scope

- Finale Copy-Freigabe.
- Legal Sign-off.
- Neudefinition des Trust-Core Konzepts.
- Sofortige Implementierung der Verification Badges.
- Demo-Seed Cleanup oder Storybook-only Content.
