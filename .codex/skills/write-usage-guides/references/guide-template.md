# Guide Template

Use this template for guides created by this skill.

```md
# <German title>

## Ziel

<One short paragraph that states the outcome.>

## Voraussetzungen

- <Role, login, or environment requirement>
- <Required data or access, only if needed>

## Schritt-für-Schritt-Anleitung

1. <Action>

   ![<Short alt text>](./images/01-example.png)

2. <Action>

3. <Action>

   ![<Short alt text>](./images/03-example.png)

## Prüfergebnis

<One short paragraph describing how the user can confirm success.>

## Häufige Probleme

<Only include this section when a real issue was observed during reproduction.>
```

## Rules

- Keep the final guide in German unless the user requests another language.
- Use relative image paths such as `./images/01-login-page.png`.
- Use images only where they improve orientation or reduce ambiguity.
- Keep alt text short and functional.
- If the flow was not reproduced end to end, state the verified range briefly in `Voraussetzungen` or `Häufige Probleme`.
- Add `Weiterführende Guides` only when matching guides already exist in `docs/guides/` and genuinely help the reader continue.
- Use `Weiterführende Guides` only for a real next step, prerequisite flow, or closely related branch.
- Omit `Häufige Probleme` when nothing concrete was observed.
- Do not add sections beyond this template unless the task clearly needs them.
- Do not leave placeholder text in the final file.
