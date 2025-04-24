# Features & Plugins

Our platform includes the following core features and official PayloadCMS plugins. For full configuration details, see the official PayloadCMS documentation.

## Website
A production-ready Next.js front-end with:
- Next.js App Router
- TypeScript
- React
- Tailwind CSS
- shadcn/ui components
- using Supabase for:
  - Authentication
  - Storage of media files
  - Database
- Vercel deployment / hosting
- Website Plugins & Integrations:
  - [SEO](#seo)
  - [Search](#search)
  - [Redirects](#redirects)
  - [Draft Preview](#draft-preview)
  - [Live Preview](#live-preview)
  - [On-demand Revalidation](#on-demand-revalidation)

## Globals
Manage global site settings and content.
[Payload Globals Docs](https://payloadcms.com/docs/configuration/globals)

## Access Control
Control access to content based on roles and publishing status.
[Payload Access Control Docs](https://payloadcms.com/docs/access-control/overview)

## Layout Builder

Create unique page layouts for any type of content using a powerful layout builder. This website comes pre-configured with the following layout building blocks provided by PayloadCMS:

- [Hero](/src/heros/config.ts)
- [Content](/src/blocks/Content/config.ts)
- [Media](/src/blocks/MediaBlock/config.ts)
- [Call To Action](/src/blocks/CallToAction/config.ts)
- [Archive](/src/blocks/ArchiveBlock/config.ts)

## Draft Preview

All posts and pages are draft-enabled so you can preview them before publishing them to your website. To do this, these collections use Versions with drafts set to true. This means that when you create a new post, project, or page, it will be saved as a draft and will not be visible on your website until you publish it. This also means that you can preview your draft before publishing it to your website. To do this, we automatically format a custom URL which redirects to your front-end to securely fetch the draft version of your content.

Since the front-end of this template is statically generated, this also means that pages, posts, and projects will need to be regenerated as changes are made to published documents. To do this, we use an afterChange hook to regenerate the front-end when a document has changed and its _status is published.

[Payload Draft Preview Example](https://github.com/payloadcms/payload/tree/main/examples/draft-preview)

## Live Preview
View content updates in real time with SSR.
[Payload Live Preview Docs](https://payloadcms.com/docs/live-preview/overview)

## On-demand Revalidation
This template uses the [on-demand revalidation](https://payloadcms.com/docs/live-preview/on-demand-revalidation) feature of Next.js to automatically revalidate your pages when you publish or update a document in Payload. This means that when you make changes to your content, those changes will be reflected on your website without needing to rebuild or redeploy your front-end.

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
