# CMS localization inventory

> Rollout baseline and planning reference. For current implementation, see
> [localized Page and Post reads](frontend/content-data-access.md#localized-page-and-post-reads) and
> [publication revalidation](engineering/cache-revalidation-runtime.md#surface-ownership).

The inventory covers the 65 collections and four globals registered at the start of the Page and Post rollout. It uses the Payload config for application models, generated types for plugin and system models, and the MCP config for available tools. The tables recommend field ownership for subsequent stages. The authoring column describes the operations available at that baseline. [Payload config](../src/payload.config.ts) · [Generated types](../src/payload-types.ts) · [MCP config](../src/plugins/mcp.ts)

## Publication and authoring

German (`de`) is the phase-one source and default, and English (`en`) is the first alternative. Preserve existing English values and publication states when introducing German. Each translation belongs to the same Payload document. Keep identifiers, ownership, relationships and operational facts shared unless a row identifies a language-specific value. Preserve row identity and order when only text within a list needs translation. [ADR 021](adrs/021-adr-localization-source-ownership-and-readiness-governance.md) · [ADR 038](adrs/038-adr-native-payload-locale-publication.md)

For versioned public content, use Payload's native publication status in the requested locale. Admin publishes the active language by default and offers an explicit publish-all action. Anonymous localized reads request the locale, disable content fallback and respect public access rules. Localized routes follow the existing canonical, redirect and discovery rules. Generic interface text belongs to Product UI Copy. Payload Admin menus and field help stay in English. [ADR 038](adrs/038-adr-native-payload-locale-publication.md) · [ADR 022](adrs/022-adr-public-localization-routing-seo-and-domain-strategy.md) · [ADR 041](adrs/041-adr-shared-ui-copy-source-and-fallback.md)

MCP collection operations require the matching key permission and the staff owner's Payload access. The generic find, create and update tools accept a locale where applicable. For each writable model, verify that a localized update writes the intended language and preserves both the other language and shared values. Verify draft and publish behavior separately on versioned models. The custom media tools have their own parameters and need separate checks. The site config exposes collection tools and custom tools through MCP. Global authoring remains in Payload Admin. [MCP authoring guide](integrations/mcp.md) · [MCP config](../src/plugins/mcp.ts)

## Rollout order

1. **Page and Post.** Use an existing standard Page and Post to establish English preservation, independent publication, canonical routing, withdrawal and discovery. Verify the integrated result in Preview before adopting the same behavior on other public routes. [CMS rollout](https://github.com/findmydoc-platform/website/issues/1350) · [Approved specification](https://github.com/findmydoc-platform/website/issues/2396#issuecomment-7083243291)
2. **Taxonomies and locations.** Translate the vocabulary used by blog and directory views before adapting the profiles and landing sections that display it. Keep IDs and relationships stable so the same filters, addresses and clinical associations work in both languages.
3. **Globals and landing content.** Apply the Page and Post locale routing rules to referenced navigation links. Translate editorial content on fixed landing routes and in CMS-authored forms. Check the related image text from stage 5 before using those assets on bilingual routes.
4. **Clinic and doctor profiles.** Reuse the localized catalog and location names. Verify changes through Payload Admin, MCP and the Clinic Dashboard APIs because all three can affect the public result. Preserve clinic approval, participation and staff permissions when introducing language publication.
5. **Media text.** Start with the editorial images used on translated pages, then cover clinic and doctor images. Reuse the same asset per language and test each authoring path, including gallery operations and accessibility text. Translate text for images needed by an earlier stage alongside that content.
6. **Medical and trust content.** Review treatment explanations, clinical credentials, accreditation descriptions and legal text with their content owners. Prepare medical taxonomy labels in stage 2 and confirm the terminology again when reviewing the related clinical descriptions. Keep consent rules shared and verify that both languages use the same settings and link to the correct legal destination.

This order lets teams group and verify related changes. Public availability remains a decision for the requested document and locale under ADR 038.

## Page and Post proof

| Model | Localized | Shared | Existing authoring |
| --- | --- | --- | --- |
| `pages` | `title`, `layout` and its editorial content, `meta.title`, `meta.description`, `slug`, native `_status` | Document ID, parent relationship, `meta.image`, existing `publishedAt` value. Derive breadcrumb labels and URLs for the selected locale while keeping their document relationships. | Admin drafts and publication. MCP find. |
| `posts` | `title`, `content`, `excerpt`, `meta.title`, `meta.description`, `slug`, native `_status` | Document ID, `stableId`, authors and derived author identities, tags, categories, related posts, hero and SEO image references, existing `publishedAt` value | Admin drafts and publication. MCP find, create and update. |
| `redirects` | A publish action that renames a public Page or Post canonical records the previous path for that language. | Redirect ID, HTTP status and stable destination relationship. The permanent redirect resolves the current public destination in the source language. Withdrawal retains the last path for later publication. | Admin Settings. MCP has no redirect tools. |

At the baseline, Pages localize title, layout and SEO text. Posts localize title, body, excerpt and SEO text. The pilot adds locale-specific slugs and publication status. The regular Page in the pilot and managed legal pages share the collection. The legal pages have additional rules in the trust stage below. [Pages config](../src/collections/Pages/index.ts) · [Posts config](../src/collections/Posts/index.ts) · [Redirects config](../src/plugins/index.ts)

## Taxonomies and locations

| Model | Localized | Shared | Existing authoring |
| --- | --- | --- | --- |
| `categories` | `title` and the display labels derived from it | `stableId`, `slug`, parent and breadcrumb document relationships | Admin content taxonomy. MCP find, create and update. |
| `tags` | `name` | `stableId`, `slug`, post, clinic and treatment links | Admin content taxonomy. MCP find, create and update. |
| `medical-specialties` | `displayName` for patient-facing labels. `description` is editorial. | `stableId`, `name`, `parentSpecialty`, `iconKey`, `featureImage`, doctor links. Keep hierarchy relationships shared and derive labels per locale. | Admin specialty taxonomy. MCP find, create and update. |
| `countries` | The comparison displays the localized region name for `isoCode`, when available. | `stableId`, `name`, `isoCode`, `currency`, and the language value as a fact about the country. Localize the language label at display when needed. | Admin location data. MCP find, create and update. |
| `cities` | `displayName` where a localized name is used | `stableId`, `name`, `airportcode`, `coordinates`, `country`. Preserve the canonical locality used in addresses. | Admin location data. MCP find. |

Category and tag slugs remain taxonomy keys. The comparison uses localized display names with shared name fallback for existing records. Filter URLs identify records by ID and still accept the shared legacy names. Address consumers and imports keep using the existing locality identity. [Category config](../src/collections/Categories.ts) · [Tags config](../src/collections/Tags.ts) · [Specialties config](../src/collections/MedicalSpecialties.ts) · [Countries config](../src/collections/Countries.ts) · [Cities config](../src/collections/Cities.ts)

## Globals and landing content

| Model | Localized | Shared | Existing authoring |
| --- | --- | --- | --- |
| `header` | Editorial link labels in `navItems` and `subItems`. Custom URL values may differ when external destinations have language variants. | Navigation order, groups, link type, `newTab` and referenced Page or Post ID. Resolve internal URLs from the referenced document in the display locale. | Admin Header global. No MCP tools. |
| `footer` | Editorial link labels in `aboutLinks`, `serviceLinks` and `informationLinks`. Custom URL values may differ by language. | Column membership, order, link type, `newTab` and reference IDs. Resolve localized internal destinations as for Header. | Admin Footer global. No MCP tools. |
| `landingPages` | SEO titles and descriptions, hero and section text, FAQ questions and answers, feature and process text, testimonial quotes and displayed roles, team roles and descriptions, editorial CTA text, language-specific custom link destinations | Fixed `home`, `clinicPartners` and `about` routes and section structure, row order, team and testimonial names, images, icon keys, step numbers, social links and referenced document IDs | Admin Landing Pages global. No MCP tools. |
| `forms` | CMS-authored form titles, field labels and hints, option labels, embedded messages and confirmation content. Review form-specific submit wording and email subject and body in the form workflow. | Form ID and slug, field keys and types, option values, validation and layout, submission routing, confirmation mode and email recipient settings. Use locale-specific redirect destinations when needed. | Admin form builder. Plugin localization is explicitly off. No MCP tools. |

Keep generic navigation controls, form validation messages and reusable button copy with Product UI Copy. The consent settings global has a separate trust workflow below. [Header config](../src/globals/Header/config.ts) · [Footer config](../src/globals/Footer/config.ts) · [Landing Pages config](../src/globals/LandingPages/config.ts) · [Form Builder config](../src/plugins/index.ts)

## Clinic and doctor profiles

| Model | Localized | Shared | Existing authoring |
| --- | --- | --- | --- |
| `clinics` | `description` and any SEO copy derived from it | `stableId`, name, slug, group, coordinates, address, contact, opening hours, language codes, tags, treatments, accreditations, media relations and gallery order, ratings, verification, participation, approval and profile revision | Platform Admin and MCP find, create and update. Clinic Dashboard edits the clinic profile through its draft and submit APIs. |
| `clinicProfileDrafts` | Draft `description` follows the corresponding public profile locale | Clinic ID, revision tokens, name, address and supported-language values | Private Clinic Dashboard draft flow. No MCP tools. |
| `doctors` | `biography`, with localized public rendering of the shared title code. See credential handling below. | `stableId`, first and last names, slug, title and gender codes, active state, clinic and profile image, experience years, languages, specialties, treatments and ratings | Platform Admin and MCP find, create and update. Clinic Dashboard doctor and profile image operations. |
| `clinictreatments` | Display localized treatment names through the linked treatment. | Clinic and treatment IDs, EUR price, active state | Platform Admin and Clinic Dashboard treatment editor. MCP find, create and update, plus the link deletion tool. |
| `doctortreatments` | Display localized treatment names through the linked treatment. | Doctor and treatment IDs, specialization level and procedure count | Platform Admin and Clinic Dashboard treatment operations. MCP find, create and update, plus the link deletion tool. |
| `doctorspecialties` | Display localized specialty names through the linked specialty. Translate credential explanations only where the source is explanatory prose. | Doctor and specialty IDs, specialization level and certified credential facts | Platform Admin and Clinic Dashboard specialty operations. MCP find, create and update, plus the link deletion tool. |

Clinics use the same generated slug and approval in both languages. Platform editors maintain `localizedDescription` and gallery `localizedAlt` and `localizedCaption` in the selected locale. These fields do not change the Clinic Dashboard draft or gallery publication workflows. The English profile can use the existing unlocalized description and image text until editors enter English values. The German route shows an empty description state or a generic image alternative where needed. [Clinic config](../src/collections/Clinics.ts) · [Doctor config](../src/collections/Doctors.ts) · [Clinic Dashboard API](integrations/clinic-dashboard-api.md) · [MCP authoring guide](integrations/mcp.md)

## Media text

| Model | Localized | Shared | Existing authoring |
| --- | --- | --- | --- |
| `platformContentMedia` | `alt` and `caption` | One file, asset ID, storage metadata, dimensions, crops and uploader | Admin editorial upload and metadata editing. MCP `uploadEditorialImage` accepts the file and alt text. |
| `clinicMedia` | `alt` and `caption` | File and upload metadata, clinic and uploader IDs, image status, gallery order and references | Admin and Clinic Dashboard gallery operations. MCP metadata find and custom gallery upload, publish, read, save and delete tools. Check locale selection when authoring or returning image text through a gallery tool. |
| `doctorMedia` | `alt` and `caption` | File and upload metadata, doctor, clinic and uploader IDs, profile image relationship | Admin and Clinic Dashboard doctor image operations. MCP metadata find, custom upload, read and delete, and `updateDoctorImage` for alt text. The upload and alt update tools currently take one alt string without a locale argument. |

Asset publication and attachment rules stay tied to the existing media and profile workflows. Identify where the asset is used so editors can review localized alt text in context. Use the same image ID in both languages when the image itself is shared. [Media fields](../src/collections/common/mediaCollection.ts) · [MCP authoring guide](integrations/mcp.md) · [Clinic Dashboard API](integrations/clinic-dashboard-api.md)

## Medical and trust content

| Model | Localized | Shared | Existing authoring |
| --- | --- | --- | --- |
| `treatments` | `displayName` for patient-facing labels. `description` and derived SEO copy are editorial. | `stableId`, `name`, specialty, tags and offering links, computed average price and rating | Admin treatment catalog. MCP find, create and update. |
| `accreditation` | `description` and a translated display `name` when the issuer has an approved equivalent | `stableId`, official acronym, issuing country as a fact and icon reference | Admin accreditation catalog. MCP find, create and update. |
| `doctors` and `doctorspecialties` | Localized explanations of qualifications or certifications when the source contains prose | Official degree and certification names and the underlying credential facts in `qualifications` and `certifications[].certification`. Preserve the original evidence if separate display text is needed. | Existing profile and specialty authoring listed above. Review the exact representation with clinical content owners before migrating free-text records. |
| Managed legal `pages` | Reviewed legal title, layout and SEO text and native locale publication | One Page ID per legal document, the managed legal route identity and a shared record of the applicable policy | Admin legal pages and MCP find. Managed Pages hooks currently enforce reserved slugs and protect deletion. Preserve those rules and the consent link when adding localized routes. |
| `cookieConsent` | Review consent disclosure text, settings help and labels, and the privacy-policy link label for both languages. Move generic action labels and reusable settings controls through the Product UI Copy workflow. | `enabled`, `consentVersion`, category keys and enabled states, tool assignments and the `privacyPolicyPage` reference | Admin consent global. The schema has English prompt fields and a separate `germanPrompt` group. Preserve both sets of approved wording while settling the ownership of each field. No MCP tools. |

Keep clinical claims and legal meaning consistent across locales. Verify that the translation preserves the approved source and that dates, numeric values, criteria and evidence refer to the same underlying facts. Consent versioning follows changes to processing purposes or service scope. [Treatment config](../src/collections/Treatments.ts) · [Accreditation config](../src/collections/Accreditation.ts) · [Managed legal pages](../src/collections/Pages/legalPages.ts) · [Consent global](../src/globals/CookieConsent/config.ts)

## Deferred collections

| Models | Reason |
| --- | --- |
| `clinicGroups` | Private assignment and provisioning records. The name identifies the same group in Admin and MCP find. |
| `clinicGalleryMedia`, `clinicGalleryEntries` | The distinct before-and-after feature is disabled pending a product decision and legal review. Reassess its media descriptions and entry titles if the feature returns. |
| `userProfileMedia` | Avatar media belongs to a user and has no editorial alt or caption field. |
| `reviews`, `reviewResponses` | Review comments and clinic responses are attributed statements under moderation. Retain their original wording and approval history. Any translation of a statement or moderator-supplied public notice needs a decision about attribution, consent and moderation. MCP exposes review find. |
| `reviewAppeals`, `reviewPublicationTransitions`, `reviewDecisionTransitions` | Private appeal and moderation records or evidence of workflow transitions. |
| `patients`, `clinicStaff`, `platformStaff`, `authActions`, `recoveryRequestEvents` | Accounts, names, access and recovery state are language-independent records. Auth and account interface wording have their own authoring source. |
| `clinicApplications` | Applicant submissions and provisioning state preserve what was submitted. |
| `favoriteclinics` | A private link between a patient and a clinic, with no content fields. |
| `patientClinicInquiries`, `inquiryConversations`, `inquiryMessages`, `inquiryInternalNotes`, `inquiryAttachments`, `inquiryPreparations` | Private communications, their saved drafts and attachments. Preserve the original author input. |
| `inquiryReadPositions`, `inquiryAuditEvents`, `inquiryModerationCases`, `inquiryModerationEvents`, `inquiryRetentionPolicies`, `inquiryLegalHolds`, `inquiryDeletionProofs`, `inquiryCommandLocks` | Operational state or evidence of reading, moderation, retention, deletion and concurrency. |
| `clinicNotificationOccurrences`, `clinicNotificationReadReceipts`, `clinicNotificationControls` | Notification events, receipts and controls. Wording belongs to the notification presentation or delivery workflow. |
| `transactionalEmailOutbox`, `transactionalEmailEvents`, `transactionalEmailSuppressions` | Delivery state, events and suppression data. Localize transactional message templates at their authoring source. |
| `form-submissions` | Responses preserve the submitted values and reference the shared form ID. |
| `exports`, `imports` | Import/export job configuration and results. Recheck import mappings wherever they supply localized fields in a prioritized model. |
| `payload-mcp-api-keys`, `payload-kv`, `payload-jobs`, `payload-locked-documents`, `payload-preferences`, `payload-migrations` | Credentials, storage, jobs, locks, preferences and migration bookkeeping. |

The registered model list includes the disabled collections and plugin/system collections even where there is no public or editorial authoring workflow. [Generated types](../src/payload-types.ts) · [Permission matrix](security/permission-matrix.generated.md)
