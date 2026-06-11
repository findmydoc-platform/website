# Patient Favorites Roadmap

This roadmap is a concept archive for redesigned patient favorites. Each proposal is self-contained in its own folder with mobile, tablet, and desktop mockups, a user journey, data-model impact, component mapping, and review-ready acceptance criteria.

## Implementation Gate

Nothing in these mockups is decorative by default. Every visible label, button, metric, badge, chip, icon, group, tab, status, and suggested action must serve patient trust, decision transparency, or clear next-step guidance.

Before implementation, each UI element must have all of the following documented:

- Patient value
- Trust or transparency purpose
- Data source
- Component ownership
- Allowed behavior

Anything not documented in the selected scenario README is out of implementation scope.

## Shared Product Rules

- A patient can favorite more than three clinics.
- A patient can compare at most three clinics at a time.
- The UI must make the difference between `saved` and `selected for comparison` explicit.
- Recommendations must be explainable from visible, source-backed reasons.
- Missing or stale facts must be shown honestly or omitted; they must not be replaced with reassuring filler.
- Visual emphasis must follow patient value: primary actions help the patient inspect, compare, or contact a clinic; destructive or management actions stay quiet.
- Mockup account navigation is context only unless an existing route or separately documented route is available.
- Icon-only controls must have an accessible name and a documented action. If the action is not documented, the control must not be rendered.

## Current Implementation Facts

- `/patient/favorites` renders a private patient route with the heading `Saved clinics`, a saved count, a `Browse clinics` link, and `FavoriteClinicsList`.
- `FavoriteClinicsList` currently renders saved clinic cards with image, clinic name, verification badge, location, optional average rating, `Details`, and `Remove`.
- `FavoriteClinicButton` currently creates and deletes `favoriteclinics` records and can render a list variant.
- `favoriteclinics` stores the current saved relationship: `patient`, `clinic`, timestamps, stable ID, and a unique `patient + clinic` index.
- `clinics` exposes patient-facing facts used by the current UI: name, slug, thumbnail, address, average rating, verification, supported languages, tags, and accreditations.
- `clinictreatments` stores clinic-treatment prices and can support visible price signals when scoped correctly.
- `reviews` stores review data and drives average ratings, but review count display must use approved reviews only.
- There is no dedicated patient-clinic inquiry/contact collection in the current implementation. Any `Contacted`, `Ready to contact`, `Contact clinic`, or `Fast response` UI state needs a source-backed collection or must stay out of implementation scope.
- There is no shared patient account dashboard shell yet. Desktop and tablet sidebars in the concepts imply a new shared account layout, not existing reusable code.

## Scenario Index

- [Decision Shortlist](./decision-shortlist/README.md): saved clinics as a patient decision shortlist.
- [Compare Board](./compare-board/README.md): saved clinics as a transparent max-three comparison workspace.
- [Clinic Plan](./clinic-plan/README.md): saved clinics as a guided patient journey with explainable next actions.

## Product Recommendation

The first implementation should combine `Decision Shortlist` with the source-backed comparison subset:

- Start with a trust-first saved clinic list because it fits the current `favoriteclinics` model.
- Add comparison slots with a strict max of three.
- Add source-backed trust signals only when their source exists.
- Delay `Recommended`, `Contacted`, `Ready to contact`, `Contact clinic`, and `Fast response` until supporting patient-clinic inquiry or interaction data exists.

## Review Flow

Before implementation, select exactly one scenario folder and treat its visible UI contract as the implementation boundary. After implementation, run the specialist reviewers named in that scenario README.
