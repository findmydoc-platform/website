import { LanguageSwitcher } from '@/components/molecules/LanguageSwitcher'
import { HoldingPageConcept } from '@/components/templates/HoldingPageConcept'
import {
  getTemporaryLandingBlogCopy,
  getTemporaryLandingPageContent,
  type TemporaryLandingLanguageOption,
  type TemporaryLandingLocale,
} from '@/features/temporaryLandingMode'
import type { BlogCardBaseProps } from '@/utilities/blog/normalizePost'
import { buildPostsIndexPath } from '@/utilities/content/postPaths'
import type { ContentLocaleContext } from '@/utilities/contentLocalization'
import { TemporaryLandingBlogSection } from './TemporaryLandingBlogSection'

type TemporaryLandingPageProps = {
  contentLocale: ContentLocaleContext
  languageOptions: TemporaryLandingLanguageOption[]
  locale: TemporaryLandingLocale
  posts: BlogCardBaseProps[]
}

export function TemporaryLandingPage({ contentLocale, languageOptions, locale, posts }: TemporaryLandingPageProps) {
  const content = getTemporaryLandingPageContent(locale)
  const blogCopy = getTemporaryLandingBlogCopy(locale)

  return (
    <HoldingPageConcept
      {...content}
      afterSignals={
        <TemporaryLandingBlogSection
          ctaHref={buildPostsIndexPath(contentLocale)}
          ctaLabel={blogCopy.ctaLabel}
          description={blogCopy.description}
          posts={posts}
          title={blogCopy.title}
        />
      }
      heroOverlay={
        <LanguageSwitcher
          ariaLabel="Landing page language"
          className="pointer-events-auto"
          currentValue={locale}
          options={languageOptions}
        />
      }
    />
  )
}
