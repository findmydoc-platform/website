import type { ReactNode } from 'react'

import { LanguageSwitcher } from '@/components/molecules/LanguageSwitcher'
import { HoldingPageConcept } from '@/components/templates/HoldingPageConcept'
import {
  getTemporaryLandingBlogCopy,
  type TemporaryLandingLanguageOption,
  type TemporaryLandingLocale,
  type TemporaryLandingPageContent,
} from '@/features/temporaryLandingMode'
import type { BlogCardBaseProps } from '@/utilities/blog/normalizePost'
import { buildPostsIndexPath } from '@/utilities/content/postPaths'
import type { ContentLocaleContext } from '@/utilities/contentLocalization'
import { TemporaryLandingBlogSection } from './TemporaryLandingBlogSection'

export type TemporaryLandingPageProps = {
  contactForm: ReactNode
  content: TemporaryLandingPageContent
  contentLocale: ContentLocaleContext
  languageOptions: TemporaryLandingLanguageOption[]
  locale: TemporaryLandingLocale
  posts: BlogCardBaseProps[]
}

export function TemporaryLandingPage({
  contactForm,
  content,
  contentLocale,
  languageOptions,
  locale,
  posts,
}: TemporaryLandingPageProps) {
  const blogCopy = getTemporaryLandingBlogCopy(locale)

  return (
    <HoldingPageConcept
      {...content}
      contactForm={contactForm}
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
