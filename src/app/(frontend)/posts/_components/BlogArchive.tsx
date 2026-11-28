import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

import { Heading } from '@/components/atoms/Heading'
import { Breadcrumb, type BreadcrumbItem } from '@/components/molecules/Breadcrumb'
import { Container } from '@/components/molecules/Container'
import { BlogCard } from '@/components/organisms/Blog/BlogCard'
import { BlogHero } from '@/components/organisms/Blog/BlogHero'
import { LanguageSwitchRoute } from '@/features/languageSwitch/LanguageSwitchRouteProvider.client'
import { hasRouteSearchParams, NOINDEX_FOLLOW_ROBOTS } from '@/features/searchIndexing'
import { readPublicSiteModeRequestHeader } from '@/features/temporaryLandingMode'
import { buildPostsPagePath } from '@/utilities/content/postPaths'
import { getCachedPostArchivePage } from '@/utilities/content/serverData'
import type { ContentLocale } from '@/utilities/contentLocalization'
import { createSiteMetadata } from '@/utilities/generateMeta'
import { JsonLdScript, buildPostsIndexJsonLd } from '@/utilities/structuredData'

import { normalizeArchiveCard } from '../archiveCards'
import { PostsPagination } from './PostsPagination'

export type BlogArchiveArgs = { searchParams?: Promise<Record<string, string | string[] | undefined>> }
export type BlogPaginationArgs = BlogArchiveArgs & { params: Promise<{ pageNumber: string }> }

async function readPageNumber({ params }: BlogPaginationArgs) {
  const { pageNumber } = await params
  const page = Number(pageNumber)
  if (!/^[1-9]\d*$/.test(pageNumber) || !Number.isSafeInteger(page)) notFound()

  return page
}

export async function renderPaginatedArchive(args: BlogPaginationArgs, locale: ContentLocale) {
  const page = await readPageNumber(args)
  if (page === 1) redirect(buildPostsPagePath(1, { locale }))

  return renderBlogArchive(locale, page)
}

export async function generatePaginatedArchiveMetadata(args: BlogPaginationArgs, locale: ContentLocale) {
  return generateBlogArchiveMetadata(locale, args, await readPageNumber(args))
}

export async function renderBlogArchive(locale: ContentLocale, page = 1) {
  const [posts, t] = await Promise.all([
    getCachedPostArchivePage({ preferredLocale: locale, page }),
    getTranslations({ locale, namespace: 'blog' }),
  ])
  if (page > 1 && (page > posts.totalPages || posts.docs.length === 0)) notFound()

  const alternate = locale === 'de' ? 'en' : 'de'
  const tAlternate = posts.docs.some((post) => post.locale === alternate)
    ? await getTranslations({ locale: alternate, namespace: 'blog' })
    : t
  const normalizedPosts = posts.docs.map((entry) => {
    const articleCopy = entry.locale === locale ? t : tAlternate
    return normalizeArchiveCard(entry, articleCopy('author.editorial'))
  })
  const featuredPost = page === 1 ? normalizedPosts[0] : undefined
  const gridPosts = page === 1 ? normalizedPosts.slice(1) : normalizedPosts
  const breadcrumbs: BreadcrumbItem[] = [
    { label: t('navigation.home'), href: locale === 'en' ? '/en' : '/' },
    { label: t('navigation.blog'), href: buildPostsPagePath(1, { locale }) },
  ]
  if (page > 1) {
    breadcrumbs.push({ label: t('archive.pagination.page', { page }), href: buildPostsPagePath(page, { locale }) })
  }
  const breadcrumbLabel = t('navigation.breadcrumb')

  return (
    <div className={page === 1 ? 'pb-20 sm:pb-24' : 'pt-16 pb-20 sm:pt-24 sm:pb-24'} lang={locale}>
      <LanguageSwitchRoute
        locale={locale}
        targets={{ de: buildPostsPagePath(page, { locale: 'de' }), en: buildPostsPagePath(page, { locale: 'en' }) }}
      />
      <JsonLdScript
        data={buildPostsIndexJsonLd({ breadcrumbs, posts: normalizedPosts, listName: t('archive.listName') })}
      />

      {page === 1 ? (
        <BlogHero
          title={t('archive.title')}
          subtitle={t('archive.subtitle')}
          breadcrumbs={breadcrumbs}
          breadcrumbLabel={breadcrumbLabel}
        />
      ) : (
        <Container className="mb-12 sm:mb-16">
          <div className="prose max-w-none">
            <Breadcrumb items={breadcrumbs} label={breadcrumbLabel} className="mb-6 [&_ol]:justify-center" />
            <Heading as="h1" align="center">
              {t('archive.pagination.title')}
            </Heading>
          </div>
        </Container>
      )}

      {normalizedPosts.length === 0 && (
        <Container className="mt-6 mb-12 sm:mt-8 sm:mb-16">
          <section
            aria-labelledby="empty-posts-heading"
            className="rounded-3xl border border-border bg-muted/30 px-5 py-10 text-center sm:px-8 sm:py-14"
          >
            <Heading id="empty-posts-heading" as="h2" size="h3" align="center">
              {t('archive.emptyTitle')}
            </Heading>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              {t('archive.emptyDescription')}
            </p>
          </section>
        </Container>
      )}

      {featuredPost && (
        <Container className="mt-6 mb-12 sm:mt-8 sm:mb-16">
          <Heading as="h2" size="h3" align="left" className="mb-6">
            {t('archive.latest')}
          </Heading>
          <BlogCard.Overlay
            {...featuredPost}
            lang={featuredPost.locale}
            languageLabelLang={locale}
            languageLabel={featuredPost.locale !== locale ? t(`archive.language.${featuredPost.locale}`) : undefined}
          />
        </Container>
      )}

      {gridPosts.length > 0 && (
        <Container className="mb-12 sm:mb-16">
          <div className="mb-6">
            <Heading as="h2" size="h3" align="left">
              {t('archive.more')}
            </Heading>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('archive.count', { count: Math.max(posts.totalDocs - 1, 0) })}
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 md:gap-8 xl:grid-cols-3">
            {gridPosts.map((post) => (
              <BlogCard.Simple
                key={post.href}
                {...post}
                lang={post.locale}
                languageLabelLang={locale}
                languageLabel={post.locale !== locale ? t(`archive.language.${post.locale}`) : undefined}
              />
            ))}
          </div>
        </Container>
      )}

      {posts.totalPages > 1 && (
        <Container>
          <PostsPagination
            locale={locale}
            page={page}
            totalPages={posts.totalPages}
            copy={{
              label: t('archive.pagination.navigation'),
              previous: { text: t('archive.pagination.previous'), label: t('archive.pagination.previousLabel') },
              next: { text: t('archive.pagination.next'), label: t('archive.pagination.nextLabel') },
            }}
          />
        </Container>
      )}
    </div>
  )
}

export async function generateBlogArchiveMetadata(
  locale: ContentLocale,
  args: BlogArchiveArgs,
  page = 1,
): Promise<Metadata> {
  const [t, requestHeaders, searchParams] = await Promise.all([
    getTranslations({ locale, namespace: 'blog.archive' }),
    headers(),
    args.searchParams,
  ])
  const holding = readPublicSiteModeRequestHeader(requestHeaders) === 'holding'
  const noindex = hasRouteSearchParams(searchParams) || (holding && locale === 'en')
  const path = buildPostsPagePath(page, { locale })
  const metadata = createSiteMetadata({
    title: page === 1 ? t('metadataTitle') : t('pagination.metadataTitle', { page }),
    description: t('metadataDescription'),
    path,
  })
  const de = buildPostsPagePath(page, { locale: 'de' })

  return {
    ...metadata,
    alternates: {
      canonical: path,
      ...(!holding &&
        !noindex && {
          languages: { de, en: buildPostsPagePath(page, { locale: 'en' }), 'x-default': de },
        }),
    },
    ...(noindex && { robots: NOINDEX_FOLLOW_ROBOTS }),
  }
}
