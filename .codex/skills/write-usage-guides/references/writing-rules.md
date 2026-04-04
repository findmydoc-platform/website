# German Operator Guide Writing Rules

## Purpose

Use these rules when writing a guide for someone who needs to complete a task in the UI, not understand the codebase.

## Tone

- Write in German by default.
- Be calm, direct, and operational.
- Address the reader with `du` by default.
- Prefer plain wording over technical vocabulary.
- Avoid filler, hype, or teaching the product architecture.

## Audience

Default audience: internal operators or editorial staff.

Assume the reader:

- knows the business context
- can use a browser
- does not need source-code explanations

Do not assume the reader:

- understands Payload terminology
- knows collection slugs, hooks, access rules, or routes
- can infer missing steps

## Step Style

- Use numbered steps for the main flow.
- Each step should contain one user action or one coherent form segment.
- Name buttons, tabs, links, and fields exactly as they appear in the UI.
- Tell the reader what they should see after the action when it helps orientation.
- Keep steps short. Split long instructions instead of nesting details.

Good:

`1. Klicke links im Menü auf "Clinics".`

Better:

`2. Klicke oben rechts auf "Create new".`

`3. Trage im Feld "Name" den Kliniknamen ein.`

Avoid:

- multi-action paragraphs
- internal implementation explanations
- vague phrasing such as "configure the entity"

## Technical Depth

Exclude by default:

- code references
- API names
- schema details
- component names
- hooks, migrations, and internal data flow

Only mention technical context when it changes what the operator must do, for example:

- a guide requires a specific role
- a workflow only works in a seeded dev environment
- the UI currently behaves differently than expected

## Screenshots

- Use screenshots to confirm orientation and field placement.
- Prefer screenshots that match the exact step text.
- Skip screenshots that do not change the user's understanding.
- If the state is obvious from the text alone, omit the screenshot.
- Dismiss cookie banners or overlays before capturing, unless they are part of the task being explained.

## Verification Language

End with a short verification statement that tells the reader how to confirm success.

Examples:

- `Die Klinik erscheint jetzt in der Übersicht.`
- `Du bist jetzt im Admin-Dashboard eingeloggt.`
- `Der neue Eintrag ist gespeichert und kann bearbeitet werden.`

## Verified vs. Inferred

When the full flow could not be completed in the browser, say so briefly and concretely.

Good:

- `Getestet bis zum Admin-Login.`
- `Die Schritte nach dem Login folgen der aktuellen CMS-Struktur und konnten hier nicht vollständig im Browser geprüft werden.`

Avoid:

- long explanations about internal blockers
- vague wording such as `vermutlich` or `sollte`
- presenting inferred later steps as fully verified

## Related Guides

Add a `Weiterführende Guides` section only when there are real neighboring guides in `docs/guides/`.

Use it for:

- the next logical step after the current guide
- a prerequisite flow documented elsewhere
- a closely related branch the reader may need next

Do not use it:

- as a placeholder
- with guessed links
- to repeat the current guide in different words

## Common Problems

Only add a `Häufige Probleme` section if the problem was actually observed while reproducing the flow. Keep it short and action-oriented.
