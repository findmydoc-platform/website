import { buildPublicDiscoveryBlockedResponse, type PublicDiscoveryAccess } from './access'
import { PUBLIC_CANONICAL_SITE_URL, toPublicCanonicalUrl } from './site'

export const LLMS_TXT_CONTENT_TYPE = 'text/markdown; charset=utf-8'
export const LLMS_TXT_CACHE_CONTROL = 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800'

type LlmsTxtLink = {
  description: string
  href: string
  label: string
}

type LlmsTxtSection = {
  heading: string
  items: string[]
}

type LlmsTxtDocument = {
  intro: string[]
  sections: LlmsTxtSection[]
  summary: string
  title: string
}

const renderLinkItem = ({ description, href, label }: LlmsTxtLink): string => {
  return `[${label}](${href}): ${description}`
}

const keyUrlLinks = [
  {
    description: 'Public entry point for findmydoc.',
    href: toPublicCanonicalUrl('/'),
    label: 'Home',
  },
  {
    description: 'Canonical public clinic comparison entry point.',
    href: toPublicCanonicalUrl('/listing-comparison'),
    label: 'Clinic comparison',
  },
  {
    description: 'Approved public clinic detail pages use readable clinic slugs.',
    href: toPublicCanonicalUrl('/clinics/{clinic-slug}'),
    label: 'Clinic profile pattern',
  },
  {
    description: 'Public article index.',
    href: toPublicCanonicalUrl('/posts'),
    label: 'Posts',
  },
  {
    description: 'Public company and platform context.',
    href: toPublicCanonicalUrl('/about'),
    label: 'About',
  },
  {
    description: 'Public contact path.',
    href: toPublicCanonicalUrl('/contact'),
    label: 'Contact',
  },
  {
    description: 'Public privacy information.',
    href: toPublicCanonicalUrl('/privacy-policy'),
    label: 'Privacy policy',
  },
  {
    description: 'Public legal provider information.',
    href: toPublicCanonicalUrl('/imprint'),
    label: 'Imprint',
  },
  {
    description: 'Public page sitemap.',
    href: toPublicCanonicalUrl('/pages-sitemap.xml'),
    label: 'Pages sitemap',
  },
  {
    description: 'Public post sitemap.',
    href: toPublicCanonicalUrl('/posts-sitemap.xml'),
    label: 'Posts sitemap',
  },
] satisfies LlmsTxtLink[]

const llmsTxtDocument = {
  intro: [
    'Use this file as curated agent context for public findmydoc pages. It is not a full content dump, not a crawler policy, and not access to private systems.',
  ],
  sections: [
    {
      heading: 'Key URLs',
      items: keyUrlLinks.map(renderLinkItem),
    },
    {
      heading: 'Public Data Types',
      items: [
        'Clinics: Approved public clinic profiles and comparison details that are visible on public pages.',
        'Articles: Published public posts and general information pages.',
        'Legal and company pages: Public privacy, imprint, contact, and platform information.',
        'Discovery metadata: Public sitemap entries, canonical URLs, structured data, and source-backed freshness signals.',
      ],
    },
    {
      heading: 'Citation Guidance',
      items: [
        `Cite canonical production URLs on ${PUBLIC_CANONICAL_SITE_URL}.`,
        'Prefer page-level citations over inferred summaries.',
        'Do not cite preview, authenticated, internal, draft, unpublished, or query-variant URLs.',
        'Do not infer ratings, review counts, accreditations, prices, recommendations, or medical-quality claims unless they are visibly present on the cited public page.',
      ],
    },
    {
      heading: 'Freshness Policy',
      items: [
        'Prefer visible page dates, sitemap lastmod values, and source-backed freshness signals.',
        'Treat request-time timestamps as crawl time, not content freshness.',
        'If a public page has no visible or source-backed freshness signal, omit the freshness claim.',
      ],
    },
    {
      heading: 'Medical Disclaimer',
      items: [
        'findmydoc is a comparison and contact platform. It does not provide medical advice.',
        'Public clinic and comparison information supports discovery and contact decisions; it is not a medical recommendation.',
        'Patients should consult qualified medical professionals before making medical decisions.',
      ],
    },
    {
      heading: 'Contact Path',
      items: [`Use [Contact](${toPublicCanonicalUrl('/contact')}) for public contact and follow-up requests.`],
    },
  ],
  summary: 'findmydoc is an international patient clinic discovery, comparison, and contact platform.',
  title: 'findmydoc',
} satisfies LlmsTxtDocument

const renderSection = ({ heading, items }: LlmsTxtSection): string => {
  return [`## ${heading}`, '', ...items.map((item) => `- ${item}`)].join('\n')
}

const renderLlmsTxtDocument = ({ intro, sections, summary, title }: LlmsTxtDocument): string => {
  return [`# ${title}`, '', `> ${summary}`, '', ...intro, '', ...sections.map(renderSection), ''].join('\n\n')
}

export const buildLlmsTxt = (): string => {
  return renderLlmsTxtDocument(llmsTxtDocument)
}

export const buildLlmsTxtResponse = (access: PublicDiscoveryAccess): Response => {
  if (!access.allowed) {
    return buildPublicDiscoveryBlockedResponse()
  }

  return new Response(buildLlmsTxt(), {
    headers: {
      'Cache-Control': LLMS_TXT_CACHE_CONTROL,
      'Content-Type': LLMS_TXT_CONTENT_TYPE,
    },
    status: 200,
  })
}
