# Feature: Evidenzanforderungen für öffentliche Review-Claims definieren

## Problem

Öffentliche Reviews können schnell als Trust Signal verstanden werden. Die aktuelle Umsetzung kann Review-Inhalte moderieren, aber Moderation ist nicht dasselbe wie Verifikation.

Stärkere Aussagen wie `verified review`, `reviewed patient feedback` oder ähnliche Claims brauchen einen definierten Prozess dafür, wann eine Review mit einem echten Kontakt, einer zulässigen Quelle oder einem geprüften Nachweis verbunden ist.

## Ziel

findmydoc braucht ein dokumentiertes und implementierbares Anforderungsset dafür, wann öffentliche Review-Claims erlaubt sind.

Das Team soll unterscheiden können zwischen:

- moderierten Reviews, die inhaltlich freigegeben sind
- verifizierten Reviews, die eine zusätzliche Nachweisprüfung bestanden haben
- Review-Daten, die zwar intern existieren, aber nicht für stärkere öffentliche Claims genutzt werden dürfen

## Nicht-funktionale Anforderungen

1. Claim-Integrität
   Öffentliche Review-Copy darf keine Verifikation behaupten, wenn nur Moderation stattgefunden hat.

2. Quellennachvollziehbarkeit
   Jede verifizierte Review braucht eine gespeicherte Quelle oder interne Referenz.

3. Datenschutz
   Patientenkontakte oder private Nachweise dürfen nicht öffentlich ausgeliefert werden.

4. Auditierbarkeit
   Das System muss beantworten können, wer eine Review verifiziert hat, wann das passiert ist und auf welcher Grundlage.

5. Trennung von Moderation und Verifikation
   Inhaltsfreigabe und Trust-Verifikation müssen unterschiedliche Zustände bleiben.

6. Runtime Enforcement
   Starke Review-Claims müssen durch Runtime-Logik gesteuert werden, nicht nur durch redaktionelle Disziplin.

7. Fail-safe Verhalten
   Fehlende oder ungültige Verifikation muss auf neutrale Review-Darstellung zurückfallen.

8. Kompatibilität mit bestehenden Daten
   Bestehende Reviews dürfen nicht automatisch als verifiziert gelten.

9. Operative Wartbarkeit
   Der Prozess muss wiederholbar sein und darf keine versteckte manuelle Konvention bleiben.

10. Aggregationsgrenze
    Diese Aufgabe definiert Review-Verifikation. Rating-Aggregation, Filter und Sortierung werden in einem eigenen Task geregelt.

## Claim-Stufen

### Mit aktuellem Datenstil grundsätzlich erlaubbar

- `Reviews`
- `Patient feedback`
- `Approved reviews`
- neutrale Sterne- oder Review-Anzeige, wenn klar nicht als verifiziert behauptet

### Nur nach Evidenzprozess plus technischem Gating erlaubbar

- `Verified reviews`
- `Reviewed patient feedback`
- `Checked patient reviews`
- Review-Claims, die Patientenkontakt oder Prüfung implizieren

## Mindeststandard für stärkere Review-Claims

Jede verifizierte Review sollte mindestens haben:

- Moderationsstatus
- Verifikationsstatus
- Quellentyp
- interne Evidenzreferenz
- Verifikationszeitpunkt
- verantwortliche prüfende Person oder Rolle
- abgeleitete Public-Eligibility für stärkere Review-Claims

Ohne diesen Mindeststandard sollten Review-Claims neutral bleiben.

## Vorgeschlagene technische Richtung

Der naheliegende Ort ist `reviews` oder ein separater Review-Evidence-Record, wenn Nachweise aus Datenschutz- oder Lifecycle-Gründen nicht direkt an der Review gespeichert werden sollen.

### Implementierungs-Feldtabelle: `reviews` oder Review-Evidence-Record

| Schema-Feld                | Wofür ist es da?                                                             | Warum braucht man es?                                                                                  | Warum ggf. nicht oder nur optional?                                                                        |
| -------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `reviewModerationStatus`   | Trennt Inhaltsmoderation von Trust-Verifikation.                             | Eine Review kann moderiert, aber nicht verifiziert sein. Beide Zustände dürfen nicht vermischt werden. | Falls bereits ein Moderationsfeld existiert, muss es nicht neu angelegt, aber klar weiterverwendet werden. |
| `reviewVerificationStatus` | Status, ob die Review als verifiziert gelten darf.                           | Öffentliche `Verified review` Claims müssen an diesen Status gebunden sein.                            | Nicht nötig, wenn findmydoc bewusst nur unverified Reviews mit neutraler Sprache zeigt.                    |
| `reviewSourceType`         | Beschreibt, woher die Review stammt oder wie sie eingegangen ist.            | Hilft zu prüfen, ob die Review mit einem echten Patientenkontakt verknüpft werden kann.                | Bei Datenschutzgrenzen kann der Quellentyp grob bleiben.                                                   |
| `reviewEvidenceReference`  | Interne Referenz auf Nachweis oder Patientenkontakt.                         | Macht die Verifikation auditierbar.                                                                    | Kann nur eine interne ID sein, wenn direkte Nachweise nicht in Payload liegen sollen.                      |
| `reviewVerifiedAt`         | Zeitpunkt der Verifikation.                                                  | `verified` Claims brauchen ein Prüfdatum.                                                              | Optional, wenn `reviewVerificationStatus` nie öffentlich benutzt wird.                                     |
| `reviewVerifiedBy`         | Prüfer oder prüfende Rolle.                                                  | Verhindert nicht nachvollziehbare manuelle Freigaben.                                                  | Eine Rolle kann reichen, wenn keine personenbezogene Reviewer-Historie gewünscht ist.                      |
| `publicReviewClaimTier`    | Abgeleitete öffentliche Review-Claim-Stufe, z. B. `neutral` oder `verified`. | Das Frontend soll nicht selbst aus Moderations- und Evidenzfeldern interpretieren.                     | Kann virtuell bleiben, wenn eine zentrale Eligibility-Funktion genutzt wird.                               |

### Abgeleitetes Eligibility-Modell

UI-Komponenten sollten nicht selbst aus einzelnen Evidenzfeldern ableiten, wie stark ein Review-Claim sein darf. Dafür sollte es eine serverseitige Eligibility-Funktion geben, zum Beispiel:

- `isReviewVerified(review)`
- `getPublicReviewClaimTier(review)`

Vorgeschlagenes Verhalten:

- `hidden`
  Review ist nicht öffentlich freigegeben.
- `neutral`
  Review ist moderiert und darf neutral angezeigt werden.
- `verified`
  Review ist moderiert, verifiziert und hat eine nachvollziehbare Evidenzreferenz.

## Route-Level Runtime-Gating

Alle öffentlichen Review-Flächen müssen Review-Eligibility prüfen, bevor Claims wie `verified` gerendert werden.

Vorgeschlagener Ansatz:

- Default ist neutrale Review-Darstellung.
- `verified` wird nur gerendert, wenn `getPublicReviewClaimTier` diese Stufe erlaubt.
- Rating-Aggregation nutzt Review-Eligibility nur als Input und wird im Rating-Dokument separat geregelt.

## Admin- und Workflow-Anforderungen

Wenn der Prozess real sein soll, muss die Admin UI ihn unterstützen. Versteckte manuelle Konventionen reichen nicht.

Vorgeschlagene Workflow-Unterstützung:

- getrennte Admin-Hinweise für Moderation und Verifikation
- klare Beschreibung, welche Quelle als Review-Evidenz zählt
- Filter für nicht verifizierte, verifizierte und unklare Reviews
- keine automatische Verifikation bei Legacy-Reviews

## Migration und Rollout

Vorgeschlagener Ablauf:

1. Neutrale Review-Anzeige beibehalten.
2. Schema-Felder und internen Workflow hinzufügen.
3. Nur Reviews backfillen, die echte Evidenz haben.
4. Runtime-Gating für stärkere Review-Claims hinzufügen.
5. Erst danach öffentliche `verified` Review-Copy aktivieren.

Wichtige Regel:

- Keine Migration darf bestehende Reviews automatisch als verified markieren, wenn dafür keine echte Evidenz existiert.

## Akzeptanzkriterien

- Moderation und Verifikation sind fachlich und technisch getrennt.
- Das Dokument definiert, wann stärkere Review-Claims erlaubt sind.
- Fail-safe Verhalten für fehlende oder unvollständige Evidenz ist definiert.
- Jede vorgeschlagene Feldrolle erklärt Zweck, Nutzen und mögliche Gründe gegen das Feld.
- Rating-Aggregation ist bewusst ausgelagert.

## Out of Scope

- Finale Copy-Freigabe.
- Legal Sign-off.
- Sofortige Implementierung der Review-Verifikation.
- Rating-Sortierung, Rating-Filter und Rating-Aggregation.
- Demo-Seed Cleanup oder Storybook-only Content.
