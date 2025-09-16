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
- #38 Authentication Forms (Login & Registration UI) – implements base login/register UI components.
- #40 Clinics on Home + Login Integration – integrates auth UI with app shell.
- #93 Adapt posts/pages/media; minor auth tweaks – ancillary adjustments that touched auth utilities (minor).

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
- None product-side. CI hardening PRs exist (#105, #118–#121, #207) but are not end-user spam/privacy features.

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
- (No PR explicitly titled for a mobile/responsive pass.)

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
- No matching PRs found adding a `favoriteClinics` collection or related hooks in the processed log. Feature likely not implemented yet in main.

Gaps: No PR adds a favorites toggle button component, no profile favorites listing UI, no uniqueness enforcement PR note (verify if hook or unique index exists). Need UI + potential unique constraint validation.

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
- #173 DoctorSpecialties join – establishes doctor ↔ medical specialty relation with unique pair index.
- #168 DoctorTreatments join – establishes doctor ↔ treatment relations.
- #174 Doctor full name generation – UX improvements, name composition for display.
- #49 Clinic & Doctor Seed Data + Slug Routing – initial doctor records and routing.

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

Gaps: No dedicated guide/tips page implemented, no taxonomy tag differentiating "tips" from general posts/pages, no navigation highlight logic, and no measurement (analytics event) for guide engagement.
