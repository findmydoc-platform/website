# Index: atomare Aufgaben für Trust-Claim Evidenzprozesse

## Problem

findmydoc trennt öffentliche Textflächen inzwischen in CMS Content, Product UI Copy und Admin UI Labels. Damit ist geklärt, wo Texte gepflegt werden sollen. Das löst aber noch nicht, ob stärkere Trust Claims öffentlich angezeigt werden dürfen.

Einige öffentliche Flächen brauchen dafür einen belastbaren Prozess, ein Datenmodell und Runtime-Gating. Ohne diese Grundlage können Begriffe wie `verified`, `reviewed`, `checked`, `accredited` oder vergleichbare Vertrauenssignale mehr versprechen, als die aktuelle Implementierung beweisen kann.

Dieses Dokument ist bewusst nur noch ein Index. Die eigentlichen Aufgaben liegen atomar in einzelnen Dokumenten, damit sie unabhängig priorisiert, geplant und umgesetzt werden können.

## Aktuelle CMS-Entscheidung

Der aktuelle technische Durchlauf hat genau einen sicheren CMS-Kandidaten im aktiven Landing-Scope gefunden:

- `/partners/clinics` Team-CTA: Der sichtbare `About us` CTA gehört zur Partner-Landingpage, weil er eine redaktionelle Landingpage-/Conversion-Steuerung ist und keine wiederverwendbare Product UI Copy.
- Umgesetztes Ziel: `landingPages.clinicPartners.teamCta`.

Alle anderen bisher geprüften hardcoded Trust-nahen Texte werden nicht automatisch ins CMS verschoben:

- Listing-Comparison Hero-/Trust-Texte sind Product UI Copy Kandidaten, weil die Seite stark datengetrieben ist und die Texte kurz und produktnah sind.
- Clinic-Detail Labels, Filter, Sortierungen, Buttons, Empty States und ARIA Labels sind Product UI Copy Kandidaten.
- Temporary-Landing-Copy braucht zuerst eine Produktentscheidung. Wenn der Modus als echte öffentliche Landingpage bleibt, sollten Hero, SEO, Narrative und Signal-Copy ins CMS. Wenn er temporär oder preview-only bleibt, ist keine CMS-Arbeit nötig.

## Zielzustand

Jede Trust-nahe Fläche soll in genau einen Zustand fallen:

- CMS editierbar, wenn es nur um redaktionelle Kontrolle geht.
- Product UI Copy, wenn der Text kurz, funktional, routennah oder komponentenbezogen ist.
- Evidenzprozess erforderlich, wenn die öffentliche Aussage von Prüfung, Nachweis, Aktualität oder verantwortlicher Bestätigung abhängt.
- Bestehender Trust-Core Prozess zu implementieren, speziell bei Verification Badges.

## Atomare Aufgaben

| Aufgabe                   | Dokument                                                  | Zweck                                                                                      |
| ------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Before/After Case Gallery | `trust-claim-gallery-evidence-requirements-task.md`       | Prozess, Consent, Evidence und Runtime-Gating für öffentliche Before-/After-Fälle.         |
| Public Reviews            | `trust-claim-review-evidence-requirements-task.md`        | Prozess und Datenmodell dafür, wann Reviews als geprüft oder verifiziert gelten dürfen.    |
| Rating Eligibility        | `trust-claim-rating-eligibility-requirements-task.md`     | Aggregation, Filter und Sortierung auf Basis berechtigter Review-/Rating-Daten.            |
| Accreditations            | `trust-claim-accreditation-evidence-requirements-task.md` | Nachweise, Scope und Gültigkeit für öffentlich ausgespielte Akkreditierungen.              |
| Verification Badges       | `trust-claim-verification-badge-requirements-task.md`     | Implementierungsstory für den vorhandenen, aber noch nicht umgesetzten Trust-Core Prozess. |
| Pricing Claims            | `pricing-evidence-requirements-task.md`                   | Separater Pricing-Prozess für Quelle, Review-Status, Aktualität und Claim-Berechtigung.    |

## Gemeinsame Regeln für alle atomaren Aufgaben

- Keine Aufgabe schreibt finale öffentliche Copy vor.
- Jede Aufgabe muss neutrale Anzeige von stärkeren Claims trennen.
- Jede Aufgabe braucht eine klare Runtime-Eligibility, nicht nur redaktionelle Disziplin.
- Jede Aufgabe muss erklären, welche Schema-Felder wofür da sind, warum sie gebraucht werden und wann man sie ggf. nicht braucht.
- Legacy-Daten dürfen nicht automatisch als geprüft, reviewed, verified oder accredited markiert werden, wenn dafür keine echte Evidenz existiert.
- Fehlende, ungültige oder abgelaufene Evidenz muss auf neutrale Darstellung zurückfallen oder die betreffende Trust-Fläche ausblenden.

## Akzeptanzkriterien

- CMS-only Arbeit ist klar von prozessabhängiger Trust-Arbeit getrennt.
- Product UI Copy Kandidaten sind für den späteren UI-Copy-/Export-Prozess geparkt.
- Jedes prozessabhängige Item hat ein eigenes, atomar bearbeitbares Task-Dokument.
- Verification Badges sind als Implementierungslücke des vorhandenen Trust-Core Konzepts dokumentiert, nicht als fehlende Prozessdefinition.
- Das Index-Dokument enthält keine große Sammel-Feldtabelle mehr.

## Out of Scope

- Finale Copy-Freigabe.
- Legal Sign-off.
- Product UI Copy Extraction.
- Admin Label Lokalisierung.
- Demo-Seed Cleanup.
- Storybook-only Content Cleanup.
- Entfernen oder Umschreiben öffentlicher Inhalte in diesem Task.
