# Website features and integrations

See [Website architecture](./architecture/README.md) for the application boundaries and
[Payload configuration](../src/payload.config.ts) for registered collections, globals, and endpoints. The
[plugin configuration](../src/plugins/index.ts) owns SEO metadata, redirects, the form builder, and storage wiring. For the public UI, see the
[animation stack](./frontend/animations.md) and [media relation resolution](./frontend/media-relation-resolution.md).

## Runtime modes

The same Website runs with local, hybrid, or hosted infrastructure. Payload owns media metadata and its S3 adapter
stores the bytes. Local and hybrid development use S3Mock. [Storage modes](./integrations/storage.md#runtime-modes-local--hybrid--cloud) ·
[Database connection policy](./engineering/database-runtime-connections.md)

## Form systems

| Purpose | Owning boundary |
| --- | --- |
| Sign-in, registration, and password reset | [Auth routes](../src/app/api/auth) coordinate Supabase identity and Payload principals. |
| Editorial and marketing forms | [Form Bridge](../src/app/api/form-bridge) resolves Payload forms by their unique slug and forwards submissions to Payload without changing identities. |
| Clinic-profile contact requests | The [clinic contact endpoint](../src/app/api/clinic-contact-requests/route.ts) stores a private, unsent preparation after the visitor authorizes account creation and later submission. A [verified patient handoff](./security/auth-actions.md#prepared-inquiry-handoff) submits the inquiry to the clinic. |

## Editorial content

The [Page](../src/collections/Pages/index.ts) and [Post](../src/collections/Posts/index.ts) definitions own the editing
and preview configuration. The [preview path builder](../src/utilities/generatePreviewPath.ts) carries the selected
locale. Public readers see published content. Draft and live preview use the private read path. Publish and delete
hooks attempt on-demand cache invalidation through the [cache revalidation runtime](./engineering/cache-revalidation-runtime.md).

The [runtime content locales](../src/utilities/contentLocalization.ts) use English as the default and as German field
fallback. Pages and posts share a document-level publication status. Canonical editorial URLs and sitemaps do not
vary by locale. [ADR 038](./adrs/038-adr-native-payload-locale-publication.md) records the decision to move to
independent native locale publication.

The [landing-page global](../src/globals/LandingPages) supplies the homepage and clinic-partner landing content. The
[baseline seed](./seeding.md) supplies its initial text and media references. In Full mode, missing required content on either page fails visibly so static or Storybook content cannot hide an incomplete CMS or seed. [Why the fallback was removed](https://github.com/findmydoc-platform/website/pull/1307#management-summary)

## Temporary Landing Mode

PostHog's server-side `temporary-landing-mode` flag chooses Full or Holding. An unavailable flag evaluation uses
`PUBLIC_SITE_FALLBACK_MODE`. Public discovery uses the host-wide decision. The [PostHog guide](./integrations/posthog.md#holding-mode-flag)
covers targeting, consent, and propagation. The [discovery strategy](./public-discovery-strategy.md#public-surfaces)
covers what remains public and indexable.

For a full launch, coordinate the Production fallback `full` with an evaluated `false` flag. For rollback, set the
flag to `true` and the fallback to `holding`. The frontend template reads the resolved mode for each request,
including navigations that reuse the root layout. Platform sessions keep normal access. While Holding is active for
other visitors, [the proxy](../src/proxy.ts) returns `404` for paths blocked by the
[Holding access policy](../src/features/temporaryLandingMode/index.ts).

## Preview Access Policy

Vercel Authentication with Standard Protection guards Preview. The Website's
[server runtime policy](../src/features/runtimePolicy/core.ts) resolves Preview from `VERCEL_ENV` first and
`DEPLOYMENT_ENVIRONMENT` second. Set `DEPLOYMENT_ENVIRONMENT` for non-Vercel Preview or Production. Request
hostnames and `NODE_ENV` do not select either hosted environment.

Preview applies search-index protection. MCP and the Clinic Dashboard API retain their endpoint-owned machine
authentication. Form Bridge forwards request credentials only to validated same-origin Payload calls.
[Local Preview setup](./setup.md#run-local-dev-in-preview-runtime) ·
[Runtime admin recovery](./security/authentication-system.md#runtime-admin-recovery)

## Public discovery and monitoring

Use the [public discovery strategy](./public-discovery-strategy.md) for canonical URLs, site modes, sitemap and
`llms.txt` availability, and crawler logging. [Monitoring and error handling](./monitoring-and-error-logic.md)
covers production logs, PostHog error tracking, and deployment signals.
