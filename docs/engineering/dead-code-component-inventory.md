# Dead-code component inventory

[Issue #2071](https://github.com/findmydoc-platform/website/issues/2071) tracks the blocked dead-code gate. The approved cleanup retires the implementations below and removes unused export paths. Active components, structured-data builders, gallery lightbox, seeding widget, and cache-visibility card remain.

The original inventory reviewed commit `d9a92ee015e17ec7cca5af144c9effab679c5533`. Its removal decision was confirmed on 2026-10-09 and reapplied to current `origin/main`. The tables retain the original consumer evidence; paths of deleted files describe the retired implementation. References to similar active components do not imply interchangeability.

Knip 6.38.0 is installed from the unchanged locked version. Full analysis omits both `--production` and `--strict`, so tests and stories count as consumers. The separate production report uses `--production --strict --no-exit-code`: findings remain visible with exit code 0, while configuration and analysis failures still exit nonzero. No new exclusions or suppression baseline were added.

## Completed implementation removals

All source paths in the first column are under `src/components/`.

| Source and symbol | Purpose | Development consumers | Used equivalent or related implementation |
| --- | --- | --- | --- |
| `atoms/separator.tsx`: `Separator` | Horizontal or vertical separator | `src/stories/atoms/Separator.stories.tsx` | `DropdownMenuSeparator` in `src/components/templates/Header/PublicAccountMenu.tsx:188,226,228` is menu-specific, not a confirmed replacement. |
| `atoms/tabs.tsx`: `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` | Radix tab group | `src/stories/atoms/Tabs.stories.tsx` | Custom tabs in `src/components/organisms/Landing/LandingCategoriesShell.tsx:152` and `src/components/templates/AboutPage/AccountabilitySection.tsx:403` are active. Equivalence is not established. |
| `molecules/PageRange/index.tsx`: `PageRange` | Result range and empty-state text | `src/stories/molecules/PageRange.stories.tsx`, `src/stories/templates/BlogListing.stories.tsx`, `tests/unit/components/molecules.test.ts` | Result count in `src/components/templates/ListingComparison/Component.tsx:62` overlaps in purpose. Active `PostsPagination` provides page navigation, not the same range text. |
| `organisms/DeveloperDashboard/index.tsx`: `DeveloperDashboardView` | Welcome wrapper, seeding slot, documentation links | `src/stories/organisms/DeveloperDashboard.stories.tsx` | Active `src/dashboard/adminDashboard/DeveloperSeedingWidget.tsx` uses `SeedingCardAdapter.client.tsx` and `SeedingCardView`. No identical welcome wrapper is active. |
| `molecules/Breadcrumb/BreadcrumbJsonLd.tsx`: `BreadcrumbJsonLd` | Render breadcrumb structured data | `tests/unit/components/breadcrumbJsonLd.test.tsx` | Active `src/utilities/structuredData/articles.ts`, `clinics.ts`, and `itemLists.ts` use the same builder/renderer building blocks for post, clinic, and comparison routes. The wrapper is unused; those blocks remain needed. |
| `organisms/ClinicDetail/BeforeAfterCaseGallerySection.tsx`: `BeforeAfterCaseGallerySection` | Before/after cases with image-pair and reveal modes | `src/stories/templates/ClinicBeforeAfterGalleryPatterns.stories.tsx` | No active before/after replacement. `ClinicGallery` in `HeroOverviewSection.tsx:64` is a general gallery. The previous preservation decision was explicitly revoked. |

`BeforeAfterCaseGallerySection` and its exclusively local `BeforeAfterResultDisclaimer`, `BeforeAfterPair`, and `BeforeAfterRevealCompare` helpers were deleted with their dedicated story. Both before/after prototypes are retired.

The following symbols in `src/components/templates/ClinicDetailConcepts/shared.tsx` had only reexports and no product, story, or test consumer; the shared file and its unused reexports were deleted. The active `ClinicDetail.tsx` template remains needed.

| Symbol | Purpose | Active related implementation and consumer |
| --- | --- | --- |
| `ClinicTrustMetrics` | Rating, verification, accreditation, and language cards | `HeroQualitySummary` in `src/components/organisms/ClinicDetail/HeroOverviewSection.tsx:67`; same information group, different layout. |
| `TreatmentsPricePanel` | Price-sorted treatment list | `TreatmentsStrip` and `FurtherTreatmentsSection` in `src/components/templates/ClinicDetailConcepts/ClinicDetail.tsx:308,318`; different selection and interaction behavior. |
| `DoctorsDirectorySection` | Selectable doctor directory and detail view | `RelatedDoctorSection` in the active `ClinicDetail.tsx:329`; no confirmed interchangeable duplicate. Its `DOCTORS_PAGE_SIZE` is local to this unused section. |
| `BeforeAfterCarouselSection` | Before/after image-pair carousel | No active equivalent. The other unused before/after gallery is not an active replacement. |
| `LocationContactSection` | Address, map placeholder, OSM link, contact link | `ClinicLocationSection` in the active `ClinicDetail.tsx:297`; the active section also handles consent and contact callbacks. |

## Completed atom API removals

All listed symbols were removed. The remaining components and their internal Radix primitives remain active. Separator and Tabs dependencies were removed from the manifest and lockfile without upgrading other dependencies.

| File under `src/components/atoms/` and symbols | Development consumers | Active equivalent or boundary |
| --- | --- | --- |
| `alert.tsx`: `AlertTitle` | `src/stories/atoms/Alert.stories.tsx` | `Heading` is active, but no identical alert-title wrapper is used. |
| `card.tsx`: `CardFooter` | `src/stories/atoms/Card.stories.tsx` | No specific active duplicate found. |
| `command.tsx`: `CommandDialog`, `CommandSeparator`, `CommandShortcut` | `src/stories/atoms/Command.stories.tsx` | `Dialog` is active, including cookie consent, but no same-purpose command dialog or shortcut is used. |
| `dialog.tsx`: `DialogClose`, `DialogTrigger` | `src/stories/atoms/Dialog.stories.tsx` | `DialogContent` uses the same Radix close primitive directly. No active trigger equivalent found. |
| `dropdown-menu.tsx`: `DropdownMenuCheckboxItem`, `DropdownMenuRadioItem`, `DropdownMenuShortcut`, `DropdownMenuSubTrigger`, `DropdownMenuSubContent` | None found | Active ordinary menu items perform different tasks. No confirmed equivalent found. |
| `dropdown-menu.tsx`: `DropdownMenuPortal`, `DropdownMenuRadioGroup`, `DropdownMenuSub` | None found | `DropdownMenuContent` uses the same Radix portal directly. No active equivalent found for the other two aliases. |
| `select.tsx`: `SelectGroup`, `SelectLabel`, `SelectSeparator` | Group and label in `src/stories/atoms/Select.stories.tsx`; separator has none | No confirmed equivalent. Menu separators are context-specific. |

## Completed export cleanup

The recovered cleanup of 27 export paths is preserved. Remaining full-mode findings were checked against source imports, tests, stories, dynamic imports, Payload registrations, and operator commands. Unused aliases and reexports were deleted; internally used helpers became private. The unused cache-visibility barrel was removed while the directly imported card and widget remain. The lazy gallery lightbox is unchanged.

| Source or export | Concrete active consumer |
| --- | --- |
| `CacheRevalidationVisibility/index.tsx` barrel | `src/dashboard/adminDashboard/CacheRevalidationVisibilityWidget.client.tsx:5,186` imports the card view directly. `tests/unit/components/cacheRevalidationVisibility.test.tsx` also covers it. Only the barrel is unused. |
| `PriceSummary` default alias | Named `PriceSummary` in `src/components/organisms/Listing/ListingCard.tsx:7,86`, its story, and molecule tests. |
| `ScrollReveal` default alias | Named component in homepage, clinic-partner page, About page, and Holding page; also its story. |
| `BlogCard` named variant reexports and legacy default | Overlay and Simple in the posts page; Enhanced in `BlogCardCollection`; Overview in `src/blocks/RelatedPosts/Component.tsx:47`. Simple also has direct and compound-API consumers. All four implementations remain needed. |
| `BlogCardCollection` and `BlogHero` default aliases | Named components in homepage/partner page and posts page/BlogHero block respectively. |
| `LandingTestimonialsCarousel` namespace object | `LandingTestimonialsCarouselClient` uses Root, Track, and Dots internally and is consumed by `LandingTestimonials.tsx:7,34`. The carousel stays. |
| `DialogPortal`, `DialogOverlay` exports | Internal `DialogContent` consumers. Removing exports must preserve implementations. |
| `SelectScrollUpButton`, `SelectScrollDownButton` exports | Internal `SelectContent` consumers. Removing exports must preserve implementations. |
| LoginForm compound object and named admin-branding aliases | Login routes use individual components through namespace imports. Payload's admin import map consumes default branding exports. |
| `ClinicGalleryLightbox` | `React.lazy` and dynamic import in `src/components/organisms/ClinicDetail/ClinicGallery.tsx:11,12,73`. It remains needed. |

Step 1 also made the account-menu default links, medical-specialty icon map/resolver, and TypeScript environment normalizer private. It removed the contact-form slug's unused barrel reexport and three unused CommonJS helper exports. Needed internal implementations and direct consumers remain. The CommonJS tooling mirror exports only the sitemap-consumed server helper; unused client helpers remain available in the TypeScript implementation and its tests.

Additional full-mode cleanup removed the unused `src/cssVariables.js` object and obsolete helpers for clinic gallery access, first-admin state, public review aliases, cookie consent cloning, legacy inquiry status mutation, moderation retention stamping, localized scalar lookup, and abandoned story fixtures. Their remaining callers and public operations are unchanged. Runtime schemas without consumers were removed; the corresponding inquiry status types retain the same literal unions.

Dedicated Separator, Tabs, PageRange, DeveloperDashboard, before/after, and breadcrumb wrapper stories/tests were deleted. Shared molecule tests still cover PriceSummary and RatingSummary. Alert, Card, Command, Dialog, Select, and BlogListing stories now exercise only surviving APIs and live beside their implementation. Dialog stories retain cancel/reopen/Escape cycles and restore opener focus explicitly.

Cache impact is `no-public-impact`: exported helper visibility and the CommonJS filename changed, while cache classes, keys, tags, invalidation policy, planner/executor behavior, data projections, sitemap output, and public freshness boundaries are unchanged. No schema migration file or data-model change is included.

## Remaining production findings

Full analysis has zero file or export findings. Production findings below remain visible as a separate report; a test, story, operator command, internal use, or type contract is not evidence of production consumption of an exported API. These consumers justify preserving the implementation in this cleanup, and keep each finding available for a later retirement decision. No further component implementation was removed outside the approved inventory.

The retained seed graph is invoked by `scripts/seed-run.ts` and integration setup. Treat it as operator/test usage, not a public route. The test-only access and utility modules have no demonstrated product consumer; retiring them would also require deciding the value of their retained tests.

Report on 2026-10-09: **19 files and 163 exports**. The file rows name retained consumers; export rows name at least one concrete consumer for each remaining symbol.

### Files

| Reported file | Retained consumer | Classification |
| --- | --- | --- |
| `src/access/authenticated.ts` | `tests/unit/access/authenticated.test.ts` | Test-only module; product consumption unproven |
| `src/access/authenticatedAndAdmin.ts` | `tests/unit/access/authenticatedAndAdmin.test.ts` | Test-only module; product consumption unproven |
| `src/access/authenticatedOrApprovedClinic.ts` | `tests/unit/access/authenticatedOrApprovedClinic.test.ts` | Test-only module; product consumption unproven |
| `src/access/authenticatedOrPublished.ts` | `tests/unit/access/authenticatedOrPublished.test.ts` | Test-only module; product consumption unproven |
| `src/posthog/identify.ts` | `tests/unit/posthog/identify.test.ts` | Test-only module; product consumption unproven |
| `src/utilities/buildSearchWhere.ts` | `tests/unit/utilities/buildSearchWhere.test.ts` | Test-only module; product consumption unproven |
| `src/utilities/formatAuthors.ts` | `tests/unit/utilities/formatAuthors.test.ts` | Test-only module; product consumption unproven |
| `src/utilities/getMediaUrl.ts` | `tests/unit/utilities/getMediaUrl.test.ts` | Test-only module; product consumption unproven |
| `src/utilities/mapPostToCardData.ts` | `tests/unit/utilities/mapPostToCardData.test.ts` | Test-only module; product consumption unproven |
| `src/utilities/useClickableCard.ts` | `tests/unit/utilities/useClickableCard.test.tsx` | Test-only module; product consumption unproven |
| `src/auth/actions/recoveryRequests.ts` | `tests/unit/auth/recoveryAdmission.test.ts` | Test-only module; product consumption unproven |
| `src/auth/utilities/passwordResetTarget.ts` | `tests/unit/auth/utilities/passwordResetTarget.test.ts` | Test-only module; product consumption unproven |
| `src/auth/utilities/userCreation.ts` | `tests/unit/auth/utilities/userCreation.test.ts` | Test-only module; product consumption unproven |
| `src/endpoints/seed/baseline/index.ts` | `scripts/seed-run.ts` | Operator and test seed graph |
| `src/endpoints/seed/baseline/run-baseline.ts` | `src/endpoints/seed/demo/run-demo.ts` | Operator and test seed graph |
| `src/endpoints/seed/demo/index.ts` | `scripts/seed-run.ts` | Operator and test seed graph |
| `src/endpoints/seed/demo/run-demo.ts` | `tests/integration/seedReviewWorkflow.integration.test.ts` | Operator and test seed graph |
| `src/endpoints/seed/globals/globals-seed.ts` | `tests/unit/endpoints/seed/globals-seed.test.ts` | Operator and test seed graph |
| `src/endpoints/seed/utils/summary.ts` | `scripts/seed-run.ts` | Operator and test seed graph |

### Export paths

| Source | Symbol | Retained consumer |
| --- | --- | --- |
| `src/posthog/api.ts` | `POSTHOG_EVENT_REGISTRY` | `tests/unit/posthog/client.test.ts` |
| `src/posthog/api.ts` | `POSTHOG_FLAG_REGISTRY` | `tests/unit/posthog/api.test.ts` |
| `src/posthog/api.ts` | `resetPostHogClientForTests` | `tests/unit/posthog/api.test.ts` |
| `src/features/previewGuard/index.ts` | `PREVIEW_GUARD_LOGIN_PATH` | `tests/unit/features/previewGuard/index.test.ts` |
| `src/features/previewGuard/index.ts` | `PREVIEW_GUARD_FALLBACK_REDIRECT` | `tests/unit/features/previewGuard/index.test.ts` |
| `src/features/previewGuard/index.ts` | `isPreviewGuardExemptPath` | `tests/unit/features/previewGuard/index.test.ts` |
| `src/features/previewGuard/index.ts` | `isPreviewGuardPatientPath` | `tests/unit/features/previewGuard/index.test.ts` |
| `src/features/publicDiscovery/crawlerMonitoring.ts` | `classifyCrawlerUserAgent` | `tests/unit/features/publicDiscovery/crawlerMonitoring.test.ts` |
| `src/features/publicDiscovery/crawlerMonitoring.ts` | `buildCrawlerRequestLogContext` | `tests/unit/features/publicDiscovery/crawlerMonitoring.test.ts` |
| `src/components/templates/PreviewDataNotice/Component.tsx` | `PREVIEW_DATA_NOTICE_COPY` | `src/stories/templates/Header.stories.tsx` |
| `src/auth/utilities/jwtValidation.ts` | `validateSupabaseUser` | `tests/unit/auth/utilities/jwtValidation.test.ts` |
| `src/auth/utilities/jwtValidation.ts` | `transformSupabaseUser` | `tests/unit/auth/utilities/jwtValidation.test.ts` |
| `src/utilities/normalizeNavItems.ts` | `normalizeNavItems` | `src/stories/templates/HeaderNav.stories.tsx` |
| `src/features/cookieConsent/index.ts` | `COOKIE_CONSENT_CHANGE_EVENT` | `tests/unit/features/cookieConsent.test.ts` |
| `src/features/cookieConsent/index.ts` | `COOKIE_CONSENT_DEFAULT_VERSION` | `tests/e2e/helpers/cookieConsent.ts` |
| `src/features/cookieConsent/index.ts` | `clearCookieConsentFromDocument` | `tests/unit/features/cookieConsent.test.ts` |
| `src/features/cookieConsent/index.ts` | `parseCookieConsentState` | `tests/unit/features/cookieConsent.test.ts` |
| `src/features/cookieConsent/index.ts` | `readCookieConsentFromDocument` | `tests/unit/features/cookieConsent.test.ts` |
| `src/features/cookieConsent/index.ts` | `serializeCookieConsentState` | `tests/e2e/helpers/cookieConsent.ts` |
| `src/features/cookieConsent/index.ts` | `writeCookieConsentToDocument` | `tests/unit/features/cookieConsent.test.ts` |
| `src/features/cookieConsent/index.ts` | `DEFAULT_COOKIE_CONSENT_CONFIG` | `src/components/organisms/CookieConsent/CookieConsentManager.stories.tsx` |
| `src/features/cookieConsent/index.ts` | `normalizeCookieConsentGlobal` | `tests/unit/features/cookieConsent.test.ts` |
| `src/features/cookieConsent/index.ts` | `useCookieConsentToolAllowed` | `tests/unit/features/cookieConsent.test.ts` |
| `src/utilities/landing/medicalSpecialtyCategories.ts` | `mapMedicalSpecialtiesToLandingCategories` | `tests/unit/utilities/landingMedicalSpecialtyCategories.test.ts` |
| `src/utilities/landing/landingPageContent.ts` | `normalizeHomeLandingContent` | `tests/unit/utilities/landingPageContent.test.ts` |
| `src/utilities/landing/landingPageContent.ts` | `normalizeAboutLandingContent` | `tests/unit/utilities/landingPageContent.test.ts` |
| `src/utilities/landing/landingPageContent.ts` | `normalizeClinicPartnerLandingContent` | `tests/unit/utilities/landingPageContent.test.ts` |
| `src/utilities/listingComparison/serverData/index.ts` | `buildListingComparisonDataCacheKey` | `tests/unit/utilities/listingComparisonServerData.contract.test.ts` |
| `src/utilities/listingComparison/serverData/index.ts` | `buildListingComparisonDataCacheTags` | `tests/unit/utilities/listingComparisonServerData.contract.test.ts` |
| `src/utilities/listingComparison/serverData/index.ts` | `buildListingComparisonResolvedDataCacheKey` | `tests/unit/utilities/listingComparisonLegacyService.test.ts` |
| `src/features/publicDiscovery/llmsTxt.ts` | `buildLlmsTxt` | `tests/unit/features/publicDiscovery/discoveryContract.test.ts` |
| `src/posthog/client-api.ts` | `enablePostHogAnalyticsCapture` | `tests/unit/posthog/client.test.ts` |
| `src/features/inquiryCommunication/service.ts` | `readLegacyClinicInquiryQueue` | `tests/integration/inquiryCommunication.lifecycle.test.ts` |
| `src/features/inquiryCommunication/service.ts` | `readLegacyClinicInquiryDetail` | `tests/integration/inquiryCommunication.lifecycle.test.ts` |
| `src/features/inquiryCommunication/service.ts` | `INQUIRY_ATTACHMENT_DRAFT_LIMITS` | `tests/integration/inquiryCommunication.attachmentQuota.postgres.test.ts` |
| `src/features/inquiryCommunication/service.ts` | `readPatientInquiryDetail` | `tests/integration/inquiryCommunication.storage.s3.test.ts` |
| `src/features/searchIndexing/sitemapGuards.ts` | `shouldBlockSitemapIndexingForRequest` | `tests/unit/features/searchIndexing/sitemapGuards.test.ts` |
| `src/utilities/cachePolicy/index.ts` | `CACHE_CLASSES` | `tests/unit/utilities/cachePolicy.test.ts` |
| `src/utilities/cachePolicy/index.ts` | `CACHE_TAG_FAMILY_TEMPLATES` | `tests/unit/utilities/cachePolicy.test.ts` |
| `src/utilities/cachePolicy/index.ts` | `CACHE_TAG_FAMILIES` | `tests/unit/utilities/cachePolicy.test.ts` |
| `src/utilities/cachePolicy/index.ts` | `CACHE_OPERATIONS` | `tests/unit/utilities/cachePolicy.test.ts` |
| `src/utilities/cachePolicy/index.ts` | `CACHE_POLICY_COLLECTIONS` | `tests/integration/contracts/cacheArchitectureCoverage.test.ts` |
| `src/utilities/cachePolicy/index.ts` | `CACHE_POLICY_GLOBALS` | `tests/integration/contracts/cacheArchitectureCoverage.test.ts` |
| `src/utilities/cachePolicy/index.ts` | `CACHE_SURFACE_IDS` | `tests/unit/utilities/cachePolicy.test.ts` |
| `src/utilities/cachePolicy/index.ts` | `CACHE_SITEMAP_IDS` | `tests/unit/utilities/cachePolicy.test.ts` |
| `src/utilities/cachePolicy/index.ts` | `CACHE_DISCOVERY_IDS` | `tests/unit/utilities/cachePolicy.test.ts` |
| `src/utilities/cachePolicy/index.ts` | `buildPostsPaginationPath` | `tests/unit/utilities/cachePolicy.test.ts` |
| `src/utilities/cachePolicy/index.ts` | `buildDiscoveryPath` | `tests/unit/utilities/cachePolicy.test.ts` |
| `src/auth/utilities/userLookup.ts` | `isClinicUserApproved` | `tests/unit/auth/utilities/userLookup.test.ts` |
| `src/features/transactionalEmail/environment.ts` | `validateTransactionalEmailStartupForTest` | `tests/integration/transactionalEmail.webhook.test.ts` |
| `src/app/(frontend)/auth/confirm/PatientVerificationForm.tsx` | `PatientVerificationView` | `src/app/(frontend)/auth/confirm/PatientVerificationForm.stories.tsx` |
| `src/app/(frontend)/auth/confirm/RecoveryConfirmationForm.tsx` | `RecoveryConfirmationView` | `src/app/(frontend)/auth/confirm/RecoveryConfirmationForm.stories.tsx` |
| `src/app/(frontend)/clinics/[slug]/ClinicDetailClientAdapter.client.tsx` | `submitClinicContactRequest` | `tests/unit/components/clinicDetailInteractionState.test.tsx` |
| `src/app/(frontend)/auth/invite/complete/InviteCompleteForm.tsx` | `InviteCompleteForm` | `tests/unit/app/frontend/auth/invite/complete/InviteCompleteForm.test.tsx` |
| `src/app/(frontend)/auth/password/reset/complete/ResetPasswordCompleteForm.tsx` | `RecoveryPasswordView` | `src/app/(frontend)/auth/password/reset/complete/ResetPasswordCompleteForm.stories.tsx` |
| `src/features/transactionalEmail/operationalSignals.ts` | `deliveryEdgeLogFields` | `tests/unit/features/transactionalEmail/operationalSignals.test.ts` |
| `src/features/transactionalEmail/operationalSignals.ts` | `deliveryEdgeMetricDimensions` | `tests/unit/features/transactionalEmail/operationalSignals.test.ts` |
| `src/features/transactionalEmail/operationalSignals.ts` | `validateDeliveryEdgeLog` | `tests/integration/transactionalEmail.webhook.test.ts` |
| `src/auth/actions/protocol/credentials.ts` | `createActionReference` | `tests/unit/auth/authActionProtocolHttp.test.ts` |
| `src/imageConfig.js` | `applyNextImageConfigGlobals` | `.storybook/vitest.setup.js` |
| `src/endpoints/clinicDashboardInquiries.ts` | `CLINIC_INQUIRY_CONTACT_REAUTH_MAX_AGE_SECONDS` | `tests/unit/endpoints/clinicDashboardInquiries.test.ts` |
| `src/features/databaseAvailability/index.ts` | `DATABASE_TEMPORARILY_UNAVAILABLE_CODE` | `tests/unit/utilities/databaseAvailability.test.ts` |
| `src/features/databaseAvailability/index.ts` | `classifyDatabaseAvailabilityError` | `tests/unit/utilities/databaseAvailability.test.ts` |
| `src/collections/Doctors.ts` | `doctorTitles` | `tests/integration/doctors.lifecycle.test.ts` |
| `src/dashboard/adminDashboard/CacheRevalidationVisibilityWidget.client.tsx` | `CacheRevalidationVisibilityWidget` | `tests/unit/dashboard/adminDashboard/config.test.ts` |
| `src/features/runtimePolicy/index.ts` | `isClientPreviewRuntime` | `tests/unit/features/runtimePolicy/index.test.ts` |
| `src/posthog/server.ts` | `POSTHOG_FEATURE_FLAGS_POLLING_INTERVAL_MS` | `tests/unit/posthog/api.test.ts` |
| `src/posthog/server.ts` | `POSTHOG_FEATURE_FLAGS_IDLE_SHUTDOWN_MS` | `tests/unit/posthog/api.test.ts` |
| `src/posthog/server.ts` | `resetPostHogServerForTests` | `tests/unit/posthog/api.test.ts` |
| `src/posthog/telemetry.ts` | `sanitizePostHogRequestUrl` | `tests/unit/posthog/telemetry.test.ts` |
| `src/auth/config/authConfig.ts` | `USER_CONFIG` | `tests/unit/auth/config/authConfig.test.ts` |
| `src/features/temporaryLandingMode/i18n.ts` | `TEMPORARY_LANDING_LOCALES` | `tests/unit/features/temporaryLandingMode/content.test.ts` |
| `src/features/temporaryLandingMode/i18n.ts` | `buildTemporaryLandingLocaleHref` | `tests/unit/features/temporaryLandingMode/i18n.test.ts` |
| `src/features/searchIndexing/listingComparison.ts` | `LISTING_COMPARISON_CANONICAL_PATH` | `tests/unit/features/searchIndexing/listingComparison.test.ts` |
| `src/features/publicDiscovery/site.ts` | `PUBLIC_DISCOVERY_AGENT_CONTEXT_PATHS` | `tests/unit/features/publicDiscovery/discoveryContract.test.ts` |
| `src/features/publicDiscovery/site.ts` | `PUBLIC_DISCOVERY_SITEMAP_PATHS` | `tests/unit/features/publicDiscovery/discoveryContract.test.ts` |
| `src/blocks/_shared/utils.ts` | `appendContentLocaleToHref` | `tests/unit/blocks/shared-utils.test.ts` |
| `src/features/cookieConsent/cookie.ts` | `serializeCookieConsentState` | `tests/e2e/helpers/cookieConsent.ts` |
| `src/features/cookieConsent/cookie.ts` | `clearCookieConsentFromDocument` | `tests/unit/features/cookieConsent.test.ts` |
| `src/features/cookieConsent/normalizeGlobal.ts` | `DEFAULT_COOKIE_CONSENT_CONFIG` | `src/components/organisms/CookieConsent/CookieConsentManager.stories.tsx` |
| `src/components/organisms/Landing/LandingProcessRing.tsx` | `landingProcessRingDefaultSteps` | `src/stories/organisms/Landing/LandingProcessRing.stories.tsx` |
| `src/components/organisms/Contact/index.ts` | `DEFAULT_CONTACT_FORM_LABELS` | `tests/unit/components/publicContactSection.test.tsx` |
| `src/utilities/content/serverData/pages.ts` | `PAGE_DETAIL_SELECT` | `tests/unit/utilities/contentServerData.test.ts` |
| `src/utilities/content/serverData/pages.ts` | `PAGE_SITEMAP_SELECT` | `tests/unit/utilities/contentServerData.test.ts` |
| `src/utilities/content/serverData/pages.ts` | `PAGE_SLUG_SELECT` | `tests/unit/utilities/contentServerData.test.ts` |
| `src/utilities/content/serverData/posts.ts` | `buildPostListDataCacheTags` | `tests/unit/utilities/postsServerDataCache.test.ts` |
| `src/utilities/content/serverData/posts.ts` | `buildPostListDataCacheKey` | `tests/unit/utilities/postsServerDataCache.test.ts` |
| `src/utilities/content/serverData/posts.ts` | `buildPostDetailDataCacheKey` | `tests/unit/utilities/postsServerDataCache.test.ts` |
| `src/utilities/content/serverData/posts.ts` | `buildPostDetailDataCacheTags` | `tests/unit/utilities/postsServerDataCache.test.ts` |
| `src/utilities/content/serverData/posts.ts` | `findLatestPosts` | `tests/unit/utilities/contentServerData.test.ts` |
| `src/utilities/content/serverData/posts.ts` | `POST_DETAIL_SELECT` | `tests/unit/utilities/contentServerData.test.ts` |
| `src/utilities/content/serverData/posts.ts` | `POST_LATEST_SELECT` | `tests/unit/utilities/contentServerData.test.ts` |
| `src/utilities/content/serverData/posts.ts` | `POST_LIST_SELECT` | `tests/unit/utilities/contentServerData.test.ts` |
| `src/utilities/content/serverData/posts.ts` | `POST_SITEMAP_SELECT` | `tests/unit/utilities/contentServerData.test.ts` |
| `src/utilities/timestamps.ts` | `parseTimestampStringToMs` | `tests/unit/utilities/timestamps.test.ts` |
| `src/utilities/listingComparison/serverData/getListingComparisonServerData.ts` | `buildListingComparisonDataCacheTags` | `tests/unit/utilities/listingComparisonServerData.contract.test.ts` |
| `src/utilities/listingComparison/serverData/getListingComparisonServerData.ts` | `buildListingComparisonDataCacheKey` | `tests/unit/utilities/listingComparisonServerData.contract.test.ts` |
| `src/utilities/listingComparison/serverData/getListingComparisonServerData.ts` | `buildListingComparisonResolvedDataCacheKey` | `tests/unit/utilities/listingComparisonLegacyService.test.ts` |
| `src/utilities/listingComparison/sort.ts` | `sortListingComparison` | `src/stories/templates/ListingComparison.stories.tsx` |
| `src/utilities/listingComparison/sort.ts` | `getSortLabel` | `tests/unit/utilities/listingComparisonSort.test.ts` |
| `src/posthog/client.ts` | `initializePostHog` | `tests/unit/posthog/client.test.ts` |
| `src/auth/utilities/clinicAccessState.ts` | `isClinicAccessReady` | `tests/unit/auth/utilities/clinicAccessState.test.ts` |
| `src/features/inquiryCommunication/storage.ts` | `buildInquiryAttachmentContentDisposition` | `tests/unit/features/inquiryCommunication.storage.test.ts` |
| `src/features/transactionalEmail/payloadIntegration.ts` | `bindTransactionalEmailForTest` | `tests/integration/transactionalEmail.delivery.test.ts` |
| `src/features/transactionalEmail/payloadIntegration.ts` | `runTransactionalEmailTransaction` | `tests/integration/transactionalEmail.transactions.test.ts` |
| `src/features/transactionalEmail/payloadIntegration.ts` | `selectTransactionalEmailCommandAcceptanceForTest` | `tests/integration/clinicRegistration.atomic.test.ts` |
| `src/utilities/getRedirects.ts` | `getRedirects` | `tests/unit/utilities/payloadDataFetchers.test.ts` |
| `src/auth/utilities/authFlash.ts` | `AUTH_FLASH_STORAGE_KEY` | `tests/unit/auth/utilities/authFlash.test.ts` |
| `src/utilities/clinicDetail/serverData/getClinicDetailServerData.ts` | `buildClinicDetailIdentityCacheTags` | `tests/unit/utilities/clinicDetailServerData.contract.test.ts` |
| `src/utilities/clinicDetail/serverData/getClinicDetailServerData.ts` | `buildClinicDetailDataCacheTags` | `tests/unit/utilities/clinicDetailServerData.contract.test.ts` |
| `src/features/transactionalEmail/providerEvents.ts` | `appendProviderEvent` | `tests/integration/transactionalEmail.events.test.ts` |
| `src/auth/utilities/clinicAccountCompletion.ts` | `importLegacyClinicPasswordEvidence` | `tests/fixtures/testUsers.ts` |
| `src/auth/utilities/clinicAccountCompletion.ts` | `snapshotLegacyClinicAccess` | `tests/fixtures/testUsers.ts` |
| `src/utilities/cacheRevalidation/visibility.ts` | `CACHE_REVALIDATION_VISIBILITY_LIMIT` | `tests/unit/utilities/cacheRevalidation/visibility.test.ts` |
| `src/utilities/cacheRevalidation/visibility.ts` | `CACHE_REVALIDATION_VISIBILITY_PREVIEW_LIMIT` | `tests/unit/utilities/cacheRevalidation/visibility.test.ts` |
| `src/utilities/cacheRevalidation/visibility.ts` | `resetCacheRevalidationVisibilityForTests` | `tests/unit/utilities/cacheRevalidation/visibility.test.ts` |
| `src/features/clinicDashboard/reporting/service.ts` | `createReportingWindows` | `tests/unit/features/clinicDashboard/reporting/service.test.ts` |
| `src/features/clinicDashboard/gallery/cleanup.ts` | `CLINIC_GALLERY_CLEANUP_BATCH_SIZE` | `tests/unit/features/clinicDashboard/galleryCleanup.test.ts` |
| `src/features/clinicDashboard/gallery/cleanup.ts` | `CLINIC_GALLERY_CLEANUP_CONCURRENCY` | `tests/unit/features/clinicDashboard/galleryCleanup.test.ts` |
| `src/features/clinicDashboard/gallery/cleanup.ts` | `CLINIC_GALLERY_CLEANUP_RETRY_DELAYS_MS` | `tests/unit/features/clinicDashboard/galleryCleanup.test.ts` |
| `src/endpoints/seed/utils/runtime.ts` | `isSeedRuntimeEnv` | `scripts/seed-run.ts` |
| `src/access/isPlatformStaff.ts` | `isPlatformStaffOrSelf` | `tests/unit/access/isPlatformStaff.test.ts` |
| `src/features/databaseAvailability/availability.ts` | `DATABASE_TEMPORARILY_UNAVAILABLE_CODE` | `tests/unit/utilities/databaseAvailability.test.ts` |
| `src/collections/common/mediaCollection.ts` | `standardMediaImageMimeTypes` | `tests/unit/hooks/validateMediaUpload.test.ts` |
| `src/hooks/media/prepareUploadFilename.ts` | `prepareUploadFilenameFromFilePathSync` | `tests/unit/hooks/prepareUploadFilename.test.ts` |
| `src/access/scopeFilters.ts` | `ownResourceOnly` | `tests/unit/access/scopeFilters.test.ts` |
| `src/access/scopeFilters.ts` | `platformOnlyOrApprovedReviews` | `tests/unit/access/scopeFilters.test.ts` |
| `src/utilities/nameUtils.ts` | `capitalizeFirstLetter` | `tests/unit/utilities/nameUtils.test.ts` |
| `src/collections/reviews/endpoints.ts` | `reviewModerationPostHandler` | `tests/integration/reviews.publication.test.ts` |
| `src/collections/reviews/endpoints.ts` | `reviewWithdrawPostHandler` | `tests/integration/reviews.publication.test.ts` |
| `src/collections/reviews/endpoints.ts` | `reviewWithdrawalCorrectionPostHandler` | `tests/integration/reviews.publication.test.ts` |
| `src/collections/reviews/endpoints.ts` | `reviewPublicationHistoryGetHandler` | `tests/integration/reviews.publication.test.ts` |
| `src/collections/reviews/publicProjection.ts` | `isRawReviewCommentPubliclyReadable` | `tests/data-integrity/endpoints/seed/reviewDemoStateCoverage.test.ts` |
| `src/collections/clinicStaff/lifecycle.ts` | `clinicStaffStatusTransitions` | `tests/integration/clinicStaff.lifecycle.test.ts` |
| `src/hooks/media/normalizeClinicMediaUpload.ts` | `isClinicMediaWithinPixelLimit` | `tests/unit/hooks/normalizeClinicMediaUpload.test.ts` |
| `src/plugins/mcp.ts` | `isPlatformStaffMcpUser` | `tests/unit/plugins/mcp.test.ts` |
| `src/plugins/mcp.ts` | `mcpReadCollectionSlugs` | `tests/unit/plugins/mcp.test.ts` |
| `src/plugins/importExport.ts` | `importExportTargetSlugs` | `tests/tooling/scripts/detect-migration-diff.test.ts` |
| `src/plugins/importExport.ts` | `importExportPluginConfig` | `tests/tooling/scripts/detect-migration-diff.test.ts` |
| `src/features/runtimePolicy/core.ts` | `isClientPreviewRuntime` | `tests/unit/features/runtimePolicy/index.test.ts` |
| `src/posthog/flag-definition-cache.ts` | `POSTHOG_FLAG_DEFINITION_CACHE_NAMESPACE` | `tests/unit/posthog/flagDefinitionCache.test.ts` |
| `src/posthog/flag-definition-cache.ts` | `POSTHOG_FLAG_DEFINITION_CACHE_TAG` | `tests/unit/posthog/flagDefinitionCache.test.ts` |
| `src/posthog/flag-definition-cache.ts` | `POSTHOG_FLAG_DEFINITION_CACHE_TTL_SECONDS` | `tests/unit/posthog/flagDefinitionCache.test.ts` |
| `src/components/organisms/TrustQualitySection/index.tsx` | `formatTrustQualityStatValue` | `src/stories/organisms/TrustQualitySection.stories.tsx` |
| `src/components/molecules/PublicFormValidation/logic.ts` | `getNativeValidationMessage` | `tests/unit/components/publicFormValidation.test.ts` |
| `src/features/clinicDashboard/profile/richText.ts` | `canonicalizeDescriptionText` | `tests/unit/features/clinicDashboard/treatments/service.test.ts` |
| `src/endpoints/seed/utils/load-json.ts` | `createSeedLoader` | `tests/unit/endpoints/seed/load-json.test.ts` |
| `src/features/transactionalEmail/preparation.tsx` | `fakeLinks` | `tests/integration/transactionalEmail.webhook.test.ts` |
| `src/features/transactionalEmail/preparation.tsx` | `renderSyntheticNotification` | `tests/integration/transactionalEmail.webhook.test.ts` |
| `src/auth/utilities/accessValidation.ts` | `validateClinicAccess` | `tests/unit/auth/utilities/accessValidation.edge-cases.test.ts` |
| `src/auth/utilities/accessValidation.ts` | `validateUserTypePermissions` | `tests/unit/auth/utilities/accessValidation.edge-cases.test.ts` |
| `src/auth/utilities/supabaseProvision.ts` | `createSupabaseAccountWithPassword` | `tests/setup/supabaseProvisionMock.ts` |
| `src/collections/reviews/commandTransaction.ts` | `ReviewCommandTransactionUnavailableError` | `tests/unit/collections/reviewCommandTransactions.test.ts` |
| `src/utilities/deepMerge.ts` | `isObject` | `tests/unit/utilities/deepMerge.test.ts` |
| `src/components/organisms/DeveloperDashboard/Seeding/SeedingCardView.tsx` | `modeFromNodeEnv` | `tests/unit/components/seedingCardView.test.tsx` |
| `src/components/organisms/DeveloperDashboard/Seeding/SeedingCardView.tsx` | `getDemoSeedPolicy` | `tests/unit/components/seedingCardView.test.tsx` |
| `src/utilities/cacheRevalidation/identifiers.ts` | `InvalidRevalidationPlanError` | `tests/unit/utilities/cacheRevalidation/plannerExecutor.test.ts` |
| `src/utilities/cacheRevalidation/planner.ts` | `DeferredRevalidationError` | `tests/unit/utilities/cacheRevalidation/plannerExecutor.test.ts` |
| `src/utilities/cacheRevalidation/planner.ts` | `UnsupportedRevalidationEventError` | `tests/unit/utilities/cacheRevalidation/plannerExecutor.test.ts` |
| `src/components/molecules/ImmersiveVideoHero/logic.ts` | `normalizeCrossfadeMs` | `tests/unit/components/immersiveVideoHeroLogic.test.ts` |
| `src/components/molecules/ImmersiveVideoHero/logic.ts` | `resolveCrossfadeMs` | `tests/unit/components/immersiveVideoHeroLogic.test.ts` |
| `src/components/molecules/ImmersiveVideoHero/logic.ts` | `normalizePlaybackRate` | `tests/unit/components/immersiveVideoHeroLogic.test.ts` |
| `src/components/molecules/ImmersiveVideoHero/logic.ts` | `resolveVideoRenderMode` | `tests/unit/components/immersiveVideoHeroLogic.test.ts` |

## Validation boundary

Gate regressions cover report/check ordering in pre-push and Deep Quality, full findings and exit code 2 failures blocking, production findings remaining visible with exit code 0, malformed analysis configuration still failing, Payload/Next/operator entries, and test/story consumers counted only by full mode. Dedicated tests use the installed Knip version and the actual package-script flags.

Build validation passes against a newly initialized, isolated local test database. All 95 existing migration names are present in its migration metadata. Initialization uses the existing local Postgres container and the repository migration helper, following the documented migration-based schema setup. The original database is preserved. Build and sitemap postbuild pass with Node.js 24 and process-local database/runtime overrides; environment profiles remain unchanged. Next.js reports compilation warnings without stopping the build.
