# Simple Epic Overview (Author: MehmetVolkan)

Purpose: lightweight list to discuss scope; only note (a) what is or should be handled in PayloadCMS vs (b) UI work present / missing. No deep analysis.

## Research Methodology for Linking PRs to Epics
For each epic below we identify the Pull Requests (PRs) that contributed materially to its backend or UI implementation using these steps:
1. Enumerate all PRs merged into `main` (historic + recent) via the repository PR list.
2. Scan commit messages for domain keywords (e.g., "clinic", "treatment", "review", "auth", "permission", "seed", "block") and issue-style verbs (feat/fix/chore) to shortlist candidates.
3. Cross-reference shortlisted PRs with collection / hook responsibilities (e.g., pricing -> `clinicTreatments`, reviews -> `reviews` collection, admin ergonomics -> form/layout refactors).
4. Attribute each epic only to PRs that either:
	- Added or modified schema / hooks powering that capability, or
	- Added seeding / baseline content essential for UI, or
	- Adjusted access control / permission layers required for the feature to function, or
	- Delivered UI building blocks (blocks/components) used directly by the epic.
5. Exclude pure dependency bumps / unrelated CI changes unless they directly unlocked a blocked type or build issue for the feature.

Each epic section now contains an "Implementation Trace" list (PR number, concise description, merge date, and rationale). Missing elements (gaps) are explicitly noted to highlight remaining work. Process batches are limited to 3 issues per update to keep context focused, per instruction.

Legend:
- Backend Status: done | partial | missing | n/a
- UI Status: done | partial | missing

| Issue # | Title                                              | Backend (PayloadCMS) Focus                                              | Backend Status | UI Focus                                              | UI Status | Readiness (0-10) | Quick Notes                                            |
| ------- | -------------------------------------------------- | ----------------------------------------------------------------------- | -------------- | ----------------------------------------------------- | --------- | ---------------- | ------------------------------------------------------ |
| 146     | Registration and Login                             | Supabase auth integration, user creation flows, email verification      | done           | Auth pages (register/login/forgot pw)                 | partial   | 5                | Login/register pages exist; no social providers (Google/Facebook). |
| 147     | Clinic Registration with Admin Approval            | `clinics` collection, status workflow (pending/approved) + access rules | done           | Public clinic registration form & admin approval UI   | done      | 7                | Form exists, admin can approve via Payload UI.        |
| 148     | Clinic Profiles (Name, Location, Description)      | `clinics` fields (name, address, geo point, description)                | done           | Public clinic profile page layout + map embed         | partial   | 6                | Profile page exists, coordinates field present, no map embed yet. |
| 149     | Treatment Offerings & Price Info                   | `treatments`, `clinicTreatments` pricing fields/indexes                 | done           | Display treatment list & pricing on clinic profile    | missing   | 3                | Backend complete with price hooks; no UI treatment list. |
| 150     | Display Customer Reviews                           | `reviews` collection read (approved filter) + aggregation (future)      | done           | Reviews section on clinic page                        | missing   | 3                | Full review system with rating hooks; no UI display.   |
| 151     | Admin Panel - Manage Clinics, Reviews, Users       | Collections & access already central in Payload                         | done           | Admin UI refinements (filters, moderation ergonomics) | done      | 8                | Comprehensive admin panel with proper access controls. |
| 152     | Security Management (Spam, GDPR)                   | Rate limits / captcha integration hooks (not yet), privacy pages global | missing        | CAPTCHA widgets, privacy policy page                  | missing   | 1                | No captcha integration, no privacy pages found.        |
| 153     | Responsive Design for Mobile                       | n/a (frontend concern)                                                  | n/a            | Mobile layout, nav, cards scaling                     | partial   | 6                | Tailwind responsive base; needs targeted mobile testing. |
| 154     | Direct Comparison by Treatment Type                | Query clinics by selected treatment (index, relationships)              | done           | Comparison view (list/table)                          | missing   | 2                | Backend relationships ready; no comparison UI.         |
| 155     | Auto Display Clinic List After Treatment Selection | Treatments → clinics query                                              | done           | Auto-navigation / results page                        | missing   | 2                | Same backend as 154; no auto-navigation logic.         |
| 156     | User Profiles w/ Favorites                         | `favoriteClinics` collection + access (patient scoping)                 | done           | Profile page + favorites list + add/remove button     | missing   | 3                | Full backend with access control; no UI components.    |
| 157     | Writing Reviews & Testimonials                     | `reviews` create w/ moderation status field                             | done           | Review submission form + post-submit state            | missing   | 3                | Complete backend with validation; no submission form.  |
| 158     | Sorting Clinics (Price, Reviews, Services)         | Indexed fields / computed ratings                                       | done           | Sort controls (UI dropdown/buttons)                   | missing   | 2                | Backend has rating/price aggregation; no sort UI.      |
| 159     | Sorting & Filtering Functions                      | Filter fields (city, price range) + indexes                             | done           | Filter UI (multi-select, ranges)                      | missing   | 2                | City/price relationships exist; no filter components.  |
| 160     | Doctor Profiles (Qualifications)                   | `doctors` fields + relationships (specialties)                          | done           | Doctor profile UI (display qualifications)            | done      | 8                | Doctors displayed on clinic page with qualifications.  |
| 161     | Before-and-After Picture Gallery                   | Media strategy (clinic media / gallery relation)                        | missing        | Gallery component (slider/side-by-side)               | missing   | 1                | Blocked by media architecture (#264).                  |
| 163     | Articles on Beauty Treatments                      | `pages` / `posts` / `categories` content model                          | done           | Articles listing & detail pages                       | done      | 7                | Posts system exists with full listing/detail pages.   |
| 164     | Static Informational Pages                         | `pages` collection basic fields                                         | done           | Navigation/footer links + page template               | done      | 8                | Pages collection + dynamic routing + footer links.     |
| 165     | Tips for Choosing a Clinic                         | Content (could reuse `posts` or `pages`)                                | done           | Dedicated tips/guide page                             | missing   | 3                | Can use existing pages/posts; no dedicated guide page. |

## Change Log PR Coverage Audit

The following Pull Requests are cataloged in `docs/analyzation-prs/pr-change-log.md`. Each item notes the primary impact area and the epic(s) it supports when applicable.

- **#9** – Create GitHub Actions pipeline for build and deploy. Infrastructure baseline enabling continuous delivery; supports every epic indirectly.
- **#12** – Initial schema bootstrap. Foundational collections and migrations powering epics 147–165.
- **#13** – Initial migration alignment follow-up. Keeps base schema in sync; same foundational coverage as #12.
- **#14** – Update database configuration and add pgAdmin service to Docker Compose. Developer operations support with no direct epic mapping.
- **#21** – Template cleanup & pnpm migration. Repository hygiene; no specific epic linkage.
- **#29** – Node runtime and deployment alignment. Operational readiness with no direct feature epic.
- **#31** – Deployment workflow (CD) introduction. CI/CD infrastructure benefitting all epics indirectly.
- **#33** – Developer experience editor extensions. DX uplift; no feature epic linkage.
- **#38** – Authentication forms (login & registration UI). Directly advances Epic 146 (Registration & Login) and informs responsive work in Epic 153.
- **#40** – Clinics on home + login integration. Strengthens Epics 146 (auth surfaces), 148 (clinic profile visibility), and 153 (responsive homepage layout).
- **#41** – Dependency bump group. Dependency-only change; excluded from epic mapping.
- **#42** – VSCode extension recommendations. Developer tooling only.
- **#49** – Clinic & doctor seed data plus slug routing. Supplies data and routing foundations for Epics 147 (clinic registration), 148 (clinic profiles), and 160 (doctor profiles).
- **#52** – Admin (staff) collection & Supabase auth consolidation. Core authentication scaffolding for Epics 146 and 151 (admin management).
- **#57** – Supabase storage integration. Media storage underpinning Epics 148 (profile media) and 161 (future galleries).
- **#86** – Remove languages collection and enforce language requirements. Data integrity uplift for Epics 148 and 160.
- **#88** – Rename treatments to medical specialties. Domain alignment for Epics 149, 154, 155, 158, and 159.
- **#89** – Rename procedures to treatments. Complements #88 for the same epics.
- **#90** – Rename staff collection to platformStaff. Identity consistency for Epics 146 and 151.
- **#92** – Add countries collection. Geographic metadata supporting Epics 147, 148, and 159.
- **#93** – Adapt posts/pages/media collections to new data model. Rich content foundation for Epics 148, 163, 164, and 165.
- **#94** – Add cities collection. Location filtering substrate for Epics 147, 148, and 159.
- **#95** – Refactor clinics collection with approval workflow refinements. Directly supports Epics 147 and 148.
- **#96** – Accreditation rich text & icon updates. Enhances profile display for Epics 148 and 160.
- **#98** – Dependency-only @payloadcms/next bump. No epic linkage.
- **#99** – Tailwind v4 upgrade. Broad UI impact, notably Epics 146, 148, and responsive Epic 153.
- **#100** – Dependency-only @payloadcms/ui bump. No epic linkage.
- **#103** – Dependency updates and plugin reordering. Platform stability; indirectly assists admin-focused Epic 151.
- **#105** – Workflow permissions hardening (security alert #5). Contributes to Epic 152 (Security management).
- **#106** – Implement doctors collections. Provides primary backend for Epic 160 (doctor profiles).
- **#107** – Tags collection and relationship enhancements. Enables taxonomy for Epics 163 and 165.
- **#109** – Organize admin groups across collections/plugins. Improves Payload admin UX for Epics 147, 150, 151, 163, and 164.
- **#118** – Workflow permissions hardening (security alert #4). Epic 152.
- **#119** – Fix ESLint warnings and update ignores. Quality infrastructure; global benefit.
- **#120** – Workflow permissions hardening (security alert #3). Epic 152.
- **#121** – Workflow permissions hardening (security alert #2). Epic 152.
- **#122** – Dependabot schema update. Dependency automation; no epic linkage.
- **#126** – CI & CD refactor with Vercel script. Operational reliability; no direct epic.
- **#166** – ClinicTreatments join with pricing. Backbone for Epics 149, 154, 155, 158, and 159.
- **#168** – DoctorTreatments join. Expands Epic 160 capabilities.
- **#173** – DoctorSpecialties join. Further enriches Epic 160.
- **#174** – Doctor full name generation with title support. UI polish for Epic 160.
- **#175** – Slug generation uniqueness and admin UX tweaks. Supports Epics 148, 163, and 164.
- **#176** – Reviews & medical specialties revamp plus seeding. Central to Epics 149, 150, 157, 158, and 159.
- **#177** – Deploy workflow manual trigger. Operational tooling only.
- **#179** – Dependency-only payloadcms group bump. No epic linkage.
- **#180** – Dependency-only dev-dependencies bump. No epic linkage.
- **#184** – CI build: PostgreSQL service & migration handling. Operational reliability.
- **#186** – Fix S3 storage type/schema mismatch. Media stability for Epics 148 and 161.
- **#191** – Dependabot payloadcms pattern adjustment. Maintenance automation.
- **#195** – Multi-user auth architecture (patients, clinic staff, platform). Pillar for Epics 146, 147, 151, and 156.
- **#207** – CI: Conventional commit PR title check. Repository governance tooling.

## Additional Closed PR Coverage (API Audit)

Querying `https://api.github.com/repos/findmydoc-platform/website/pulls?state=closed&per_page=400` surfaced more merged PRs beyond the current change log. Their epic alignment (or lack thereof) is summarized below.

- **#208** – Post-release GitHub workflow for automatic issue commenting. Operational automation; no direct epic mapping.
- **#213** – Add GitHub Copilot instructions and Playwright testing guidance. Developer enablement reference; not tied to feature epics.
- **#218** – Added Copilot instructions and settings. Complements #213 as documentation/DX support.
- **#226** – Implement FavoriteClinics collection with composite unique index. Supplies the backend for Epic 156 (User Profiles with Favorites).
- **#227** – Calculation hooks for ratings and prices. Powers Epics 149, 150, 157, 158, and 159 by keeping aggregates in sync.
- **#233** – Update access control rules. Aligns Payload permissions with the matrix, directly affecting Epics 147, 150, 151, 157, and 159.
- **#236** – Rename `plattformStaff` to `platformStaff`. Consistency fix supporting Epics 146 and 151.
- **#238** – Unified form refactoring & layout updates for admin UI. Improves admin ergonomics for Epics 147, 151, and responsive concerns in Epic 153.
- **#239** – Add Vitest integration and unit test setup. Test infrastructure; no specific epic linkage.
- **#243** – Fix deepMerge `isObject` null check. Stability fix affecting shared utilities across epics.
- **#244** – Improve admin descriptions. UX clarity for Epics 147 and 151.
- **#245** – Filter clinics by approved status. Enforcement for Epics 147 (approval workflow) and 150/159 (public listings).
- **#246** – Streamline clinic registration. Directly advances Epic 147 and improves responsive flows under Epic 153.
- **#247** – Show registration success banner. UX enhancement for Epic 147.
- **#249** – Improve Supabase authentication error logging. Observability for Epic 146.
- **#252** – Add import and export plugin to PayloadCMS. Administrative tooling for Epic 151 (content governance).
- **#255** – Custom Slack release script. Release operations; no epic linkage.
- **#266** – Add PostHog integration. Analytics/observability aligned with Epic 152 (security/compliance monitoring) and admin reporting.
- **#274** – Fix migration scripts missing. Maintenance fix; no feature epic linkage.
- **#277** – Enable non-interactive `migrate:fresh` execution in CI. Operational reliability.
- **#282** – Update database reset command to use Vercel build. Operational reliability.
- **#283** – Add permission matrix and align code to the matrix. Documentation + enforcement for Epics 151, 152, and 156.
- **#285** – Remove obsolete migration status during database reset. Operational maintenance.
- **#290** – Adopt PayloadCMS native soft delete and restore across collections. Data governance improvement supporting Epics 148, 151, and 160.
- **#292** – Remove Slack notifications and add GitHub discussions to release workflow. Operational communications; no direct epic.
- **#299** – Baseline/demo seeding architecture, dashboard controls, instrumentation & test coverage. Broad uplift for Epics 147, 149, 150, 151, and 163 (seed content + admin dashboards).
- **#303** – Streamlined baseline content enrichment with JCI accreditation, medical specialties, and treatments. Enriches Epics 148, 149, 160, 163, and 165.
- **#305** – First FindMyDoc block components. Provides frontend blocks used by Epics 148, 153, 163, 164, and 165.
- **#310** – Update PR gates scopes (add test, ci; remove payload, vercel). Governance/CI scope adjustment.
- **#312** – Allow user management with Supabase auth from Payload admin UI only. Strengthens Epics 146 and 151 by constraining account management to Supabase-backed flows.
- **#313** – Fix migration files missing for UI components. Maintenance; no epic linkage.
- **#327** – Reworked permission documentation and moved fields to basic users for optimized experience. Complements Epics 146, 151, and 152 with clarified permission surfaces.
- **#331** – Add comprehensive unit tests and JSDoc for utility functions. Quality improvements supporting all epics indirectly.

### Dependency-Only and Closed-without-Merge PRs

- **Merged dependency maintenance** – #22, #23, #28, #29, #32, #34, #35, #37, #41, #103, #115, #117, #124, #125, #171, #172, #178, #181, #182, #183, #187, #193, #194, #196, #198, #203, #210, #211, #215, #224, #225, #228, #230, #241, #250, #251, #256, #257, #258, #267, #269, #270, #271, #279, #280, #284, #293, #294, #317, #323, #325, #326, #332, #333. These PRs strictly adjust dependencies or runtime images and therefore do not map to specific feature epics.
- **Closed without merge (no repository impact)** – #9, #24, #25, #26, #27, #30, #36, #38, #58, #98, #99, #100, #101, #102, #110, #111, #112, #113, #114, #116, #123, #169, #170, #179, #180, #188, #189, #190, #192, #197, #201, #202, #204, #205, #209, #212, #214, #216, #217, #221, #222, #223, #229, #231, #232, #237, #240, #242, #248, #253, #254, #263, #268, #278, #295, #296, #306, #307, #308, #309, #311, #318, #319, #338. These include early experiments (e.g., #9) that were superseded by merged pipeline work such as #31 and #126.

## Immediate Backlog Suggestions
- Unblock clinic registration (fix form bug #272) before deeper clinic/treatment UI work.
- Finalize media architecture (#264) before starting gallery (161) and richer articles imagery (163).
- Bundle search & comparison (154,155,158,159) into a single "Discovery" sprint to avoid fragmented query layer work.
- Address email verification (220) to complete auth epic (146) and reduce onboarding friction.

## Proposed Next Minimal Actions
1. Confirm which epics are MVP-critical: likely 146–149, 150, 156, 147.
2. For each: create one sentence vertical slice target (e.g., "Display approved reviews under clinic profile").
3. Add missing indexes for high-frequency filters (price, rating, city) where not yet present.
4. Draft a unified search endpoint spec supporting: treatmentId, cityId, sort (price|rating), priceRange.
5. Decide on gallery storage (reuse future `clinicMedia` collection) before schema changes.

## Open Clarifications (Keep Lightweight)
- Is a separate collection needed for "tips" or can it be a tagged article? (165)
- Do we aggregate ratings now or defer until after base review display? (150/157)
- Single endpoint vs multiple for comparison, auto-list, filtering? (154–159)

---
Edit this table collaboratively; keep statuses coarse. When ready for deeper dive, create per-epic docs.

---

## 146 – Registration and Login (Email, Google, Facebook)
Backend present: Supabase auth scaffold; email verification not finalized; social providers (Google/Facebook) not evident.
UI present: Basic login/register likely; forgot password + social buttons unclear.
Minimal Next Slice: Implement email verification link flow + surface resend link.
Clarification Questions:
1. Are Google and Facebook mandatory for MVP or optional enhancement?
2. Do we require enforced email verification before any protected action (favorites, reviews)?
3. Should password strength rules exceed "minimum length" (e.g., complexity, breach check)?

Implementation Trace (PRs verified in `docs/pr-change-log.md`):
- #195 Multi-user auth architecture (patients, clinic staff, platform) – auth collections, strategies, access utilities, and pages; core backend for Supabase ↔ Payload flows.
- #52 Admin (Staff) Collection & Supabase Auth Consolidation – initial Supabase auth consolidation and strategy wiring.
- #90 Rename staff → platformStaff; auth wiring – aligns staff identity model and auth flows across admin/auth surfaces.
- #38 Authentication Forms (Login & Registration UI) – implements base login/register UI components.
- #40 Clinics on Home + Login Integration – integrates auth UI with app shell.
- #93 Adapt posts/pages/media; minor auth tweaks – ancillary adjustments that touched auth utilities (minor).

Additional Closed PRs (API audit):
- #249 Improve Supabase authentication error logging – strengthens observability for failed login/registration attempts.
- #312 Allow user management with Supabase auth from Payload admin UI only – ensures account provisioning remains aligned with Supabase strategy used by this epic.
- #327 Reworked permission documentation and moved fields to basic users – clarifies auth data stored on login-capable users and documents enforced permission rules.

Notes: No evidence of Google/Facebook social providers or email verification completion in processed PRs; those remain pending.

## 147 – Clinic Registration with Admin Approval
Backend present: `clinics` with status field; approval workflow partial. Form bug (#272) blocks creation.
UI present: Registration form exists but broken; admin approval UI present in Payload default list.
Minimal Next Slice: Fix form fetch (slug query) + show post-submit pending state.
Clarification Questions:
1. Should rejection reason be stored/displayed to clinic applicant?
2. Do we auto-email on approval/rejection now or defer?
3. Is there a max pending submission retry or rate limit needed (spam prevention)?

Implementation Trace (PRs verified in `docs/pr-change-log.md`):
- #49 Clinic & Doctor Seed Data + Slug Routing – introduces clinic records and slug-based routing foundation used by registration flows.
- #92 Add Countries Collection & Related Schema Adjustments – adds location fields used in clinic profiles/registration.
- #109 Organize Admin Groups – improves admin UX for clinics and related collections (approval ergonomics).
- #195 Multi-user auth architecture – establishes roles and access helpers supporting approval boundaries.
- #95 Clinics model restructure; status workflow; seeds – solidifies clinic approval statuses and editorial/admin flow fundamentals.

Additional Closed PRs (API audit):
- #233 Update access control rules – enforces clinic-staff and platform staff scope boundaries for registration review.
- #238 Unified admin form refactoring – streamlines registration form layout for Payload admins and applicants.
- #244 Improve admin descriptions – clarifies registration field intent inside the admin UI.
- #245 Filter clinics by approved status – ensures only approved clinics surface publicly after admin review.
- #246 Streamline clinic registration – fixes and polishes the public submission flow.
- #247 Show registration success banner – adds immediate UI feedback after submitting a clinic application.
- #299 Baseline/demo seeding architecture – seeds dashboard controls supporting registration review workflows.

Notes: No PR explicitly titled for “clinic registration form” or approval workflow; functionality inferred from collections/access present. Form bug (#272) still unlinked.

## 148 – Clinic Profiles with Name, Location, Description
Backend present: Fields exist (address, maybe geo point). Need confirmation geo coordinates stored.
UI present: Basic profile page; map & rich formatting maybe missing.
Minimal Next Slice: Add map component using stored coordinates; fallback geocode if missing.
Clarification Questions:
1. Are we storing lat/long explicitly or deriving via geocoding API on save?
2. Is map provider fixed (Google) or can we use open source (Leaflet/OSM) to avoid API key overhead now?
3. Should description support rich text (headings, links) or remain plain for MVP?

Implementation Trace (PRs verified in `docs/pr-change-log.md`):
- #49 Clinic & Doctor Seed Data + Slug Routing – enables clinic slug pages and initial profile content.
- #92 Add Countries Collection – adds country/location fields used on clinic profiles.
- #86 Remove Languages Collection – moves language fields onto clinics/doctors, part of profile data.
- #175 Slug generation: uniqueness + admin UX – robust slug handling for profile pages.
- #109 Organize Admin Groups – clarifies field purposes and admin grouping (editorial flow aid).
- #94 Cities collection + PostGIS enablement – introduces city entity and spatial capabilities relevant for addresses/maps.
- #95 Clinics model restructure; status workflow; seeds – refines profile fields and states used on clinic pages.
- #96 Accreditation rich text + icon – supports accreditation display on clinic profiles.

Additional Closed PRs (API audit):
- #46 Adding basic collections – initial schema definitions for clinics and supporting relations.
- #299 Baseline/demo seeding architecture – populates richer profile content and admin dashboard controls.
- #303 Streamlined baseline content enrichment – adds accreditation, specialty, and treatment content displayed on profiles.
- #305 First FindMyDoc block components – introduces frontend blocks used for profile layout.
- #290 Adopt Payload soft delete – protects clinic profile data with reversible deletes for admin remediation.

Notes: No PR yet adds a map embedding component; geolocation utilization still absent in commit messages—map work remains outstanding.

## 149 – Treatment Offerings & Price Information
Backend present: `treatments` / `clinicTreatments` join; confirm price fields (range vs single). Indexing might be partial.
UI present: No pricing list rendering yet.
Minimal Next Slice: Show list of clinic treatments with "from €X" using lowest price field.
Clarification Questions:
1. Do we need price ranges (min/max) or just a single "from" price for MVP?
2. Currency fixed to EUR now or multi-currency needed?
3. Should treatments be ordered manually, alphabetically, or by price by default?

Implementation Trace (PRs verified in `docs/pr-change-log.md`):
- #166 ClinicTreatments join (clinic ↔ treatment w/ price) – core pricing fields and relationships.
- #176 Reviews + Medical Specialties revamp + seeding – introduces average ratings calc; complements pricing display for sorting/context.
- #88 Rename Treatments → Medical Specialties – naming alignment across domain.
- #89 Rename Procedures → Treatments – harmonizes historical naming and migrations around treatment entities.

Additional Closed PRs (API audit):
- #227 Calculation hooks for ratings and prices – keeps treatment pricing aggregates current on create/update/delete.
- #299 Baseline/demo seeding architecture – seeds representative treatment pricing data for demos.
- #303 Streamlined content enrichment – loads JCI/treatment metadata that pairs with clinic offerings.

Gaps: No PR yet adds a dedicated clinic profile treatment pricing component; UI rendering layer still absent.

## 150 – Display Customer Reviews
Backend present: `reviews` collection with approval status; rating aggregation status unknown.
UI present: Partial (list maybe, count not confirmed).
Minimal Next Slice: Fetch approved reviews + show count badge.
Clarification Questions:
1. Are star ratings part of this epic or only textual reviews?
2. Do we paginate reviews or show a fixed number with "load more"?
3. Should anonymous user names be anonymized (e.g., first name + initial)?

Implementation Trace (PRs verified in `docs/pr-change-log.md`):
- #176 Reviews + Medical Specialties revamp + seeding – adds `reviews` collection validation/hooks and average ratings calc.
- #109 Organize Admin Groups – improved admin UX aiding moderation ergonomics.

Additional Closed PRs (API audit):
- #227 Calculation hooks for ratings and prices – keeps review-driven rating aggregates up to date.
- #233 Update access control rules – ensures only authorized staff moderate reviews and exposes approved content.
- #245 Filter clinics by approved status – pairs review visibility with clinic approval state for public listings.
- #299 Baseline/demo seeding architecture – seeds demo review data for testing display logic.

Gaps: No PR explicitly adds a public-facing reviews list component; pagination / load-more patterns not yet implemented.

## 151 – Admin Panel Management
Backend present: Collections & access in place; may need additional statuses (rejected reasons) later.
UI present: Payload admin baseline; ergonomic filters lacking.
Minimal Next Slice: Add saved admin views/filters for pending clinics & reviews.
Clarification Questions:
1. Do admins require bulk approve/reject actions in MVP?
2. Should we log audit trail entries (who approved what) visibly?
3. Any export (CSV) need now or defer?

Implementation Trace (PRs verified in `docs/pr-change-log.md`):
- #109 Organize Admin Groups – admin grouping and descriptions for collections/plugins.
- #52 Admin (Staff) Collection & Supabase Auth Consolidation – aligns identity management with Payload admin.
- #195 Multi-user auth architecture – clarifies roles and access, central to admin capabilities.

Additional Closed PRs (API audit):
- #233 Update access control rules – enforces scope filters for clinics, reviews, and users within the admin.
- #238 Unified admin form refactoring – improves admin form layout ergonomics.
- #244 Improve admin descriptions – clarifies field labels and helps onboarding admin staff.
- #252 Add import/export plugin – introduces data governance tooling for admin users.
- #266 Add PostHog integration – surfaces admin analytics instrumentation.
- #299 Baseline/demo seeding architecture – adds dashboard controls and test coverage supporting admin workflows.
- #303 Streamlined baseline content enrichment – provides richer datasets for admin moderation.
- #312 Allow user management with Supabase auth from Payload admin UI only – restricts admin user provisioning to Supabase-backed flows.
- #327 Reworked permission documentation & moved fields – documents permission matrix and centralizes basic user fields for admin operations.
- #290 Adopt Payload soft delete – gives admins reversible delete tooling across collections.

Gaps: No PR yet adds custom saved views / bulk moderation UI actions; these remain future enhancements.

## 152 – Security Management (Spam, GDPR)
Backend present: No captcha integration hooks; privacy page not guaranteed.
UI present: Missing captcha widgets; footer link maybe partial.
Minimal Next Slice: Add static Privacy Policy page + placeholder captcha abstraction.
Clarification Questions:
1. Which captcha provider (hCaptcha, reCAPTCHA v2/3) do we prefer?
2. Is data subject access request (DSAR) workflow required now?
3. Do we need cookie consent banner in MVP scope?

Implementation Trace (PRs verified in `docs/pr-change-log.md`):
- #105 Workflow permissions hardening (security alert #5) – grants least-privilege workflow scopes.
- #118 Workflow permissions hardening (security alert #4) – continues CI scope tightening.
- #119 Fix ESLint warnings and update ignores – removes lint noise hiding auth/security issues.
- #120 Workflow permissions hardening (security alert #3) – extends GitHub Actions permission lockdown.
- #121 Workflow permissions hardening (security alert #2) – completes the set of GitHub Actions hardening steps.
- #207 CI: Conventional commit PR title check – governance automation ensuring review discipline.

Additional Closed PRs (API audit):
- #233 Update access control rules – aligns collection access checks with the documented permission matrix.
- #266 Add PostHog integration – introduces audit/analytics instrumentation supporting security monitoring.
- #283 Add permission matrix and align code – publishes the matrix and enforces it across code paths.
- #327 Reworked permission documentation & moved fields – clarifies role fields and associated access expectations.

Gaps: No PR implementing captcha, rate limiting, privacy policy pages, cookie consent, or GDPR/DSAR workflows. All core spam/privacy controls unimplemented.

## 153 – Responsive Design for Mobile
Backend: n/a.
UI present: Tailwind layout likely responsive but unverified on key pages.
Minimal Next Slice: Run audit for top 5 pages; fix nav & table overflow.
Clarification Questions:
1. Define breakpoints we must explicitly test (sm, md, lg?).
2. Are performance metrics (LCP on mobile) part of acceptance?
3. Any gestures or mobile-specific components planned (sticky actions)?

Implementation Trace (PRs verified in `docs/pr-change-log.md`):
- #40 Clinics on Home + Login Integration – introduces frontend listing/templates which likely include responsive Tailwind usage.
- #38 Authentication Forms (Login & Registration UI) – base UI components, not explicitly mobile-focused but relevant to layout.
- #99 Tailwind v4 upgrade – major utility/class updates affecting responsive behavior across the UI.
- (No PR explicitly titled for a mobile/responsive pass.)

Additional Closed PRs (API audit):
- #246 Streamline clinic registration – smooths responsive clinic form flow.
- #305 First FindMyDoc block components – introduces layout blocks applied across breakpoints.

Gaps: No PR explicitly titled for mobile/responsive audit; lack of documented passes for mobile-specific navigation or layout fixes. Need targeted QA + follow-up PRs.

## 154 – Direct Comparison by Treatment Type
Backend present: Relationship query possible; may need efficient index on clinicTreatments.treatment.
UI present: None (comparison view missing).
Minimal Next Slice: Endpoint returning clinics for a selected treatment (name, price, rating snapshot).
Clarification Questions:
1. Do we need side-by-side comparison columns (features) or just a filtered list?
2. Are unavailable prices hidden or shown as "—"?
3. Should results auto-sort by price or rating by default here (conflict with 158)?

Implementation Trace (PRs verified in `docs/pr-change-log.md`):
- #166 ClinicTreatments join (clinic ↔ treatment w/ price) – provides the core relationship needed to query clinics by treatment.
- #176 Reviews + Medical Specialties revamp – rating aggregation complementary for comparison views.
- #88 Rename Treatments → Medical Specialties – aligns terminology for treatment-based comparisons and UI copy.

Additional Closed PRs (API audit):
- #227 Calculation hooks for ratings and prices – ensures comparison queries read the latest aggregates.
- #299 Baseline/demo seeding architecture – seeds demo data for comparison scenarios.

Gaps: No PR adds a comparison endpoint or UI/table; no indexing PR explicitly optimizing treatment-based queries (verify need for index on `clinictreatments.treatment`).

## 155 – Automatic Display After Treatment Selection
Backend present: Same query logic as 154.
UI present: Missing auto-navigation or dynamic route.
Minimal Next Slice: After selecting treatment in search, redirect to comparison list with query param.
Clarification Questions:
1. Should selection persist in URL (e.g., /clinics?tx=<id>) for sharable links?
2. Do we prefetch clinic data on selection for faster transition?
3. Keyboard accessibility for selection required now?

Implementation Trace (PRs verified in `docs/pr-change-log.md`):
- #166 ClinicTreatments join – backend relation enabling the query upon selection.
- #176 Reviews + Medical Specialties revamp – rating data available post-selection.
- #88 Rename Treatments → Medical Specialties – ensures consistent naming used in selection and routing.

Additional Closed PRs (API audit):
- #227 Calculation hooks for ratings and prices – keeps selection-triggered aggregates current.
- #299 Baseline/demo seeding architecture – seeds treatment data for end-to-end selection demos.

Gaps: No PR establishing an auto-redirect flow or dedicated search selection component; no route-level handling of treatment query param for immediate list rendering.

## 156 – User Profiles with Favorites
Backend present: `favoriteClinics` collection + access constraints implemented; uniqueness maybe enforced.
UI present: Partial (favorite button maybe; profile listing unclear).
Minimal Next Slice: Profile favorites list component with remove action.
Clarification Questions:
1. Is favoriting optimistic (toggle instantly) or wait for server confirm?
2. Do we cap number of favorites for MVP?
3. Should favorites influence search ranking (later)?

Implementation Trace (PRs verified in `docs/pr-change-log.md`):
- #195 Multi-user auth architecture – introduces patient/basic user roles that favorites rely on.

Additional Closed PRs (API audit):
- #226 Implement FavoriteClinics collection with composite unique index – establishes the collection, access rules, and uniqueness constraint.
- #283 Add permission matrix and align code – documents and enforces patient abilities to manage favorites.
- #299 Baseline/demo seeding architecture – scaffolds dashboard controls touching favorites analytics.

Gaps: No PR adds a favorites toggle button component or profile favorites listing UI; unique index exists via #226 but front-end remains missing.

## 157 – Writing Reviews & Testimonials
Backend present: Create path + moderation status field.
UI present: Missing submission form or incomplete.
Minimal Next Slice: Simple form (textarea + submit) with pending confirmation state.
Clarification Questions:
1. Minimum/maximum review length constraints?
2. Can a user submit multiple reviews per clinic or one editable draft?
3. Are star ratings captured at creation or future enhancement?

Implementation Trace (PRs verified in `docs/pr-change-log.md`):
- #176 Reviews + Medical Specialties revamp + seeding – creates robust reviews model and average rating updates on create.
- #109 Organize Admin Groups – improves admin moderation clarity.

Additional Closed PRs (API audit):
- #227 Calculation hooks for ratings and prices – maintains rating aggregates after new submissions or edits.
- #233 Update access control rules – enforces submitter permissions and moderation scope.
- #283 Add permission matrix and align code – documents and codifies who can create and manage reviews.

Gaps: No PR with a public review submission form, no validation hooks for rate limiting or duplicate reviews, no client-side optimistic submission handling.

## 158 – Sorting Clinics by Price, Reviews, Services
Backend present: Need deterministic query params & indexes (price, rating).
UI present: Sorting controls absent.
Minimal Next Slice: Add sort dropdown (price asc/desc, rating desc, best deals placeholder).
Clarification Questions:
1. Definition of "Best Deals" beyond rating ≥ 4 (tie-breaker)?
2. Should sort preference persist (localStorage) between sessions?
3. Do we expose number of clinics excluded by "Best Deals" filter?

Implementation Trace (PRs verified in `docs/pr-change-log.md`):
- #176 Reviews + Medical Specialties revamp – provides average rating aggregation.
- #166 ClinicTreatments join – provides price fields for price-based sorting.

Additional Closed PRs (API audit):
- #227 Calculation hooks for ratings and prices – ensures sort fields stay current when data changes.
- #299 Baseline/demo seeding architecture – supplies data sets for validating sort behavior.

Gaps: No PR implements explicit sort query params on an endpoint or UI sort controls; need endpoint spec (e.g., /api/clinics?sort=rating_desc) + indexes confirmation (price/rating fields). No caching strategy defined for heavy sort queries.

## 159 – Sorting & Filtering Functions
Backend present: Fields exist (price, rating, location); duration flag maybe missing.
UI present: No multi-filter UI yet.
Minimal Next Slice: Implement location + price range filters; defer duration if not modeled.
Clarification Questions:
1. Are price ranges static constants or dynamic buckets computed from data?
2. Is multi-select location allowed or single city only for MVP?
3. Should filters update results instantly or require "Apply" button?

Implementation Trace (PRs verified in `docs/pr-change-log.md`):
- #92 Add Countries Collection – enables country/city-based filtering surface.
- #166 ClinicTreatments join – enables price/treatment filters.
- #176 Reviews revamp – enables rating-based filters.
- #12 Initial Schema Bootstrap – establishes forms/search scaffolding referenced for future unified search.
- #94 Cities collection + PostGIS – supports city filters and potential spatial queries.

Additional Closed PRs (API audit):
- #233 Update access control rules – provides approved-only filters for public clinic listings.
- #245 Filter clinics by approved status – enforces status filtering logic.
- #299 Baseline/demo seeding architecture – seeds data powering discovery dashboards.
- #303 Streamlined baseline content enrichment – enriches taxonomy data for filtering facets.

Gaps: No unified search/filter endpoint; no UI filter components (multi-select, range slider). Missing indexes verification (cityId, averagePrice, averageRating). No debounce/throttle logic for instant filtering yet.

## 160 – Doctor Profiles with Qualifications
Backend present: `doctors` collection; qualifications likely textual/array.
UI present: Not rendering dedicated doctor section on clinic page yet.
Minimal Next Slice: Add doctor list component with qualifications snippet.
Clarification Questions:
1. Are qualifications structured (array) or free text only?
2. Do we need doctor detail pages, or only inline cards in clinic profile?
3. Should we hide unapproved / inactive doctors automatically?

Implementation Trace (PRs verified in `docs/pr-change-log.md`):
- #106 Implement doctors collections – initial doctor schema and relationships.
- #173 DoctorSpecialties join – establishes doctor ↔ medical specialty relation with unique pair index.
- #168 DoctorTreatments join – establishes doctor ↔ treatment relations.
- #174 Doctor full name generation – UX improvements, name composition for display.
- #49 Clinic & Doctor Seed Data + Slug Routing – initial doctor records and routing.

Additional Closed PRs (API audit):
- #303 Streamlined baseline content enrichment – adds enriched medical specialty and treatment datasets displayed on doctor cards.
- #299 Baseline/demo seeding architecture – seeds demo doctors and analytics controls.
- #305 First FindMyDoc block components – provides blocks used to render doctor profile sections.
- #290 Adopt Payload soft delete – protects doctor data with reversible delete handling.

Gaps: Claims in readiness table list UI as done, but current notes below (pre-trace) said “Not rendering dedicated doctor section yet”; discrepancy: need verification. If UI truly exists, link PR; if not, adjust readiness score or add PR once implemented. No PR cited adding doctor profile UI (cards/components). Potential adjustment required.

## 161 – Before-and-After Picture Gallery
Backend present: Awaiting media collection strategy (#264); no pairing model defined.
UI present: None.
Minimal Next Slice: Decide schema for paired images (single collection with before/after fields) then simple slider component.
Clarification Questions:
1. Pairing model: two upload fields in a single doc vs separate docs linked by pairId?
2. Do we need explicit patient consent tracking now?
3. Are image transformations (cropping) handled client-side or deferred?

Implementation Trace (PRs verified in `docs/pr-change-log.md`):
- #57 Supabase Storage Integration – foundational media storage.
- #186 Fix S3 storage: type/schema mismatch + migration – stabilizes external storage config/migration.
- #93 Adapt posts/pages/media collections – large adaptations around media/content model (not specific to gallery pairs).

Gaps: No PR adds gallery schema, no migration defining pair structure, no UI component (slider/comparison). Blocked pending decision on #264 media architecture. Need explicit collection (e.g., `clinicMediaPairs`) or fields addition + consent tracking design.

## 163 – Articles on Beauty Treatments
Backend present: Likely `posts/pages` with categories; may need dedicated `articles` taxonomy tag.
UI present: Listing & detail template missing.
Minimal Next Slice: Render article list (title, excerpt, cover image) + detail page.
Clarification Questions:
1. Separate `articles` collection or reuse existing `posts` with category filter?
2. Are SEO meta fields required now?
3. Pagination size for article list?

Implementation Trace (PRs verified in `docs/pr-change-log.md`):
- #93 Adapt Posts/Pages/Media to New Data Model & Content Enhancements – major content model uplift; posts excerpt, blocks, seeds.
- #12 Initial Schema Bootstrap – foundational pages/posts/categories/media schema and indices.
- #107 Tags Collection – enables tagging taxonomy applicable to articles.
- #175 Slug generation: uniqueness + admin UX – improves post slug handling and editorial UX.

Additional Closed PRs (API audit):
- #299 Baseline/demo seeding architecture – seeds dashboard controls and sample article content.
- #303 Streamlined baseline content enrichment – populates accreditation, specialty, and treatment narratives tied to articles.
- #305 First FindMyDoc block components – provides reusable blocks for article layouts.

Gaps: Need explicit beauty treatment article tagging strategy (taxonomy vs category), front-end article list & detail route confirmation, SEO meta fields (title/description) validation, pagination implementation.

## 164 – Static Informational Pages
Backend present: `pages` stable.
UI present: Some links maybe missing in footer/nav.
Minimal Next Slice: Ensure dynamic routing for all page slugs + add footer links.
Clarification Questions:
1. Should unpublished pages be previewable via tokenized URL?
2. Do we need versioning/changelog for these pages?
3. Any localization requirement imminent (affects slug strategy)?

Implementation Trace (PRs verified in `docs/pr-change-log.md`):
- #93 Adapt Posts/Pages/Media – pages integration and richer content blocks.
- #12 Initial Schema Bootstrap – pages collection and routing foundations.
- #109 Organize Admin Groups – improved admin UX for pages.
- #175 Slug generation: uniqueness + admin UX – strengthens page slug behavior and routing stability.

Additional Closed PRs (API audit):
- #299 Baseline/demo seeding architecture – seeds baseline pages and dashboard tooling.
- #305 First FindMyDoc block components – supplies page blocks for static content.

Gaps: Need audit confirming all essential static pages (Privacy, Terms, About) exist; no PR explicitly adds privacy/terms documents (ties to epic 152). Footer/nav linking completeness unverified; preview token workflow absent.

## 165 – Tips for Choosing a Clinic
Backend present: Could be a page or article tag; not distinct yet.
UI present: Missing dedicated section.
Minimal Next Slice: Add a single "Guide" page pulling from a `pages` record.
Clarification Questions:
1. Integrate into FAQ or stand-alone guide route?
2. Will tips need structured sections (accordion) or plain rich text?
3. Should this page be highlighted in navigation or only linked contextually?

Implementation Trace (PRs verified in `docs/pr-change-log.md`):
- #93 Adapt Posts/Pages/Media – blocks enable rich tips/guide pages.
- #107 Tags Collection – can be used to tag tips-related content.
- #12 Initial Schema Bootstrap – posts/pages base.

Additional Closed PRs (API audit):
- #299 Baseline/demo seeding architecture – seeds demo guide content into dashboards.
- #303 Streamlined baseline content enrichment – enriches treatment/tip narratives reused by this page.
- #305 First FindMyDoc block components – provides guide-friendly blocks (accordions, highlights).

Gaps: No dedicated guide/tips page implemented, no taxonomy tag differentiating "tips" from general posts/pages, no navigation highlight logic, and no measurement (analytics event) for guide engagement.
