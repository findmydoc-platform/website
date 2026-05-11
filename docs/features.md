# Features & Plugins

Our platform includes the following core features and official PayloadCMS plugins. For full configuration details, see the official PayloadCMS documentation.

## Website
A production-ready Next.js front-end with:
- Next.js App Router
- TypeScript
- React
- Tailwind CSS
- shadcn/ui components
- [Animation Stack](./frontend/animations.md) (GSAP + ScrollTrigger with CSS sticky layouts)
- [Media Relation Resolution](./frontend/media-relation-resolution.md) (shared media URL/alt handling for relation IDs and populated objects)
- Supabase-backed authentication and optional cloud infrastructure (database and S3-compatible storage) depending on deployment mode
- Vercel deployment / hosting
- Website Plugins & Integrations:
  - [SEO](#seo)
  - [Search](#search)
  - [Redirects](#redirects)
  - [PostHog Analytics](#posthog-analytics)
  - [Preview Access Policy](#preview-access-policy)
  - [Draft Preview](#draft-preview)
  - [Live Preview](#live-preview)
  - [On-demand Revalidation](#on-demand-revalidation)

## Runtime Modes

The same codebase supports three operational modes. The runtime behavior is controlled by environment configuration, not by separate app variants.

| Mode | Database | Media Storage | Typical Use |
| --- | --- | --- | --- |
| `local` | Local Postgres (usually Docker) | Local filesystem uploads | Day-to-day development with minimal cloud dependencies |
| `hybrid` | Supabase Postgres (or another remote Postgres) | Local or S3-compatible storage | Local app runtime with selected cloud dependencies |
| `cloud` | Supabase/managed Postgres | S3-compatible object storage (commonly Supabase Storage via S3 API) | Hosted/staging/production environments |

Notes:
- The S3 adapter is always integrated in code (`src/plugins/index.ts`), but only enabled at runtime when env conditions are met.
- Saying "Supabase is used for DB/storage" is accurate for `hybrid` and `cloud` setups; in `local` mode, local infrastructure can fully replace those services.

## Globals
Manage global site settings and content.
[Payload Globals Docs](https://payloadcms.com/docs/configuration/globals)

Current globals:
- `header` and `footer` manage shared navigation.
- `cookieConsent` manages the public consent prompt.
- `landingPages` manages curated content for `/` and `/partners/clinics`, keeping runtime landing pages independent from Storybook fixtures. Initial text and media references are loaded through the baseline seed, not through Payload migrations.

## Access Control
Control access to content based on roles and publishing status.
[Payload Access Control Docs](https://payloadcms.com/docs/access-control/overview)

## Soft Delete
Core collections use PayloadCMS native soft delete functionality for data preservation and safety.
[Soft Delete Configuration](./soft-delete-implementation.md)

## Access & Ownership Highlights (Current)
- Posts & Pages: Platform Staff have exclusive create/update/delete rights; others can read published content only.
- Media: Platform-owned assets live in `platformContentMedia` (public file delivery for published site content; platform-only write). Clinic-owned assets live in `clinicMedia` (document reads are scope-filtered by access rules; static file URLs can be publicly served to anonymous/patient users when the owning clinic is approved; Clinic Staff can create/update/delete scoped to their assigned clinic).
- FavoriteClinics: Patients manage their own favorites; Platform retains moderation rights.

## Form Systems

We intentionally maintain two parallel form systems:

- **Auth flows** (registration, login, password reset) live in `src/components/organisms/Auth/**` and call Next.js API routes under `/api/auth/**`. They orchestrate Supabase + Payload provisioning via utilities in `src/auth/utilities/**` and reuse shared UI such as `PatientRegistrationForm` and `BaseLoginForm`.
- **Content / marketing forms** (contact, inquiries, etc.) use Payload's forms pipeline via the `Form` block, `/api/form-bridge/[slug]`, `submitFormData`, and `/api/form-submissions`. They never create or mutate Supabase identities.
- The forms collection includes a dedicated `slug` field (`unique`) so frontend forms can target a stable identifier like `holding-contact`.

When adding new forms, decide which system applies and avoid mixing the two.

## Layout Builder

## Data Seeding
For details on baseline vs demo data population, reset semantics, and the tiered error policy, see the [Seeding System](./seeding.md).

Create unique page layouts for any type of content using a powerful layout builder. This website comes pre-configured with the following layout building blocks provided by PayloadCMS:

- [Banner](../src/blocks/Banner/config.ts)
- [Content](../src/blocks/Content/config.ts)
- [Media](../src/blocks/MediaBlock/config.ts)
- [Call To Action](../src/blocks/CallToAction/config.ts)
- [Archive](../src/blocks/ArchiveBlock/config.ts)

## Draft Preview

All posts and pages are draft-enabled so you can preview them before publishing them to your website. To do this, these collections use Versions with drafts set to true. This means that when you create a new post or page, it will be saved as a draft and will not be visible on your website until you publish it. This also means that you can preview your draft before publishing it to your website. To do this, we automatically format a custom URL which redirects to your front-end to securely fetch the draft version of your content.

Since the front-end of the findmydoc portal is statically generated, published pages and posts need to be regenerated whenever their content changes. We use an afterChange hook to trigger a fresh build when a document has changed and its _status is published.

[Payload Draft Preview Example](https://github.com/payloadcms/payload/tree/main/examples/draft-preview)

## Content Localization

The repository uses native Payload CMS localization for multilingual editorial content.
The current runtime configuration enables:

- `en` as the default locale
- `de` as the second enabled locale
- field fallback from `de` to `en`
- shared document publish status because `experimental.localizeStatus` is not enabled

The current rollout scope is limited to editorial `pages` and `posts`.
Public routes remain canonical and default-locale-oriented, so there are no localized slugs, no `/de/...` routes, and no locale-specific sitemap outputs.

Localized fields in the current rollout:

- `pages`: `title`, `layout`, `meta.title`, `meta.description`
- `posts`: `title`, `content`, `excerpt`, `meta.title`, `meta.description`

Shared fields in the current rollout:

- `slug`
- `publishedAt`
- `_status`
- media relations such as `heroImage` and `meta.image`
- taxonomy and relation fields such as `categories`, `tags`, `authors`, and `relatedPosts`

Preview behavior is locale-aware without changing public routing:

- default-locale preview keeps the existing public path
- non-default preview appends `?locale=de`

Search indexing for posts remains default-locale-oriented so localized field objects do not leak into the search collection.

Architecture reference:
- [ADR 018 — Native Payload CMS localization strategy](./adrs/018-adr-native-payload-localization-strategy.md)

## Temporary Landing Mode

PostHog can enable a temporary public landing mode through the server-side feature flag `temporary-landing-mode`.

- Flag default in code: `false`
- URL-specific rules use the PostHog person properties `feature_flag_site_host` and normalized `feature_flag_site_path`
- Missing PostHog configuration or unavailable local evaluation keeps the flag at the code default `false`
- Public and non-platform sessions can access only `/`
- Exempt paths stay reachable: `/privacy-policy`, `/imprint`, `/contact`
- Exempt prefixes stay reachable: `/admin`, `/auth`, `/login`, `/register`
- Other frontend page routes return `404` (no login redirect)
- Platform sessions (`app_metadata.user_type === "platform"`) keep normal access

Priority behavior:
- Temporary Landing Mode takes precedence over normal preview access behavior for non-platform sessions.
- Preview Guard is evaluated through the separate PostHog flag `preview-guard-enabled`.
- When both flags are active, public legal/contact exemptions stay reachable while admin/auth/login/register exemptions remain subject to Preview Guard unless they are Preview Guard login/recovery routes.

## Preview Access Policy

Preview deployments use runtime policy for auth recovery and search-index protection, and PostHog for the optional preview access guard.

- Runtime resolves to `preview` from `VERCEL_ENV` first, then `DEPLOYMENT_ENV`
- `NODE_ENV` is not used as a preview or production deployment signal
- Non-Vercel preview/production runtimes must set `DEPLOYMENT_ENV` explicitly
- Preview Guard login redirects are controlled by the server-side PostHog feature flag `preview-guard-enabled`
- PostHog is the only activation source; the code does not special-case production, preview, or local runtime for this flag
- Missing PostHog configuration or unavailable local evaluation keeps the flag at the code default `false`
- Guard flag checks use a server-side site actor, not the visitor's PostHog cookie identity
- Preview runtime still enables preview-specific admin recovery and search-index blocking

Implementation and usage:
- [Setup: Run Local Dev in Preview Runtime](./setup.md#run-local-dev-in-preview-runtime)
- [Preview Guard Technical Notes](../src/features/previewGuard/README.md)
- [Preview Admin Recovery Decision Flow](../src/auth/README.md#preview-runtime-admin-recovery-flow)

## Live Preview
View content updates in real time with SSR.
[Payload Live Preview Docs](https://payloadcms.com/docs/live-preview/overview)

## On-demand Revalidation
The findmydoc portal uses the [on-demand revalidation](https://nextjs.org/docs/app/getting-started/revalidating) feature of Next.js to automatically revalidate pages when you publish or update a document in Payload. That way, content changes appear on the site without a full rebuild or redeploy.

> Note: if an image has been changed, for example it's been cropped, you will need to republish the page it's used on in order to be able to revalidate the Nextjs image cache.

## SEO
Manage SEO settings from the admin panel.
[Payload SEO Plugin Docs](https://payloadcms.com/docs/plugins/seo)

## Search
Implement SSR search features with Payload Search Plugin.
[Payload Search Plugin Docs](https://payloadcms.com/docs/plugins/search)

## Redirects
Create URL redirects to manage content migrations.
[Payload Redirects Plugin Docs](https://payloadcms.com/docs/plugins/redirects)

## PostHog Analytics
Session replay, error tracking, and web analytics with automatic user identification.
[PostHog Integration Docs](./integrations/posthog.md)
