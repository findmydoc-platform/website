import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { getTranslations } from 'next-intl/server'

import { resolvePost } from '@/app/(frontend)/_data/resolvePost'
import { RelatedPosts } from '@/blocks/RelatedPosts/Component'
import {
  CmsTranslationUnavailable,
  cmsTranslationNoticeTitle,
} from '@/app/(frontend)/_components/CmsTranslationUnavailable'
import { PayloadRedirects } from '@/app/(frontend)/_components/PayloadRedirects'
import RichText from '@/blocks/_shared/RichText'

import { PostHero } from '@/components/organisms/Heroes/PostHero'
import { generateMeta } from '@/utilities/generateMeta'
import PageClient from './page.client'
import { LivePreviewListener } from '@/components/organisms/LivePreviewListener'
import { Container } from '@/components/molecules/Container'
import { DisclaimerNotice } from '@/components/molecules/DisclaimerNotice'
import { estimateReadMinutes } from '@/utilities/blog/calculateReadTime'
import { formatDate } from '@/utilities/blog/formatDate'
import { resolveMediaImage } from '@/utilities/media/resolveMediaImage'
import { PostShareActionBar } from './PostShareActionBar'
import { CmsLanguageSwitchRoute } from '@/features/languageSwitch/CmsLanguageSwitchRoute.client'
import { CMS_TRANSLATION_SOURCE_HEADER } from '@/utilities/routing/cmsRedirectRequest'
import { CmsDocumentLanguage } from '@/features/uiCopy/DocumentLanguage.client'
import type { ContentLocale, ContentLocaleContext } from '@/utilities/contentLocalization'
import { buildPostsIndexPath } from '@/utilities/content/postPaths'
import { createBlogBreadcrumb, HOME_BREADCRUMB } from '@/utilities/breadcrumbs'
import { JsonLdScript, buildArticlePageJsonLd } from '@/utilities/structuredData'

export type PostPageArgs = {
  params: Promise<{
    slug?: string
  }>
  searchParams: Promise<{
    locale?: string | string[]
  }>
}

export async function renderPost(args: PostPageArgs, pathLocale: ContentLocale) {
  const { draft, requestPath, route, germanPath } = await loadPostRoute(args, pathLocale)
  if (!route) {
    if (!germanPath) return <PayloadRedirects url={requestPath} />

    const blogBreadcrumb = createBlogBreadcrumb(buildPostsIndexPath({ locale: 'en' }))
    return (
      <CmsTranslationUnavailable
        germanPath={germanPath}
        breadcrumbs={[HOME_BREADCRUMB, { ...blogBreadcrumb, current: false }]}
      />
    )
  }

  const { post, locale, canonicalPath } = route
  const t = await getTranslations({ locale, namespace: 'blog' })
  const contentLocale: ContentLocaleContext = { locale, fallbackLocale: false }

  const firstAuthor = post.populatedAuthors?.[0]
  const authorData = firstAuthor?.name
    ? { name: firstAuthor.name, avatar: firstAuthor.avatar || undefined, role: t('article.authorRole') }
    : { name: t('author.editorial'), role: t('article.editorialRole') }

  const heroImage =
    post.heroImage && typeof post.heroImage === 'object'
      ? resolveMediaImage(post.heroImage, {
          fallbackAlt: post.title,
          usage: 'hero',
        })
      : undefined

  const breadcrumbs = [
    { label: t('navigation.home'), href: locale === 'en' ? '/en' : '/' },
    { label: t('navigation.blog'), href: buildPostsIndexPath(contentLocale) },
    { label: post.title, href: canonicalPath, lang: locale },
  ]
  const minutes = estimateReadMinutes(post.content)
  const readTime =
    minutes === null ? undefined : minutes === 0 ? t('article.readTimeShort') : t('article.readTime', { minutes })
  const hasPostContent = Boolean(post.content?.root?.children?.length)
  const relatedPosts = post.relatedPosts?.filter((related) => typeof related === 'object').filter(({ slug }) => slug)

  return (
    <article className="pb-16 sm:pb-20" lang={locale}>
      <CmsDocumentLanguage locale={locale} />
      {!draft && (
        <CmsLanguageSwitchRoute locale={locale} targets={route.languagePaths ?? { [locale]: canonicalPath }} />
      )}
      <PageClient />
      <JsonLdScript
        data={
          draft
            ? null
            : buildArticlePageJsonLd({
                authorName: firstAuthor?.name,
                breadcrumbs,
                description: post.excerpt,
                imageUrl: heroImage?.src,
                inLanguage: locale,
                path: canonicalPath,
                publishedAt: post.publishedAt,
                title: post.title,
                updatedAt: post.updatedAt,
              })
        }
      />

      {/* Allows redirects for valid pages too */}
      <PayloadRedirects disableNotFound url={requestPath} />

      {draft && <LivePreviewListener />}

      <PostHero
        title={post.title}
        excerpt={post.excerpt || undefined}
        categories={post.categoryLabel ? [post.categoryLabel.title] : undefined}
        categoryLang={post.categoryLabel?.lang}
        author={authorData}
        publishedAt={post.publishedAt || undefined}
        readTime={readTime}
        dateLabel={post.publishedAt ? formatDate(post.publishedAt, locale) : undefined}
        breadcrumbLabel={t('navigation.breadcrumb')}
        breadcrumbs={breadcrumbs}
        image={heroImage}
      />

      {/* Action Bar - Back Link & Share Button */}
      <PostShareActionBar
        backLink={{ label: t('article.back'), href: buildPostsIndexPath(contentLocale) }}
        shareLabel={t('article.share')}
        shareUrl={canonicalPath}
        shareTitle={post.title}
        shareDescription={post.excerpt || undefined}
      />

      <div className="py-8 sm:py-10 md:py-12">
        <Container>
          <div className="grid grid-cols-1 lg:grid-cols-12">
            <div className="lg:col-span-8 lg:col-start-3">
              {hasPostContent ? (
                <RichText
                  className="text-muted-foreground [&.prose]:max-w-none"
                  contentLocale={contentLocale}
                  data={post.content}
                  enableGutter={false}
                />
              ) : null}
              <DisclaimerNotice
                accessibleLabel={t('article.disclaimerLabel')}
                copy={t('article.disclaimer')}
                variant="slim-notice-bar"
                standalone={true}
                className={hasPostContent ? 'mt-10 sm:mt-12' : 'mt-0'}
              />
              {relatedPosts && relatedPosts.length > 0 && (
                <RelatedPosts
                  className="mt-10 sm:mt-12"
                  contentLocale={contentLocale}
                  docs={relatedPosts}
                  dateLocale={locale}
                />
              )}
            </div>
          </div>
        </Container>
      </div>
    </article>
  )
}

export async function generatePostMetadata(args: PostPageArgs, pathLocale: ContentLocale): Promise<Metadata> {
  const { draft, route, germanPath } = await loadPostRoute(args, pathLocale)
  if (!route) {
    return {
      robots: { index: false, follow: false },
      ...(germanPath ? { title: cmsTranslationNoticeTitle } : {}),
    }
  }

  const metadata = await generateMeta({
    doc: {
      ...route.post,
      meta: {
        ...route.post.meta,
        title: route.post.meta?.title || route.post.title,
        description: route.post.meta?.description || route.post.excerpt,
      },
    },
    path: route.canonicalPath,
    sourceCollection: 'posts',
  })
  if (draft) return { ...metadata, robots: { index: false, follow: false } }
  if (!route.languagePaths) return metadata
  return {
    ...metadata,
    alternates: { canonical: route.canonicalPath, languages: route.languagePaths },
  }
}

async function loadPostRoute({ params, searchParams }: PostPageArgs, pathLocale: ContentLocale) {
  const [{ slug = '' }, { locale }] = await Promise.all([params, searchParams])
  const previewLocale = locale === 'en' || locale === 'de' ? locale : pathLocale
  const requestPath = `${pathLocale === 'en' ? '/en' : ''}/posts/${slug}`
  const result = await resolvePost(slug, pathLocale, previewLocale)
  const germanPath =
    !result.route && !result.draft && pathLocale === 'en' ? (await headers()).get(CMS_TRANSLATION_SOURCE_HEADER) : null
  return { requestPath, ...result, germanPath }
}
