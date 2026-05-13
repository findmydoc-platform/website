## FindMyDoc Pitchdeck – Grafik & Design Guidelines

Diese Repo-Struktur ist ein React/Vite-basiertes Pitchdeck (Slides als React-Komponenten in `src/app/App.tsx`).

### Grafik-Style (was hier im Deck bereits umgesetzt ist)
- **Primärfarben:** Blau `#0076FF`, Mint `#42E2B7`
- **Headline/Text-Farbe:** Dunkelviolett `#07004C` (Headlines), neutrales Grau für Fließtext
- **Gradients:** häufig `from-[#42E2B7] to-[#0076FF]` (oder umgekehrt) auf runden Flächen (z. B. Icon-Circles)
- **Icons:** `lucide-react` (konsistente Strich-Icons; Größen meist 32/48/56/64)
- **Formen:** runde/abgerundete Geometrie (z. B. `rounded-2xl`, große „Badge“-Kreise)
- **Flächen:** viel Weißraum, klare Container, dezente Borders (`border-gray-200`) statt starke Schatten
- **Charts/Visuals:** bevorzugt einfache, klare Darstellung (Farbgebung über Primärfarben/Akzente; keine „bunten“ Fremdpaletten)

### Bild-/Asset-Regeln
- Assets liegen unter `src/imports/` (z. B. Logo).
- Bevorzugt **PNG/SVG**; keine eingebetteten Screenshots mit harter Kompression.
- Wenn neue Grafiken nötig sind: erst als SVG (flat, editierbar), nur wenn zwingend als PNG exportieren.

### Typografie / Layout
- Slides sind für **16:9** gedacht; halte Layouts „safe“ in der Mitte, großzügige Ränder.
- Typo/Token-Basis liegt in `src/styles/theme.css` (CSS-Variablen) und Tailwind Utility-Classes.

---

<!--

System Guidelines

Use this file to provide the AI with rules and guidelines you want it to follow.
This template outlines a few examples of things you can add. You can add your own sections and format it to suit your needs

TIP: More context isn't always better. It can confuse the LLM. Try and add the most important rules you need

# General guidelines

Any general rules you want the AI to follow.
For example:

* Only use absolute positioning when necessary. Opt for responsive and well structured layouts that use flexbox and grid by default
* Refactor code as you go to keep code clean
* Keep file sizes small and put helper functions and components in their own files.

--------------

# Design system guidelines
Rules for how the AI should make generations look like your company's design system

Additionally, if you select a design system to use in the prompt box, you can reference
your design system's components, tokens, variables and components.
For example:

* Use a base font-size of 14px
* Date formats should always be in the format “Jun 10”
* The bottom toolbar should only ever have a maximum of 4 items
* Never use the floating action button with the bottom toolbar
* Chips should always come in sets of 3 or more
* Don't use a dropdown if there are 2 or fewer options

You can also create sub sections and add more specific details
For example:


## Button
The Button component is a fundamental interactive element in our design system, designed to trigger actions or navigate
users through the application. It provides visual feedback and clear affordances to enhance user experience.

### Usage
Buttons should be used for important actions that users need to take, such as form submissions, confirming choices,
or initiating processes. They communicate interactivity and should have clear, action-oriented labels.

### Variants
* Primary Button
  * Purpose : Used for the main action in a section or page
  * Visual Style : Bold, filled with the primary brand color
  * Usage : One primary button per section to guide users toward the most important action
* Secondary Button
  * Purpose : Used for alternative or supporting actions
  * Visual Style : Outlined with the primary color, transparent background
  * Usage : Can appear alongside a primary button for less important actions
* Tertiary Button
  * Purpose : Used for the least important actions
  * Visual Style : Text-only with no border, using primary color
  * Usage : For actions that should be available but not emphasized
-->
