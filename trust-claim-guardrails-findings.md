# Trust Claim Guardrails Findings

Working note for issue-level solution planning. This file is intentionally kept under `tmp/` and must not be committed.

Sources:

- GitHub: `findmydoc-platform/management#237`
- GitHub: `findmydoc-platform/management#248`
- Notion: `Content-/Claim-Guardrails`

## Basis

- Red means either never publishable under the guardrails, or technically disabled before MVP when the element is not verified and checked.
- For the MVP disable gate, `verified` means verified by findmydoc through an explicit, documented process, not just clinic-provided or seeded data.
- Yellow means publishable only with documented evidence: source, owner, proof type, proof date, and an accountable check.
- Green means generally safe when phrased as comparison, organization, profile structure, or direct contact, without medical advice or quality certification.
- Current gap: the repository documents review moderation, but does not clearly define a complete findmydoc verification/checking process for public reviews, verified badges, star ratings, or before/after galleries.

## Item Status Overview

| Item | Short title                               | Status                                      |
| ---- | ----------------------------------------- | ------------------------------------------- |
| P1   | Verification/checking process             | Decision needed                             |
| R1   | Listing trust block claims                | Solved in `findmydoc-platform/website#1309` |
| R2   | Before/after case gallery                 | Decision needed                             |
| R3   | Public reviews and star ratings           | Decision needed                             |
| R4   | Verification badges                       | Decision needed                             |
| R5   | Rating-based ranking and filters          | Decision needed                             |
| R6   | Demo blog disclaimer and `[Demo]` titles  | Solved in `findmydoc-platform/website#1303` |
| R7   | Storybook and fixture trust claims        | Solved in `findmydoc-platform/website#1305` |
| Y1   | Landing and partner trust language        | Step 1 solved; copy decision needed         |
| Y2   | Verification and quality-check copy       | Decision needed                             |
| Y3   | Accreditations and seeded standards       | Decision needed                             |
| Y4   | Temporary landing trust language          | Decision needed                             |
| Y5   | Transparent pricing and reviewed prices   | Decision needed                             |
| Y6   | Clinic registration verified visibility   | Solved for CMS editability; rewrite needed  |
| Y7   | Required disclaimers                      | Solved in `findmydoc-platform/website#1333` |
| G1   | Clinic comparison and structured profiles | Safe pattern                                |
| G2   | Clinic-provided profile information       | Safe pattern                                |
| G3   | Direct contact and inquiry flow           | Safe pattern                                |
| G4   | Transparent non-quality filters           | Safe pattern                                |

## Cross-Cutting Process Gap

### P1. Verification/checking process is not clearly documented

- Severity: `8/10`
- Notion category: prerequisite for all MVP disable-gate items
- Problem: Notion allows some elements only if they are verified and checked. In the current repo evidence, there is no single clear process definition for what findmydoc verifies, who checks it, what evidence is stored, and when an element becomes safe for public MVP use.
- Impact: Public reviews, verified badges, star ratings, before/after galleries, accreditations, and quality claims cannot be evaluated cleanly case by case without this process.
- Current partial references:
  - `docs/review-modification-process.md:5`
  - `src/collections/Reviews.ts:176`
  - `src/access/scopeFilters.ts:186`
  - `src/collections/Clinics.ts:410`
  - `src/collections/ClinicGalleryEntries/index.ts:17`
- Decision needed: define the verification/checking process first, or default all affected elements to disabled/hidden for MVP.

## Red Findings

### R1. Listing trust block with certification, guarantee, TÜV, and satisfaction claims

- Severity: `9/10`
- Notion category: red
- Status: Solved
- Problem: The listing comparison trust block contains direct issue #237 examples: certified clinics, guarantee language, `98% Satisfaction rate`, `TÜV`, `TÜV Süd certified`, `Verified platform`, `Verified clinic data`, and `Privacy guaranteed`.
- Impact: Public trust/certification claims can imply external certification or verified platform status without proof.
- Decision: Replace the block with green-safe comparison copy and real measurable platform counts. Keep `verified clinics`, because it is an internal clinic-profile state we already use, but remove certification, guarantee, TÜV, satisfaction-rate, and privacy-guarantee wording.
- Implemented approach:
  - Use the approved title `A clearer way to compare clinics`.
  - Use the approved subtitle `We make clinic profiles easier to compare by showing key treatment, location, and price fields in one place.`
  - Show only measurable stats: verified clinics, treatment types, cities, and price entries.
  - Hide the complete trust/stat block when fewer than three non-zero measurable stats are available.
  - Keep visual Storybook coverage with neutral measurable sample data.
- Implemented in:
  - `src/app/(frontend)/listing-comparison/page.tsx`
  - `src/app/(frontend)/listing-comparison/ListingComparisonPage.client.tsx`
  - `src/components/templates/ListingComparison/Component.tsx`
  - `src/components/organisms/TrustQualitySection/index.tsx`
  - `src/utilities/listingComparison/serverData/getListingComparisonServerData.ts`
  - `src/utilities/listingComparison/serverData/types.ts`
- GitHub tracking: findmydoc-platform/website#1308, findmydoc-platform/website#1309

### R2. Before/After case gallery

- Severity: `9/10`
- Notion category: MVP disable gate unless verified and checked
- Problem: Before/after images and galleries must be technically disabled before MVP unless findmydoc has a documented verification/checking process and proof for each published case.
- Impact: The feature is modelled as CMS content, mapped into public clinic detail data, and rendered when entries exist.
- Current references:
  - `src/collections/ClinicGalleryEntries/index.ts:17`
  - `src/collections/Clinics.ts:169`
  - `src/utilities/clinicDetail/serverData/repositories.ts:316`
  - `src/utilities/clinicDetail/serverData/mappers.ts:412`
  - `src/components/templates/ClinicDetailConcepts/ClinicDetail.tsx:289`
  - `src/components/organisms/ClinicDetail/BeforeAfterCaseGallerySection.tsx:57`
  - `src/components/organisms/ClinicDetail/BeforeAfterCaseGallerySection.tsx:261`
- Decision needed: hide from public MVP, keep admin-only/draft-only, or remove until compliance path exists.

### R3. Public reviews and star ratings

- Severity: `8/10`
- Notion category: MVP disable gate unless verified and checked
- Problem: Public clinic detail pages show `Patient Reviews`, `Verified review`, star ratings, review counts, and average scores.
- Impact: Notion says public reviews and star ratings must be disabled before MVP unless verified and checked. The repo has moderation docs, but no clear evidence process showing how findmydoc verifies each review before public display.
- Current references:
  - `src/collections/Reviews.ts:126`
  - `src/collections/Reviews.ts:176`
  - `src/collections/Reviews.ts:214`
  - `src/access/scopeFilters.ts:186`
  - `src/utilities/clinicDetail/serverData/repositories.ts:197`
  - `src/utilities/clinicDetail/serverData/repositories.ts:224`
  - `src/utilities/clinicDetail/serverData/mappers.ts:343`
  - `src/components/organisms/ClinicDetail/ClinicReviewsSection.tsx:23`
  - `src/components/organisms/ClinicDetail/ClinicReviewsSection.tsx:125`
  - `src/components/organisms/ClinicDetail/ClinicReviewsSection.tsx:326`
  - `src/components/molecules/RatingSummary/index.tsx:17`
  - `docs/review-modification-process.md:5`
- Decision needed: hide reviews/ratings for MVP, or define/document the verified-review evidence process before keeping them public.

### R4. Gold/Silver/Bronze verification badges

- Severity: `8/10`
- Notion category: MVP disable gate unless verified and checked
- Problem: Clinic verification tiers are public UI badges and demo data seeds approved clinics as gold/silver/bronze.
- Impact: This matches issue #237 risk around badge status without a real badge process. If findmydoc owns and documents that process, the item may become safe case by case; until then it should be disabled/hidden for MVP.
- Current references:
  - `src/collections/Clinics.ts:410`
  - `src/components/atoms/verification-badge.tsx:31`
  - `src/components/organisms/Listing/ListingCard.tsx:98`
  - `src/components/molecules/ClinicDetail/HeroQualitySummary.tsx:47`
  - `src/components/templates/ClinicDetailConcepts/shared.tsx:86`
  - `src/endpoints/seed/data/demo/clinics.json:53`
  - `src/endpoints/seed/data/demo/clinics.json:111`
  - `src/endpoints/seed/data/demo/clinics.json:169`
  - `src/endpoints/seed/data/demo/clinics.json:285`
  - `src/endpoints/seed/data/demo/clinics.json:343`
  - `src/endpoints/seed/data/demo/clinics.json:517`
- Decision needed: demote all public badge display to neutral profile status, or create evidence-backed verification workflow before publish.

### R5. Rating-based ranking and filters

- Severity: `8/10`
- Notion category: MVP disable gate unless verified and checked
- Problem: Listing comparison supports `Highest rated`, minimum star filters, and `Best match` server ordering that uses rating as tie-breaker.
- Impact: Ranking can imply quality scoring, especially because the rating source is the same review system that is not MVP-safe until verified and checked through a documented findmydoc process.
- Current references:
  - `src/components/molecules/RatingFilter/index.tsx:11`
  - `src/utilities/listingComparison/queryState.ts:14`
  - `src/utilities/listingComparison/sort.ts:78`
  - `src/utilities/listingComparison/serverData/getListingComparisonServerData.ts:67`
  - `src/utilities/listingComparison/serverData/pricing.ts:65`
  - `src/app/(frontend)/listing-comparison/ListingComparisonPage.client.tsx:170`
- Decision needed: remove rating sort/filter from public MVP, or replace with green-safe transparent sorting such as price, location, language, response time.

### R6. Blog seed content with medical-advice-adjacent guidance and missing disclaimer

- Severity: `6/10`
- Notion category: red where it becomes medical recommendation; otherwise yellow with required blog disclaimer
- Status: first PR candidate implemented
- Problem: Demo posts include medication schedules, symptom thresholds, recommended medications, treatment recommendations, and warning signs. No required blog disclaimer was found in the public post template.
- Impact: Content can look like medical guidance unless clearly framed as general information and medically reviewed where required.
- Current references:
  - `src/endpoints/seed/data/demo/posts.json:664`
  - `src/endpoints/seed/data/demo/posts.json:774`
  - `src/endpoints/seed/data/demo/posts.json:838`
  - `src/endpoints/seed/data/demo/posts.json:2433`
  - `src/endpoints/seed/data/demo/posts.json:2628`
  - `src/app/(frontend)/posts/[slug]/page.tsx:110`
- Decision: Keep the disclaimer seed-content-owned instead of hardcoding it into the public blog template. Add a demo-content disclaimer as the first rich-text block of every demo seed blog post in both locales, and prefix demo seed post titles and meta titles with `[Demo]`, so seeded blog content is visibly marked as sample content in cards, article headings, metadata, and article body.
- GitHub tracking: findmydoc-platform/website#1302, findmydoc-platform/website#1303
- Implemented in:
  - `src/app/(frontend)/posts/[slug]/page.tsx`
  - `src/endpoints/seed/data/demo/posts.json`
- Remaining follow-up: Review whether individual demo post body content should still be softened after the disclaimer, especially recommendation-like medical phrasing.

### R7. Storybook and fixture copies of red trust claims

- Severity: `5/10`
- Notion category: red as reusable/demo claim material, even if not production route content
- Status: Solved in `findmydoc-platform/website#1305`
- Problem: Stories and fixtures repeat TÜV, satisfaction rate, certified clinics, verification badges, public reviews, and before/after examples.
- Impact: Not production-critical by itself, but these fixtures can leak into screenshots, QA acceptance, future copy, and implementation examples.
- Current references:
  - `src/stories/fixtures/listings.ts:82`
  - `src/stories/fixtures/listings.ts:86`
  - `src/stories/fixtures/listings.ts:87`
  - `src/stories/fixtures/listings.ts:89`
  - `src/stories/fixtures/clinicDetail.ts:90`
  - `src/stories/fixtures/clinicDetail.ts:91`
  - `src/stories/templates/prototypes/ListingSpecialtyConceptsInternetInListing.stories.tsx:292`
  - `src/utilities/placeholders/listingComparison.ts:45`
- Decision: Keep product/runtime functionality unchanged and neutralize only Storybook-visible story and fixture copy. Keep visual sample data in Storybook, including ratings, rating filters, verification badge variants, review examples, and before/after gallery examples, because those states are needed for visual QA. The public runtime rating/review decision remains tracked in R3/R4.
- Implemented approach:
  - Replace TÜV, satisfaction, certified, trusted, verified-profile, accreditation, top-rated, and outcome-style Storybook copy with clinic-provided profile, listed service, direct contact, structured information, and demo-layout wording.
  - Keep rating values, review counts, rating filters, rating sorting, verification badge variants, clinic detail reviews, and before/after gallery fixtures visible in Storybook.
  - Update play assertions only where fixture text changed, so story coverage still exercises the same visual states and interactions.
  - Leave hardcoded runtime labels such as `Verified review` untouched in this R7 PR; those remain part of R3/R4 product/runtime decisions.
- GitHub tracking: findmydoc-platform/website#1304
- Implemented in:
  - `src/stories/fixtures/listings.ts`
  - `src/stories/fixtures/clinicDetail.ts`
  - `src/stories/fixtures/holdingPageConcepts.ts`
  - `src/stories/fixtures/landingProcess.ts`
  - `src/stories/templates/ListingComparison.stories.tsx`
  - `src/stories/templates/ClinicDetailConcepts.stories.tsx`
  - `src/stories/templates/prototypes/ListingSpecialtyConceptsInternetInListing.stories.tsx`
  - additional story copy surfaces under `src/stories/**`
- Out of scope for this story-only PR:
  - `src/utilities/placeholders/listingComparison.ts:45` remains a runtime placeholder/reference and should be handled with R1/R3/R5 runtime decisions rather than this R7 Storybook cleanup.

## Yellow Findings

### Y1. Landing and partner copy uses verified/trusted/trust-signal language

- Severity: `7/10`
- Notion category: yellow
- Status: Step 1 solved; copy decision still needed
- Problem: Landing content uses `trusted`, `verified clinics`, `trust signals`, `verified profiles`, `verified qualifications`, and similar trust terms.
- Impact: These claims need documented evidence or must be rewritten into green-safe wording.
- Current references:
  - `src/endpoints/seed/data/baseline/globals.json:160`
  - `src/endpoints/seed/data/baseline/globals.json:164`
  - `src/endpoints/seed/data/baseline/globals.json:175`
  - `src/endpoints/seed/data/baseline/globals.json:177`
  - `src/endpoints/seed/data/baseline/globals.json:189`
  - `src/endpoints/seed/data/baseline/globals.json:193`
  - `src/endpoints/seed/data/baseline/globals.json:197`
  - `src/endpoints/seed/data/baseline/globals.json:200`
  - `src/endpoints/seed/data/baseline/globals.json:222`
  - `src/endpoints/seed/data/baseline/globals.json:238`
  - `src/endpoints/seed/data/baseline/globals.json:239`
  - `src/endpoints/seed/data/baseline/globals.json:240`
  - `src/endpoints/seed/data/baseline/globals.json:245`
  - `src/endpoints/seed/data/baseline/globals.json:256`
  - `src/endpoints/seed/data/baseline/globals.json:288`
  - `src/endpoints/seed/data/baseline/globals.json:291`
  - `src/endpoints/seed/data/baseline/globals.json:292`
  - `src/endpoints/seed/data/baseline/globals.json:297`
  - `src/endpoints/seed/data/baseline/globals.json:300`
  - `src/endpoints/seed/data/baseline/globals.json:308`
  - `src/endpoints/seed/data/baseline/globals.json:321`
  - `src/endpoints/seed/data/baseline/globals.json:337`
  - `src/endpoints/seed/data/baseline/globals.json:338`
  - `src/endpoints/seed/data/baseline/globals.json:339`
  - `src/endpoints/seed/data/baseline/globals.json:344`
  - `src/endpoints/seed/data/baseline/globals.json:449`
  - `src/endpoints/seed/data/baseline/globals.json:451`
  - `src/endpoints/seed/data/baseline/globals.json:457`
  - `src/endpoints/seed/data/baseline/globals.json:467`
  - `src/endpoints/seed/data/baseline/globals.json:473`
  - `src/endpoints/seed/data/baseline/globals.json:543`
- Step 1 decision: Remove the static TypeScript fallback from `landingPageContent.ts` before editing Y1 copy, so homepage and `/partners/clinics` use the seeded `landingPages` global as the auditable content source.
- Follow-up decision: Move the remaining landing intro headings into the `landingPages` global as seed-owned content, so all visible landing copy is sourced from the seed/global rather than hardcoded utility text.
- GitHub tracking: findmydoc-platform/website#1306, findmydoc-platform/website#1307
- Implemented approach:
  - Remove `DEFAULT_LANDING_PAGE_GLOBAL` and fallback normalization that substituted empty strings, empty arrays, or missing sections with embedded TypeScript copy.
  - Make missing `landingPages` global, missing required sections, missing required arrays, missing populated media, and unsafe CTA links fail fast with explicit errors.
  - Keep baseline landing copy as the single auditable source for homepage and partner landing content; Y1 wording decisions remain separate.
  - Update tests to derive landing fixtures from the baseline seed data through a shared test helper and keep test media attached locally.
- Decision needed: define evidence source or replace with neutral comparison/platform copy, sentence by sentence in the baseline `landingPages` seed.

#### Y1 Seed Approval Table

- Decision values to fill: `Approved` or `Needs review`.
- Scope: lines from `src/endpoints/seed/data/baseline/globals.json` under `landingPages` that the landing routes consume.
- Included kinds: public text, pricing data, CTA link, visual/media IDs, and technical/display values used by rendering.
- Excluded: `team.socials` placeholder values because they are sanitized and not rendered; empty subtitles because the normalizer drops them.

| Decision | Line                                                | Area            | Kind              | Seed field                                         | Current value                                                                                                                                                                                                                                                                                            |
| -------- | --------------------------------------------------- | --------------- | ----------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:159` | Home            | Public text       | `home.seo.title`                                   | Gain International Patients \| Global Clinic Visibility Platform                                                                                                                                                                                                                                         |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:160` | Home            | Public text       | `home.seo.description`                             | Gain international patients through a trusted comparison platform. Increase clinic reach, visibility, and qualified global patient inquiries.                                                                                                                                                            |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:163` | Home            | Public text       | `home.hero.title`                                  | Clinic Comparison Turkey for Aesthetic Treatments                                                                                                                                                                                                                                                        |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:164` | Home            | Public text       | `home.hero.description`                            | Compare selected aesthetic clinics in Turkey in a transparent and structured way. Our platform helps you understand treatment options, review clinic information and contact clinics directly with confidence.                                                                                           |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:165` | Home            | Visual/media      | `home.hero.imageStableId`                          | landing-home-hero-telemedicine                                                                                                                                                                                                                                                                           |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:169` | Home            | Public text       | `home.testimonials.0.quote`                        | The platform makes treatment research easier by structuring clinic details around what patients need before deciding.                                                                                                                                                                                    |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:170` | Home            | Public text       | `home.testimonials.0.author`                       | Maya Bennett                                                                                                                                                                                                                                                                                             |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:171` | Home            | Public text       | `home.testimonials.0.role`                         | Digital Health Research Advisor                                                                                                                                                                                                                                                                          |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:172` | Home            | Visual/media      | `home.testimonials.0.imageStableId`                | landing-testimonial-home-maya-bennett                                                                                                                                                                                                                                                                    |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:175` | Home            | Public text       | `home.testimonials.1.quote`                        | I appreciate how trust signals are integrated into the comparison flow instead of being hidden in long profile text.                                                                                                                                                                                     |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:176` | Home            | Public text       | `home.testimonials.1.author`                       | Daniel Ortega                                                                                                                                                                                                                                                                                            |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:177` | Home            | Public text       | `home.testimonials.1.role`                         | Healthcare UX Reviewer                                                                                                                                                                                                                                                                                   |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:178` | Home            | Visual/media      | `home.testimonials.1.imageStableId`                | landing-testimonial-home-daniel-ortega                                                                                                                                                                                                                                                                   |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:181` | Home            | Public text       | `home.testimonials.2.quote`                        | For users planning treatment abroad, the direct contact step is clear, practical, and aligned with real decision journeys.                                                                                                                                                                               |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:182` | Home            | Public text       | `home.testimonials.2.author`                       | Sophie Klein                                                                                                                                                                                                                                                                                             |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:183` | Home            | Public text       | `home.testimonials.2.role`                         | International Care Pathway Consultant                                                                                                                                                                                                                                                                    |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:184` | Home            | Visual/media      | `home.testimonials.2.imageStableId`                | landing-testimonial-home-sophie-klein                                                                                                                                                                                                                                                                    |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:188` | Home            | Public text       | `home.testimonialsIntro.title`                     | Expert feedback                                                                                                                                                                                                                                                                                          |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:189` | Home            | Public text       | `home.testimonialsIntro.description`               | Perspectives from healthcare and product experts who reviewed the patient decision flow.                                                                                                                                                                                                                 |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:192` | Home            | Public text       | `home.categoriesIntro.title`                       | Categories                                                                                                                                                                                                                                                                                               |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:193` | Home            | Public text       | `home.categoriesIntro.description`                 | Explore verified clinics by specialty and compare the best options for your needs.                                                                                                                                                                                                                       |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:196` | Home            | Public text       | `home.features.title`                              | Benefits for Patients                                                                                                                                                                                                                                                                                    |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:197` | Home            | Public text       | `home.features.description`                        | Compare verified clinics for dental care, hair transplants, and aesthetic treatments with clear trust signals and transparent profile data.                                                                                                                                                              |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:200` | Home            | Public text       | `home.features.items.0.title`                      | Qualified Leads                                                                                                                                                                                                                                                                                          |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:202` | Home            | Public text       | `home.features.items.0.description`                | Compare aesthetic clinics based on treatments, specializations and qualifications. All information is presented clearly to support informed decision making.                                                                                                                                             |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:203` | Home            | Technical/display | `home.features.items.0.icon`                       | checkCircle                                                                                                                                                                                                                                                                                              |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:206` | Home            | Public text       | `home.features.items.1.title`                      | Reputation Boost                                                                                                                                                                                                                                                                                         |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:208` | Home            | Public text       | `home.features.items.1.description`                | Clinics create and manage their own profiles and provide relevant qualifications according to their aesthetic services. This ensures reliable and comparable information.                                                                                                                                |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:209` | Home            | Technical/display | `home.features.items.1.icon`                       | trendingUp                                                                                                                                                                                                                                                                                               |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:212` | Home            | Public text       | `home.features.items.2.title`                      | Visibility Increase                                                                                                                                                                                                                                                                                      |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:214` | Home            | Public text       | `home.features.items.2.description`                | Patients contact clinics directly without intermediaries, obligations or hidden fees.                                                                                                                                                                                                                    |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:215` | Home            | Technical/display | `home.features.items.2.icon`                       | eye                                                                                                                                                                                                                                                                                                      |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:218` | Home            | Visual/media      | `home.features.backgroundImageStableId`            | landing-home-feature-background                                                                                                                                                                                                                                                                          |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:221` | Home            | Public text       | `home.process.title`                               | How It Works for Patients                                                                                                                                                                                                                                                                                |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:222` | Home            | Public text       | `home.process.subtitle`                            | A transparent onboarding flow from profile setup to verified visibility and direct patient inquiries.                                                                                                                                                                                                    |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:225` | Home            | Technical/display | `home.process.steps.0.step`                        | 1                                                                                                                                                                                                                                                                                                        |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:226` | Home            | Public text       | `home.process.steps.0.title`                       | Reach Out                                                                                                                                                                                                                                                                                                |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:227` | Home            | Public text       | `home.process.steps.0.description`                 | You contact us and receive a clear overview of how the platform works, including visibility options, regions, and patient demand.                                                                                                                                                                        |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:228` | Home            | Visual/media      | `home.process.steps.0.imageStableId`               | landing-process-reach-out                                                                                                                                                                                                                                                                                |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:231` | Home            | Technical/display | `home.process.steps.1.step`                        | 2                                                                                                                                                                                                                                                                                                        |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:232` | Home            | Public text       | `home.process.steps.1.title`                       | Finalize Profile                                                                                                                                                                                                                                                                                         |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:233` | Home            | Public text       | `home.process.steps.1.description`                 | Clinics create and manage their own profiles. This ensures full control over medical information, treatments offered, languages, expertise, and international patient services presented clearly for patient comparison.                                                                                 |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:234` | Home            | Visual/media      | `home.process.steps.1.imageStableId`               | landing-process-create-profile                                                                                                                                                                                                                                                                           |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:237` | Home            | Technical/display | `home.process.steps.2.step`                        | 3                                                                                                                                                                                                                                                                                                        |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:238` | Home            | Public text       | `home.process.steps.2.title`                       | Verification & Quality Check                                                                                                                                                                                                                                                                             |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:239` | Home            | Public text       | `home.process.steps.2.description`                 | Clinics are required to provide relevant qualifications and certifications according to their medical services. This verification process ensures credibility, transparency, and a high-quality environment for international patients.                                                                  |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:240` | Home            | Visual/media      | `home.process.steps.2.imageStableId`               | landing-process-verification                                                                                                                                                                                                                                                                             |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:243` | Home            | Technical/display | `home.process.steps.3.step`                        | 4                                                                                                                                                                                                                                                                                                        |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:244` | Home            | Public text       | `home.process.steps.3.title`                       | Connect with Patients                                                                                                                                                                                                                                                                                    |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:245` | Home            | Public text       | `home.process.steps.3.description`                 | Qualified international patients contact your clinic directly through the platform, ready to discuss treatments, and next steps.                                                                                                                                                                         |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:246` | Home            | Visual/media      | `home.process.steps.3.imageStableId`               | landing-home-process-connect-patients                                                                                                                                                                                                                                                                    |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:251` | Home            | Public text       | `home.faq.title`                                   | FAQ                                                                                                                                                                                                                                                                                                      |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:252` | Home            | Public text       | `home.faq.description`                             | This section answers the most common questions clinics and medical networks have about gaining international patients through our comparison platform.                                                                                                                                                   |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:255` | Home            | Public text       | `home.faq.items.0.question`                        | How does this platform help clinics gain international patients?                                                                                                                                                                                                                                         |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:256` | Home            | Public text       | `home.faq.items.0.answer`                          | By combining global visibility, patient guidance, and quality-focused clinic presentation in one trusted comparison environment.                                                                                                                                                                         |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:259` | Home            | Public text       | `home.faq.items.1.question`                        | Are the patient inquiries exclusive?                                                                                                                                                                                                                                                                     |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:260` | Home            | Public text       | `home.faq.items.1.answer`                          | Inquiries are handled according to your clinic profile settings and availability.                                                                                                                                                                                                                        |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:263` | Home            | Public text       | `home.faq.items.2.question`                        | Which countries and regions are covered?                                                                                                                                                                                                                                                                 |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:264` | Home            | Public text       | `home.faq.items.2.answer`                          | Coverage depends on active campaigns and regional demand at the time of listing.                                                                                                                                                                                                                         |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:267` | Home            | Public text       | `home.faq.items.3.question`                        | Is this platform suitable for clinic groups and networks?                                                                                                                                                                                                                                                |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:268` | Home            | Public text       | `home.faq.items.3.answer`                          | Yes. Groups can maintain consistent branding while showcasing individual locations.                                                                                                                                                                                                                      |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:271` | Home            | Public text       | `home.faq.items.4.question`                        | Are patient inquiries focused on Europe?                                                                                                                                                                                                                                                                 |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:272` | Home            | Public text       | `home.faq.items.4.answer`                          | Demand is strongest across Europe, but can include other regions depending on campaigns.                                                                                                                                                                                                                 |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:277` | Home            | Public text       | `home.blogTeaser.title`                            | From our blog                                                                                                                                                                                                                                                                                            |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:278` | Home            | Public text       | `home.blogTeaser.description`                      | Explore practical insights, expert perspectives, and the latest topics across health and medicine.                                                                                                                                                                                                       |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:281` | Home            | Public text       | `home.contact.title`                               | Contact                                                                                                                                                                                                                                                                                                  |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:282` | Home            | Public text       | `home.contact.description`                         | Planning treatment abroad? Share your goals and we will help you find relevant clinics and next steps with confidence.                                                                                                                                                                                   |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:287` | Clinic partners | Public text       | `clinicPartners.seo.title`                         | For Partner Clinics \| findmydoc                                                                                                                                                                                                                                                                         |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:288` | Clinic partners | Public text       | `clinicPartners.seo.description`                   | Increase your clinic’s international reach and connect with qualified patients worldwide. Our comparison platform helps clinics, medical networks, and international patient departments gain visibility, trust, and high-intent inquiries - globally and sustainably.                                   |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:291` | Clinic partners | Public text       | `clinicPartners.hero.title`                        | Gain International Patients Through a Trusted Global Clinic Platform                                                                                                                                                                                                                                     |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:292` | Clinic partners | Public text       | `clinicPartners.hero.description`                  | Increase your clinic’s international reach and connect with qualified patients worldwide. Our comparison platform helps clinics, medical networks, and international patient departments gain visibility, trust, and high-intent inquiries - globally and sustainably.                                   |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:293` | Clinic partners | Visual/media      | `clinicPartners.hero.imageStableId`                | landing-clinic-partner-hero-turkey-tablet                                                                                                                                                                                                                                                                |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:296` | Clinic partners | Public text       | `clinicPartners.features.title`                    | Features                                                                                                                                                                                                                                                                                                 |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:297` | Clinic partners | Public text       | `clinicPartners.features.description`              | Increase your clinic’s visibility, attract qualified patients, and grow internationally through transparent, verified profiles.                                                                                                                                                                          |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:300` | Clinic partners | Public text       | `clinicPartners.features.items.0.title`            | Qualified Leads                                                                                                                                                                                                                                                                                          |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:301` | Clinic partners | Public text       | `clinicPartners.features.items.0.subtitle`         | Easy & Robust                                                                                                                                                                                                                                                                                            |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:302` | Clinic partners | Public text       | `clinicPartners.features.items.0.description`      | Receive patient inquiries from users actively comparing clinics and treatments. Only relevant and treatment focused leads.                                                                                                                                                                               |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:303` | Clinic partners | Technical/display | `clinicPartners.features.items.0.icon`             | target                                                                                                                                                                                                                                                                                                   |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:306` | Clinic partners | Public text       | `clinicPartners.features.items.1.title`            | Reputation Boost                                                                                                                                                                                                                                                                                         |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:307` | Clinic partners | Public text       | `clinicPartners.features.items.1.subtitle`         | Huge Collection                                                                                                                                                                                                                                                                                          |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:308` | Clinic partners | Public text       | `clinicPartners.features.items.1.description`      | Strengthen your clinic’s credibility through verified qualifications and transparent profiles that build trust with international patients.                                                                                                                                                              |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:309` | Clinic partners | Technical/display | `clinicPartners.features.items.1.icon`             | trendingUp                                                                                                                                                                                                                                                                                               |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:312` | Clinic partners | Public text       | `clinicPartners.features.items.2.title`            | Visibility Increase                                                                                                                                                                                                                                                                                      |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:313` | Clinic partners | Public text       | `clinicPartners.features.items.2.subtitle`         | Responsive & Retina                                                                                                                                                                                                                                                                                      |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:314` | Clinic partners | Public text       | `clinicPartners.features.items.2.description`      | Increase your clinic’s visibility where international patients search, compare and decide across the DACH region.                                                                                                                                                                                        |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:315` | Clinic partners | Technical/display | `clinicPartners.features.items.2.icon`             | eye                                                                                                                                                                                                                                                                                                      |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:320` | Clinic partners | Public text       | `clinicPartners.process.title`                     | Our Process                                                                                                                                                                                                                                                                                              |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:321` | Clinic partners | Public text       | `clinicPartners.process.subtitle`                  | A transparent onboarding flow from profile setup to verified visibility and direct patient inquiries.                                                                                                                                                                                                    |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:324` | Clinic partners | Technical/display | `clinicPartners.process.steps.0.step`              | 1                                                                                                                                                                                                                                                                                                        |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:325` | Clinic partners | Public text       | `clinicPartners.process.steps.0.title`             | Reach Out                                                                                                                                                                                                                                                                                                |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:326` | Clinic partners | Public text       | `clinicPartners.process.steps.0.description`       | You contact us and receive a clear overview of how the platform works, including visibility options, regions, and patient demand.                                                                                                                                                                        |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:327` | Clinic partners | Visual/media      | `clinicPartners.process.steps.0.imageStableId`     | landing-partner-process-reach-out                                                                                                                                                                                                                                                                        |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:330` | Clinic partners | Technical/display | `clinicPartners.process.steps.1.step`              | 2                                                                                                                                                                                                                                                                                                        |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:331` | Clinic partners | Public text       | `clinicPartners.process.steps.1.title`             | Finalize Profile                                                                                                                                                                                                                                                                                         |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:332` | Clinic partners | Public text       | `clinicPartners.process.steps.1.description`       | Clinics create and manage their own profiles. This ensures full control over medical information, treatments offered, languages, expertise, and international patient services presented clearly for patient comparison.                                                                                 |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:333` | Clinic partners | Visual/media      | `clinicPartners.process.steps.1.imageStableId`     | landing-process-create-profile                                                                                                                                                                                                                                                                           |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:336` | Clinic partners | Technical/display | `clinicPartners.process.steps.2.step`              | 3                                                                                                                                                                                                                                                                                                        |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:337` | Clinic partners | Public text       | `clinicPartners.process.steps.2.title`             | Verification & Quality Check                                                                                                                                                                                                                                                                             |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:338` | Clinic partners | Public text       | `clinicPartners.process.steps.2.description`       | Clinics are required to provide relevant qualifications and certifications according to their medical services. This verification process ensures credibility, transparency, and a high-quality environment for international patients.                                                                  |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:339` | Clinic partners | Visual/media      | `clinicPartners.process.steps.2.imageStableId`     | landing-partner-process-verification                                                                                                                                                                                                                                                                     |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:342` | Clinic partners | Technical/display | `clinicPartners.process.steps.3.step`              | 4                                                                                                                                                                                                                                                                                                        |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:343` | Clinic partners | Public text       | `clinicPartners.process.steps.3.title`             | Connect with Patients                                                                                                                                                                                                                                                                                    |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:344` | Clinic partners | Public text       | `clinicPartners.process.steps.3.description`       | Qualified international patients contact your clinic directly through the platform, ready to discuss treatments, and next steps.                                                                                                                                                                         |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:345` | Clinic partners | Visual/media      | `clinicPartners.process.steps.3.imageStableId`     | landing-partner-process-connect-patients                                                                                                                                                                                                                                                                 |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:350` | Clinic partners | Public text       | `clinicPartners.categoriesIntro.title`             | Our Categories                                                                                                                                                                                                                                                                                           |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:351` | Clinic partners | Public text       | `clinicPartners.categoriesIntro.description`       | Showcase your clinic under the categories patients search most.                                                                                                                                                                                                                                          |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:354` | Clinic partners | Public text       | `clinicPartners.cta.title`                         | Let’s work together                                                                                                                                                                                                                                                                                      |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:355` | Clinic partners | Public text       | `clinicPartners.cta.buttonText`                    | Contact us                                                                                                                                                                                                                                                                                               |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:357` | Clinic partners | Technical/display | `clinicPartners.cta.link.type`                     | custom                                                                                                                                                                                                                                                                                                   |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:358` | Clinic partners | Technical/display | `clinicPartners.cta.link.newTab`                   | false                                                                                                                                                                                                                                                                                                    |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:359` | Clinic partners | CTA link          | `clinicPartners.cta.link.url`                      | /contact                                                                                                                                                                                                                                                                                                 |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:364` | Clinic partners | Public text       | `clinicPartners.team.0.name`                       | Volkan Kablan                                                                                                                                                                                                                                                                                            |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:365` | Clinic partners | Public text       | `clinicPartners.team.0.role`                       | CFO                                                                                                                                                                                                                                                                                                      |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:366` | Clinic partners | Technical/display | `clinicPartners.team.0.isPhoto`                    | true                                                                                                                                                                                                                                                                                                     |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:367` | Clinic partners | Technical/display | `clinicPartners.team.0.photoDisplay`               | original                                                                                                                                                                                                                                                                                                 |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:375` | Clinic partners | Visual/media      | `clinicPartners.team.0.imageStableId`              | landing-team-volkan-kablan                                                                                                                                                                                                                                                                               |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:378` | Clinic partners | Public text       | `clinicPartners.team.1.name`                       | Youssef Adlah                                                                                                                                                                                                                                                                                            |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:379` | Clinic partners | Public text       | `clinicPartners.team.1.role`                       | CMO                                                                                                                                                                                                                                                                                                      |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:380` | Clinic partners | Technical/display | `clinicPartners.team.1.isPhoto`                    | true                                                                                                                                                                                                                                                                                                     |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:381` | Clinic partners | Technical/display | `clinicPartners.team.1.photoDisplay`               | original                                                                                                                                                                                                                                                                                                 |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:389` | Clinic partners | Visual/media      | `clinicPartners.team.1.imageStableId`              | landing-team-youssef-adlah                                                                                                                                                                                                                                                                               |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:392` | Clinic partners | Public text       | `clinicPartners.team.2.name`                       | Anil Gökduman                                                                                                                                                                                                                                                                                            |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:393` | Clinic partners | Public text       | `clinicPartners.team.2.role`                       | CPO                                                                                                                                                                                                                                                                                                      |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:394` | Clinic partners | Technical/display | `clinicPartners.team.2.isPhoto`                    | true                                                                                                                                                                                                                                                                                                     |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:402` | Clinic partners | Visual/media      | `clinicPartners.team.2.imageStableId`              | landing-team-anil-goekduman                                                                                                                                                                                                                                                                              |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:405` | Clinic partners | Public text       | `clinicPartners.team.3.name`                       | Özen Günes                                                                                                                                                                                                                                                                                               |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:406` | Clinic partners | Public text       | `clinicPartners.team.3.role`                       | CLO                                                                                                                                                                                                                                                                                                      |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:407` | Clinic partners | Technical/display | `clinicPartners.team.3.isPhoto`                    | true                                                                                                                                                                                                                                                                                                     |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:415` | Clinic partners | Visual/media      | `clinicPartners.team.3.imageStableId`              | landing-team-oezen-guenes                                                                                                                                                                                                                                                                                |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:418` | Clinic partners | Public text       | `clinicPartners.team.4.name`                       | Sebastian Schütze                                                                                                                                                                                                                                                                                        |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:419` | Clinic partners | Public text       | `clinicPartners.team.4.role`                       | CTO                                                                                                                                                                                                                                                                                                      |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:420` | Clinic partners | Technical/display | `clinicPartners.team.4.isPhoto`                    | true                                                                                                                                                                                                                                                                                                     |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:428` | Clinic partners | Visual/media      | `clinicPartners.team.4.imageStableId`              | landing-team-sebastian-schuetze                                                                                                                                                                                                                                                                          |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:432` | Clinic partners | Public text       | `clinicPartners.teamIntro.title`                   | Our Team                                                                                                                                                                                                                                                                                                 |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:433` | Clinic partners | Public text       | `clinicPartners.teamIntro.description`             | We are a multidisciplinary team with backgrounds in healthcare, international patient management, medical marketing, and platform technology. Our focus is simple: helping clinics gain international patients in a sustainable, ethical, and measurable way.                                            |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:437` | Clinic partners | Public text       | `clinicPartners.testimonials.0.quote`              | The clinic onboarding model is well structured and sets clear expectations for profile quality and international visibility.                                                                                                                                                                             |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:438` | Clinic partners | Public text       | `clinicPartners.testimonials.0.author`             | Alex Morgan                                                                                                                                                                                                                                                                                              |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:439` | Clinic partners | Public text       | `clinicPartners.testimonials.0.role`               | Clinic Growth Advisor                                                                                                                                                                                                                                                                                    |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:440` | Clinic partners | Visual/media      | `clinicPartners.testimonials.0.imageStableId`      | landing-testimonial-partners-alex-morgan                                                                                                                                                                                                                                                                 |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:443` | Clinic partners | Public text       | `clinicPartners.testimonials.1.quote`              | I like that the positioning is not lead-reselling but direct patient contact supported by transparent clinic information.                                                                                                                                                                                |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:444` | Clinic partners | Public text       | `clinicPartners.testimonials.1.author`             | Nina Feld                                                                                                                                                                                                                                                                                                |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:445` | Clinic partners | Public text       | `clinicPartners.testimonials.1.role`               | International Patient Services Consultant                                                                                                                                                                                                                                                                |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:446` | Clinic partners | Visual/media      | `clinicPartners.testimonials.1.imageStableId`      | landing-testimonial-partners-nina-feld                                                                                                                                                                                                                                                                   |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:449` | Clinic partners | Public text       | `clinicPartners.testimonials.2.quote`              | From an operations perspective, the process is practical: present verified strengths, compare clearly, and move into qualified conversations.                                                                                                                                                            |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:450` | Clinic partners | Public text       | `clinicPartners.testimonials.2.author`             | Robert Hayes                                                                                                                                                                                                                                                                                             |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:451` | Clinic partners | Public text       | `clinicPartners.testimonials.2.role`               | Healthcare Operations Reviewer                                                                                                                                                                                                                                                                           |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:452` | Clinic partners | Visual/media      | `clinicPartners.testimonials.2.imageStableId`      | landing-testimonial-partners-robert-hayes                                                                                                                                                                                                                                                                |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:456` | Clinic partners | Public text       | `clinicPartners.testimonialsIntro.title`           | Testimonials                                                                                                                                                                                                                                                                                             |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:457` | Clinic partners | Public text       | `clinicPartners.testimonialsIntro.description`     | Feedback from healthcare and clinic growth experts who reviewed the partner onboarding and visibility model.                                                                                                                                                                                             |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:460` | Clinic partners | Public text       | `clinicPartners.pricing.title`                     | Pricing                                                                                                                                                                                                                                                                                                  |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:461` | Clinic partners | Public text       | `clinicPartners.pricing.description`               | Choose the monthly tier that matches your growth stage. Performance-based commission and optional add-ons sit alongside the subscription model.                                                                                                                                                          |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:464` | Clinic partners | Pricing data      | `clinicPartners.pricing.plans.0.price`             | EUR 199                                                                                                                                                                                                                                                                                                  |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:465` | Clinic partners | Pricing data      | `clinicPartners.pricing.plans.0.billingLabel`      | / month                                                                                                                                                                                                                                                                                                  |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:466` | Clinic partners | Public text       | `clinicPartners.pricing.plans.0.plan`              | Premium                                                                                                                                                                                                                                                                                                  |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:467` | Clinic partners | Public text       | `clinicPartners.pricing.plans.0.description`       | For clinics that want stronger category visibility, a more competitive profile presence, and a reliable stream of qualified international inquiries.                                                                                                                                                     |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:470` | Clinic partners | Public text       | `clinicPartners.pricing.plans.0.highlights.0.text` | Priority profile visibility                                                                                                                                                                                                                                                                              |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:473` | Clinic partners | Public text       | `clinicPartners.pricing.plans.0.highlights.1.text` | Enhanced trust and profile depth                                                                                                                                                                                                                                                                         |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:476` | Clinic partners | Public text       | `clinicPartners.pricing.plans.0.highlights.2.text` | Built for clinics scaling inbound demand                                                                                                                                                                                                                                                                 |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:479` | Clinic partners | Public text       | `clinicPartners.pricing.plans.0.buttonText`        | Choose Premium                                                                                                                                                                                                                                                                                           |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:480` | Clinic partners | Public text       | `clinicPartners.pricing.plans.0.badge`             | Most popular                                                                                                                                                                                                                                                                                             |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:481` | Clinic partners | Technical/display | `clinicPartners.pricing.plans.0.layout`            | primary                                                                                                                                                                                                                                                                                                  |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:484` | Clinic partners | Pricing data      | `clinicPartners.pricing.plans.1.price`             | EUR 349                                                                                                                                                                                                                                                                                                  |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:485` | Clinic partners | Pricing data      | `clinicPartners.pricing.plans.1.billingLabel`      | / month                                                                                                                                                                                                                                                                                                  |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:486` | Clinic partners | Public text       | `clinicPartners.pricing.plans.1.plan`              | Pro                                                                                                                                                                                                                                                                                                      |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:487` | Clinic partners | Public text       | `clinicPartners.pricing.plans.1.description`       | For established clinics and networks that need the strongest presentation, highest visibility, and a structure ready for more active international growth.                                                                                                                                               |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:490` | Clinic partners | Public text       | `clinicPartners.pricing.plans.1.highlights.0.text` | Highest visibility tier                                                                                                                                                                                                                                                                                  |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:493` | Clinic partners | Public text       | `clinicPartners.pricing.plans.1.highlights.1.text` | Best fit for multi-market growth                                                                                                                                                                                                                                                                         |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:496` | Clinic partners | Public text       | `clinicPartners.pricing.plans.1.highlights.2.text` | Designed for advanced partner collaboration                                                                                                                                                                                                                                                              |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:499` | Clinic partners | Public text       | `clinicPartners.pricing.plans.1.buttonText`        | Talk to us about Pro                                                                                                                                                                                                                                                                                     |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:500` | Clinic partners | Technical/display | `clinicPartners.pricing.plans.1.layout`            | primary                                                                                                                                                                                                                                                                                                  |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:503` | Clinic partners | Pricing data      | `clinicPartners.pricing.plans.2.price`             | EUR 99                                                                                                                                                                                                                                                                                                   |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:504` | Clinic partners | Pricing data      | `clinicPartners.pricing.plans.2.billingLabel`      | / month                                                                                                                                                                                                                                                                                                  |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:505` | Clinic partners | Public text       | `clinicPartners.pricing.plans.2.plan`              | Basic                                                                                                                                                                                                                                                                                                    |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:506` | Clinic partners | Public text       | `clinicPartners.pricing.plans.2.description`       | A focused entry plan for clinics that want to get listed, present core strengths clearly, and start testing international demand without a heavy commitment.                                                                                                                                             |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:509` | Clinic partners | Public text       | `clinicPartners.pricing.plans.2.highlights.0.text` | Lean monthly entry point                                                                                                                                                                                                                                                                                 |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:512` | Clinic partners | Public text       | `clinicPartners.pricing.plans.2.highlights.1.text` | Clear profile presence                                                                                                                                                                                                                                                                                   |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:515` | Clinic partners | Public text       | `clinicPartners.pricing.plans.2.highlights.2.text` | Good fit for first traction                                                                                                                                                                                                                                                                              |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:518` | Clinic partners | Public text       | `clinicPartners.pricing.plans.2.buttonText`        | Start with Basic                                                                                                                                                                                                                                                                                         |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:519` | Clinic partners | Technical/display | `clinicPartners.pricing.plans.2.layout`            | compact                                                                                                                                                                                                                                                                                                  |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:525` | Clinic partners | Public text       | `clinicPartners.pricingModel.0.title`              | Monthly subscription tiers                                                                                                                                                                                                                                                                               |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:526` | Clinic partners | Public text       | `clinicPartners.pricingModel.0.description`        | Basic, Premium, and Pro cover ongoing visibility, profile management, and partner presence.                                                                                                                                                                                                              |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:529` | Clinic partners | Public text       | `clinicPartners.pricingModel.1.title`              | Performance-based commission                                                                                                                                                                                                                                                                             |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:530` | Clinic partners | Public text       | `clinicPartners.pricingModel.1.description`        | A variable fee can apply on successful patient cases, separate from the monthly subscription.                                                                                                                                                                                                            |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:533` | Clinic partners | Public text       | `clinicPartners.pricingModel.2.title`              | Optional add-ons                                                                                                                                                                                                                                                                                         |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:534` | Clinic partners | Public text       | `clinicPartners.pricingModel.2.description`        | Extra visibility or support modules can be added without bloating the base pricing cards.                                                                                                                                                                                                                |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:538` | Clinic partners | Public text       | `clinicPartners.faq.title`                         | FAQ                                                                                                                                                                                                                                                                                                      |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:539` | Clinic partners | Public text       | `clinicPartners.faq.description`                   | This section answers the most common questions clinics and medical networks have about gaining international patients through our comparison platform. It provides clarity on regions, qualifications, visibility and how clinics connect with international patients across the DACH region and Europe. |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:542` | Clinic partners | Public text       | `clinicPartners.faq.items.0.question`              | How does this platform help clinics gain international patients?                                                                                                                                                                                                                                         |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:543` | Clinic partners | Public text       | `clinicPartners.faq.items.0.answer`                | By combining global visibility, patient guidance, and quality-focused clinic presentation in one trusted comparison environment.                                                                                                                                                                         |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:546` | Clinic partners | Public text       | `clinicPartners.faq.items.1.question`              | Are the patient inquiries exclusive?                                                                                                                                                                                                                                                                     |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:547` | Clinic partners | Public text       | `clinicPartners.faq.items.1.answer`                | Patients contact clinics directly. There are no resold or recycled leads.                                                                                                                                                                                                                                |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:550` | Clinic partners | Public text       | `clinicPartners.faq.items.2.question`              | Which countries and regions are covered?                                                                                                                                                                                                                                                                 |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:551` | Clinic partners | Public text       | `clinicPartners.faq.items.2.answer`                | Our primary focus is the DACH region (Germany, Austria, Switzerland), while also supporting international patient acquisition across Europe.                                                                                                                                                             |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:554` | Clinic partners | Public text       | `clinicPartners.faq.items.3.question`              | Is this platform suitable for clinic groups and networks?                                                                                                                                                                                                                                                |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:555` | Clinic partners | Public text       | `clinicPartners.faq.items.3.answer`                | Yes. We support single clinics, clinic groups, and medical networks with scalable visibility options.                                                                                                                                                                                                    |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:558` | Clinic partners | Public text       | `clinicPartners.faq.items.4.question`              | Are patient inquiries focused on Europe?                                                                                                                                                                                                                                                                 |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:559` | Clinic partners | Public text       | `clinicPartners.faq.items.4.answer`                | Most inquiries originate from patients seeking treatment within Europe, with a strong focus on the DACH region.                                                                                                                                                                                          |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:564` | Clinic partners | Public text       | `clinicPartners.blogTeaser.title`                  | From our blog                                                                                                                                                                                                                                                                                            |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:565` | Clinic partners | Public text       | `clinicPartners.blogTeaser.description`            | Explore practical insights, expert perspectives, and the latest topics across health and medicine.                                                                                                                                                                                                       |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:568` | Clinic partners | Public text       | `clinicPartners.contact.title`                     | Kontakt                                                                                                                                                                                                                                                                                                  |
| TBD      | `src/endpoints/seed/data/baseline/globals.json:569` | Clinic partners | Public text       | `clinicPartners.contact.description`               | Interested in gaining international patients and increasing your clinic’s global reach? Contact us to explore how your clinic can benefit from our international comparison platform.                                                                                                                    |

### Y2. Verification and quality-check process copy

- Severity: `7/10`
- Notion category: yellow, potentially red if used as a platform certification
- Problem: Copy states `Verification & Quality Check`, `certifications`, `verification process ensures credibility`, and `high-quality environment`.
- Impact: This reads as a findmydoc quality/verification process. Notion requires proof source, owner, type, and date for such claims.
- Current references:
  - `src/endpoints/seed/data/baseline/globals.json:218`
  - `src/endpoints/seed/data/baseline/globals.json:234`
  - `src/endpoints/seed/data/baseline/globals.json:235`
  - `src/endpoints/seed/data/baseline/globals.json:317`
  - `src/endpoints/seed/data/baseline/globals.json:333`
  - `src/endpoints/seed/data/baseline/globals.json:334`
  - `src/utilities/landing/landingPageContent.ts:173`
  - `src/utilities/landing/landingPageContent.ts:189`
  - `src/utilities/landing/landingPageContent.ts:191`
  - `src/utilities/landing/landingPageContent.ts:296`
  - `src/utilities/landing/landingPageContent.ts:298`
- Decision needed: either document the verification workflow or rewrite as clinic-provided profile information.

### Y3. Accreditations and seeded `International Health Standard`

- Severity: `7/10`
- Notion category: yellow
- Problem: Accreditations are public trust indicators, and baseline seed creates `International Health Standard` with safety/quality wording.
- Impact: `accredited` and similar certification claims require evidence. Current seed does not include proof metadata.
- Current references:
  - `src/collections/Accreditation.ts:12`
  - `src/collections/Accreditation.ts:55`
  - `src/endpoints/seed/data/baseline/accreditations.json:4`
  - `src/endpoints/seed/data/baseline/accreditations.json:20`
  - `src/components/molecules/ClinicDetail/HeroQualitySummary.tsx:54`
  - `src/components/templates/ClinicDetailConcepts/shared.tsx:92`
  - `src/endpoints/seed/data/demo/clinics.json:57`
- Decision needed: keep only externally evidenced accreditations with proof metadata, or hide from public MVP.

### Y4. Temporary Landing Mode trust language

- Severity: `6/10`
- Notion category: yellow, with red overlap for patient-review claims
- Problem: Temporary landing copy uses patient reviews, quality indicators, verified comparison, trusted comparison, and quality signals.
- Impact: This can become public when the `temporary-landing-mode` flag is active.
- Current references:
  - `src/features/temporaryLandingMode/content.ts:60`
  - `src/features/temporaryLandingMode/content.ts:67`
  - `src/features/temporaryLandingMode/content.ts:70`
  - `src/features/temporaryLandingMode/content.ts:72`
  - `src/features/temporaryLandingMode/content.ts:110`
  - `src/features/temporaryLandingMode/content.ts:117`
  - `src/features/temporaryLandingMode/content.ts:121`
  - `src/features/temporaryLandingMode/content.ts:231`
  - `src/proxy.ts:147`
- Decision needed: rewrite temporary landing to green-safe launch copy or make it explicitly preview-safe.

### Y5. Transparent pricing and reviewed prices

- Severity: `6/10`
- Notion category: yellow
- Problem: Listing and reviews mention transparent pricing and reviewed prices.
- Impact: This is allowed only when source and last-updated evidence exists.
- Current references:
  - `src/app/(frontend)/listing-comparison/page.tsx:45`
  - `src/app/(frontend)/listing-comparison/page.tsx:48`
  - `src/endpoints/seed/data/demo/reviews.json:66`
- Decision needed: add source/date evidence or soften to neutral price display wording.

### Y6. Clinic registration `verified visibility`

- Severity: `6/10`
- Notion category: yellow
- Status: CMS editability solved; rewrite needed
- Problem: Partner registration intro copy says `Ready for verified visibility?`.
- Impact: The intro is now editable in `landingPages`, but `verified` still needs softer wording unless a documented proof process exists.
- Current references:
  - `src/endpoints/seed/data/baseline/globals.json:568`
  - `src/app/(frontend)/partners/clinics/page.tsx:137`
  - `src/app/(frontend)/_components/ClinicRegistrationLandingSection.tsx:31`
- Decision: keep the current wording temporarily in `landingPages`, but rewrite it before treating the copy as final. The editable CMS slot is solved; the wording itself is still open.

### Y7. Missing required disclaimers

- Severity: `7/10`
- Notion category: yellow compliance gap; can make adjacent red/yellow findings worse
- Status: Solved in `findmydoc-platform/website#1333`
- Problem: Required Notion disclaimers were not found for platform, blog, clinic profiles, or comparison pages. The only disclaimer found was a before/after result disclaimer.
- Impact: Even green/yellow content becomes riskier without required framing.
- Current references:
  - `src/app/(frontend)/listing-comparison/page.tsx:42`
  - `src/app/(frontend)/clinics/[slug]/page.tsx:57`
  - `src/app/(frontend)/posts/[slug]/page.tsx:110`
  - `src/app/(frontend)/(pages)/[...slug]/page.tsx:68`
  - `src/components/organisms/ClinicDetail/BeforeAfterCaseGallerySection.tsx:57`
- Implemented in:
  - `src/components/molecules/DisclaimerNotice/index.tsx`
  - `src/utilities/legal/disclaimers.ts`
  - `src/app/(frontend)/posts/[slug]/page.tsx`
  - `src/components/templates/ClinicDetailConcepts/ClinicDetail.tsx`
  - `src/components/templates/ListingComparison/Component.tsx`
  - `src/components/templates/Footer/Component.tsx`
  - `src/app/(frontend)/listing-comparison/page.tsx`
  - `src/app/(frontend)/listing-comparison/ListingComparisonPage.client.tsx`
- GitHub tracking: `findmydoc-platform/website#1333`

## Green Findings / Safe Replacement Patterns

### G1. Clinic comparison and structured profiles

- Notion category: green
- Safe pattern: Compare clinics, show structured clinic profiles, and help users understand clinic-provided information.
- Current references:
  - `src/endpoints/seed/data/baseline/globals.json:164`
  - `src/endpoints/seed/data/baseline/globals.json:198`
  - `src/utilities/landing/landingPageContent.ts:153`
- Use as replacement direction: `Compare clinic information in a structured way.`

### G2. Clinic-provided profile information

- Notion category: green, if source is clear
- Safe pattern: Clinics create and manage their own profiles, including treatments, languages, services, and profile information.
- Current references:
  - `src/endpoints/seed/data/baseline/globals.json:229`
  - `src/utilities/landing/landingPageContent.ts:185`
- Use as replacement direction: `Profile information is provided by the clinic unless otherwise stated.`

### G3. Direct contact and inquiry flow

- Notion category: green
- Safe pattern: Users can contact clinics directly; clinics receive inquiries; the platform supports organization and contact, not medical advice.
- Current references:
  - `src/endpoints/seed/data/baseline/globals.json:210`
  - `src/endpoints/seed/data/baseline/globals.json:241`
  - `src/app/(frontend)/_components/ClinicRegistrationLandingSection.tsx:34`
- Use as replacement direction: `Contact clinics directly to discuss availability, pricing, and next steps.`

### G4. Transparent non-quality filters

- Notion category: green
- Safe pattern: Sorting/filtering by price, location, language, treatment, availability, or response time when transparent and source-backed.
- Current references:
  - `src/utilities/listingComparison/queryState.ts:138`
  - `src/utilities/listingComparison/sort.ts:79`
  - `src/utilities/listingComparison/serverData/pricing.ts:64`
- Use as replacement direction: keep price/location/treatment filters; remove rating/quality ranking until evidence exists.

## Open Questions

- Is there already a legally approved verification process outside the repo?
- Are public reviews intended for MVP, or are they future-state only?
- Should demo seed data be allowed to contain unsafe claims if clearly preview-only?
- Should the first fix be a hard hide of red UI elements or a copy-only neutralization?
- Where should proof metadata live if yellow claims remain: CMS fields, linked Notion records, internal docs, or external evidence attachments?
