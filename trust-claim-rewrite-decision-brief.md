# Trust-Claim Rewrite Decision Brief

## Zweck

Dieses Dokument bündelt die öffentlichen oder potenziell öffentlichen Copy-Stellen, bei denen noch ein Rewrite oder eine bewusste Freigabe geprüft werden muss.

Es ist kein Implementierungsplan und ersetzt keine Legal-Freigabe. Ziel ist, die offenen Rewrite-Entscheidungen gesammelt an Product, Content, Legal oder Founder-Review weitergeben zu können.

## Entscheidungsoptionen

Für jede Stelle sollte eine Entscheidung in genau eine Richtung fallen:

- `Rewrite neutral`: Die Aussage wird in neutrale Vergleichs-, Profil-, Kontakt- oder Sichtbarkeitscopy umgeschrieben.
- `Keep with evidence`: Die Aussage bleibt nur, wenn ein dokumentierter Prozess, eine Quelle und ein verantwortlicher Check existieren.
- `Hide or preview-only`: Die Stelle wird nicht öffentlich ausgespielt oder bleibt explizit nicht-produktiv.
- `Move to UI Copy process`: Die Stelle ist keine CMS-/Landingpage-Entscheidung, sondern muss über den späteren UI-Copy-Prozess geändert werden.

## Offene Rewrite-Entscheidungen

| ID  | Bereich                                 | Aktuelle Stelle                                                                                                            | Risiko                                                                                                                 | Entscheidung nötig                                                                                                    | Empfehlung                                                                                                         |
| --- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Y1  | Landing- und Partner-Landing-Copy       | `src/endpoints/seed/data/baseline/globals.json` unter `landingPages`, besonders Home und `clinicPartners`                  | Begriffe wie `trusted`, `verified clinics`, `trust signals`, `verified profiles`, `verified qualifications`            | Satzweise entscheiden, ob es eine belegte Quelle gibt oder die Copy neutraler werden muss.                            | Ohne belastbare Evidenz neutral umschreiben; keine Trust-, Verified- oder Quality-Begriffe als Standard lassen.    |
| Y2  | Verification- und Quality-Check-Copy    | `landingPages.home.process.steps.2`, `landingPages.clinicPartners.process.steps.2`                                         | `Verification & Quality Check`, `certifications`, `credibility`, `high-quality environment` wirken prozessual geprüft. | Entscheiden, ob ein echter findmydoc Prüfprozess beschrieben werden kann.                                             | Wenn kein dokumentierter Prozess existiert: als Profil-/Onboarding-Prüfung formulieren, nicht als Quality Check.   |
| Y3  | Akkreditierungs-Copy                    | `src/endpoints/seed/data/baseline/accreditations.json`, besonders `International Health Standard` und Safety-/Quality-Text | Akkreditierung, Safety und Quality wirken wie externe oder geprüfte Zertifizierung.                                    | Nicht als reiner Rewrite behandeln: entweder echte Evidenz und Proof-Metadaten definieren oder öffentlich ausblenden. | Bis Evidenzmodell implementiert ist, nicht als öffentlicher Trust Claim verwenden.                                 |
| Y4  | Temporary Landing Mode                  | `src/features/temporaryLandingMode/content.ts`                                                                             | Enthält Patient Reviews, Quality Indicators, Verified Comparison, Trusted Comparison und Quality Signals.              | Entscheidung liegt vor: Der Modus bleibt vorerst tmp-/preview-only; die Texte wurden bereits geprüft und kuratiert.   | Jetzt kein Rewrite. Neu bewerten, falls der Modus später produktiv öffentlich wird.                                |
| Y5  | Listing-Comparison Pricing Copy         | `src/app/(frontend)/listing-comparison/page.tsx`                                                                           | `Transparent pricing for medical treatments near you` und `Reviewed prices` brauchen Quelle, Datum und Review-Prozess. | Entscheiden, ob kurzfristig neutral umgeschrieben wird oder zuerst der Pricing-Evidence-Prozess implementiert wird.   | Kurzfristig neutral umschreiben; stärkere Claims erst nach Pricing-Evidence-Prozess.                               |
| Y6  | Clinic Registration Verified Visibility | `landingPages.clinicPartners.registrationIntro.title`                                                                      | `Ready for verified visibility?` kann als findmydoc Verifikation verstanden werden.                                    | Copy finalisieren, obwohl die CMS-Editierbarkeit technisch bereits gelöst ist.                                        | Neutraler Richtungsvorschlag: strukturierte Sichtbarkeit, Profilpräsenz oder Partner-Sichtbarkeit ohne `verified`. |

## Konkrete Review-Hinweise je Bereich

### Y1. Landing- und Partner-Landing-Copy

Aktueller Stand:

- Die Landing-Copy kommt aus dem `landingPages` Global und ist damit als Content-Quelle kontrollierbar.
- Die technische Editierbarkeit ist nicht das Problem.
- Offen ist, ob die Begriffe fachlich belegt sind oder neutraler formuliert werden müssen.

Prüffrage:

- Können wir für jeden Trust-Begriff eine Quelle, einen Prozess und eine verantwortliche Prüfung benennen?

Wenn nein:

- `trusted comparison platform` eher zu `structured comparison platform`.
- `verified clinics` eher zu `clinic profiles` oder `listed clinics`.
- `trust signals` eher zu `profile information`, `comparison details` oder `decision-relevant information`.
- `verified qualifications` eher zu `clinic-provided qualifications` oder `listed qualifications`, sofern diese nicht geprüft sind.

### Y2. Verification und Quality Check

Aktueller Stand:

- Der Text beschreibt eine Prüfung, die nach außen wie ein findmydoc Qualitätsprozess wirkt.
- Diese Aussage ist stärker als reine Profilstruktur oder Onboarding.

Prüffrage:

- Gibt es einen dokumentierten Prozess, der sagt, was geprüft wird, wer prüft, welche Nachweise zählen und wann die Prüfung abläuft?

Wenn nein:

- Nicht `Verification & Quality Check` verwenden.
- Richtung: `Profile Review`, `Profile Setup`, `Profile Completeness Review` oder `Information Review`.
- Keine Aussage, dass findmydoc medizinische Qualität, Zertifizierungen oder Eignung bestätigt.

### Y3. Akkreditierungen

Aktueller Stand:

- Das vorhandene Accreditation-Modell ist öffentlich lesbar.
- Die baseline Akkreditierung enthält `International Health Standard` und `patient safety and quality`.
- Ein reiner Wortlaut-Rewrite reicht hier wahrscheinlich nicht, wenn Akkreditierungen öffentlich als Trust Signal erscheinen.

Prüffrage:

- Ist die Akkreditierung echt, extern belegbar, gültig und mit Scope dokumentiert?

Wenn nein:

- Nicht öffentlich als Akkreditierungsclaim verwenden.
- Entweder verstecken oder erst das Accreditation-Evidence-Modell aus `trust-claim-accreditation-evidence-requirements-task.md` umsetzen.

### Y4. Temporary Landing Mode

Aktueller Stand:

- Der Modus bleibt fürs Erste tmp-/preview-only.
- Die Texte wurden bereits vor diesem Guardrail-Lauf geprüft und kuratiert.
- Die Sprache enthält weiterhin Trust-nahe Begriffe, ist aber aktuell nicht als produktive öffentliche Landing-Copy freigegeben.

Prüffrage:

- Wird diese Seite später produktiv öffentlich?

Aktuelle Entscheidung:

- Kein aktueller Rewrite-Task.
- Keine aktuelle CMS-Anbindung nur für Y4.
- Bei späterer produktiver Veröffentlichung neu prüfen, ob Wording, CMS-Verantwortung und Trust-Claim-Evidenz ausreichen.

Fallback bei späterer produktiver Veröffentlichung:

- Patient Reviews, Quality Indicators, Verified Comparison, Trusted Comparison und Quality Signals neutralisieren oder mit belastbarer Evidenz hinterlegen.
- Richtung: strukturierte Klinikprofile, Vergleichslogik, Kontaktmöglichkeit und Launch-Hinweis.

### Y5. Pricing Copy

Aktueller Stand:

- Die öffentliche Listing-Comparison Route zeigt echte Preisfelder und Preisanzahl.
- Die Copy `Transparent pricing` und `Reviewed prices` behauptet aber mehr als reine Preisanzeige.
- Das separate Prozessdokument beschreibt, welcher Pricing-Evidence-Prozess für stärkere Claims nötig wäre.

Prüffrage:

- Gibt es pro Preis Quelle, Erfassungsdatum, Review-Status, Review-Datum und verantwortliche Prüfung?

Wenn nein:

- Kurzfristig neutral umschreiben.
- Richtung: `Compare clinic prices`, `Listed starting prices`, `Price information where available`, `Price fields where available`.
- Stärkere Begriffe wie `reviewed`, `verified`, `checked` oder `transparent` erst nach Prozessimplementierung.

### Y6. Clinic Registration Verified Visibility

Aktueller Stand:

- Die Copy ist über `landingPages.clinicPartners.registrationIntro` editierbar.
- Die technische Grundlage ist gelöst.
- Der aktuelle Wortlaut ist noch nicht final safe.

Prüffrage:

- Bedeutet `verified visibility`, dass die Klinik nach einem dokumentierten Prozess geprüft wurde?

Wenn nein:

- `verified` entfernen.
- Richtung: `Ready for structured visibility?`, `Ready to build your clinic profile?`, `Ready for partner visibility?` oder `Ready to present your clinic?`

## Nicht in diesem Rewrite-Brief enthalten

Diese Themen sind keine reinen Rewrite-Entscheidungen und bleiben in eigenen Prozess- oder Implementierungsdokumenten:

- Before/After Case Gallery: `trust-claim-gallery-evidence-requirements-task.md`
- Public Reviews: `trust-claim-review-evidence-requirements-task.md`
- Rating Eligibility: `trust-claim-rating-eligibility-requirements-task.md`
- Verification Badges: `trust-claim-verification-badge-requirements-task.md`
- Pricing Evidence Prozess: `pricing-evidence-requirements-task.md`
- Zentrales Cache-/Migrations-Thema: `findmydoc-platform/website#1361`

## Übergabeempfehlung

Für den Review sollte die Entscheidung nicht lauten, ob die Formulierungen schöner sind, sondern ob sie belegbar sind.

Empfohlener Review-Ausgang:

- Y1: Satzweise neutralisieren, außer ein Claim ist eindeutig belegbar.
- Y2: Neutralisieren, solange kein Verification-/Quality-Prozess implementiert ist.
- Y3: Nicht als Copy-only lösen; Evidenz oder Ausblendung entscheiden.
- Y4: Aktuell kein Rewrite; tmp-/preview-only, bereits geprüft und kuratiert. Bei produktiver Veröffentlichung neu prüfen.
- Y5: Kurzfristig neutralisieren; stärkere Preisclaims später prozessgebunden.
- Y6: `verified` entfernen, solange keine verifizierte Sichtbarkeit definiert ist.
