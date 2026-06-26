# Aufgabe: Trust-Kern für Verification Badges aufarbeiten

## Problem

Für Verification Badges gibt es bereits ein Trust-Kern-Konzept. Dieses Konzept reicht aber noch nicht als direkte Implementierungsgrundlage, solange nicht eindeutig geklärt ist, welche Status, Tiers, Nachweise, Rollen und Ablaufregeln technisch maßgeblich sind.

Ohne diese Aufarbeitung besteht das Risiko, dass öffentliche Badges aus manuellen Tiers, Demo-Werten oder UI-Copy entstehen, statt aus einem nachvollziehbaren findmydoc Prüfprozess.

## Ziel

Der bestehende Trust-Kern soll in eine kurze, implementierbare Entscheidungsgrundlage übersetzt werden. Danach kann die eigentliche Verification-Badge-Implementierung sauber geplant werden.

## Anforderungen

1. Trust-Kern nicht neu erfinden
   Die Aufgabe soll vorhandene Entscheidungen konsolidieren, Lücken markieren und keine konkurrierende Badge-Logik erzeugen.

2. Begriffe trennen
   `clinic exists`, `profile complete`, `verified clinic`, `quality checked`, `accredited` und Badge-Tiers müssen getrennt definiert werden.

3. Public Eligibility definieren
   Es muss klar sein, wann eine Klinik öffentlich ein Badge zeigen darf und wann nicht.

4. Evidenzregeln festlegen
   Für jeden öffentlichen Badge-Status muss klar sein, welcher Nachweis oder Check erforderlich ist.

5. Ablauf und Re-Check klären
   Der Trust-Kern muss sagen, ob Prüfungen ablaufen, wann sie erneuert werden und was bei abgelaufener Evidenz passiert.

6. Verantwortlichkeit klären
   Es muss klar sein, welche Rolle eine Prüfung freigibt und wer spätere Änderungen verantwortet.

## Ergebnisdokument

Das Ergebnis sollte mindestens enthalten:

- erlaubte interne Trust-Kern Status
- erlaubte öffentliche Badge-Status oder Tiers
- Mapping von internem Status zu öffentlicher Anzeige
- erforderliche Evidenz pro Status
- Verantwortlichkeit und Review-Datum
- Ablauf-/Re-Check-Regel
- Verhalten bei fehlender oder abgelaufener Evidenz
- Regel für Bestandsdaten und Demo-Daten

## Technische Anschlussfähigkeit

Nach dieser Aufgabe muss die Implementierungsstory für `trust-claim-verification-badge-requirements-task.md` ohne fachliche Lücke ausführbar sein.

Die technische Implementierung sollte danach ableiten können:

- welche Schema-Felder wirklich gebraucht werden
- ob `verificationTier` gespeichert oder berechnet wird
- wie `publicBadgeEligible` entsteht
- welche Admin-Ansicht fehlt
- welche bestehenden Badge-Flächen bis dahin ausgeblendet oder neutralisiert werden müssen

## Akzeptanzkriterien

- Der Trust-Kern ist für Engineering eindeutig genug, um Status, Tiers und Eligibility zu implementieren.
- Ungeklärte Begriffe sind sichtbar markiert und nicht implizit als gelöst behandelt.
- Öffentliche Verification Badges bleiben blockiert, solange die Trust-Kern-Regeln nicht technisch implementiert sind.
- Bestehende oder Demo-Daten werden nicht automatisch als verified übernommen.

## Out of Scope

- Sofortige Badge-Implementierung.
- Finale Legal-Freigabe.
- Neue Marketing-Copy.
- Migration oder Backfill von Klinikdaten.
