import type { Metadata } from 'next'
import { getPayload } from 'payload'
import { createTranslator } from 'next-intl'
import configPromise from '@payload-config'
import germanMessages from '@findmydoc-platform/ui-copy/de.json'
import englishMessages from '@findmydoc-platform/ui-copy/en.json'

import { BlogCardCollection } from '@/components/organisms/Blog/BlogCardCollection'
import { FAQSection } from '@/components/organisms/FAQ'
import { LandingHero } from '@/components/organisms/Heroes/LandingHero'
import { LandingCategories, LandingProcessRing } from '@/components/organisms/Landing'
import { LandingFeatures } from '@/components/organisms/Landing/LandingFeatures'
import { LandingTestimonials } from '@/components/organisms/Landing/LandingTestimonials'
import { ScrollReveal } from '@/components/molecules/ScrollReveal'
import { LocalizedPublicContactSection } from '@/features/contactRequests/LocalizedPublicContactSection'
import { CmsLanguageSwitchRoute } from '@/features/languageSwitch/CmsLanguageSwitchRoute.client'
import { getTaxonomyDisplayName } from '@/features/listingComparison/taxonomy'
import { BLOG_ARCHIVE_PATHS } from '@/i18n/blogArchivePath'
import { LISTING_COMPARISON_PATHS } from '@/i18n/listingComparisonPath'
import { getCachedPostArchivePage, type PublicPageRoute } from '@/utilities/content/serverData'
import type { ContentLocale } from '@/utilities/contentLocalization'
import { createSiteMetadata, generateMeta } from '@/utilities/generateMeta'
import { getHomeLandingContent } from '@/utilities/landing/landingPageContent'
import { getLandingMedicalSpecialtyCategories } from '@/utilities/landing/medicalSpecialtyCategories'
import { normalizeArchiveCard } from '../posts/archiveCards'
import { getPublishedNavigationPageSlugs } from './holdingLegalLinks'

export const fullHomeAlternates = { de: '/', en: '/en', 'x-default': '/' }

const catalogs = { de: germanMessages, en: englishMessages }

export async function renderFullHome(
  locale: ContentLocale,
  { page, extraContent }: { page?: PublicPageRoute['page']; extraContent?: React.ReactNode } = {},
) {
  const payload = await getPayload({ config: configPromise })
  const [landingContent, posts, specialtyCategories, cityResult, englishAvailable] = await Promise.all([
    getHomeLandingContent(locale),
    getCachedPostArchivePage({ preferredLocale: locale }),
    getLandingMedicalSpecialtyCategories(payload, locale),
    payload.find({
      collection: 'cities',
      locale,
      fallbackLocale: false,
      depth: 0,
      limit: 250,
      overrideAccess: false,
      pagination: false,
      sort: 'name',
      select: { id: true, name: true, displayName: true },
    }),
    isEnglishFullHomeAvailable(locale),
  ])

  const t = createTranslator({ locale, messages: catalogs[locale], namespace: 'website.home' })
  const blog = createTranslator({ locale, messages: catalogs[locale], namespace: 'blog' })
  const comparisonPath = LISTING_COMPARISON_PATHS[locale]
  const heroServiceOptions = specialtyCategories.items
    .map(({ title: label, id: value }) => ({ label, value }))
    .sort((a, b) => a.label.localeCompare(b.label, locale))
  const heroLocationOptions = cityResult.docs
    .map((city) => ({ label: getTaxonomyDisplayName(city, locale).trim(), value: String(city.id) }))
    .filter(({ label }) => Boolean(label))
    .sort((a, b) => a.label.localeCompare(b.label, locale))
  const testimonialIndex = (index: number) => ({ index: index + 1, total: landingContent.testimonials.length })
  const normalizedPosts = posts.docs.slice(0, 3).map((entry) => {
    const postCopy = createTranslator({ locale: entry.locale, messages: catalogs[entry.locale], namespace: 'blog' })
    return {
      ...normalizeArchiveCard(entry, postCopy('author.editorial')),
      lang: entry.locale,
      languageLabel: entry.locale === locale ? undefined : blog(`archive.language.${entry.locale}`),
      languageLabelLang: locale,
    }
  })

  return (
    <article lang={locale}>
      <CmsLanguageSwitchRoute locale={locale} targets={englishAvailable ? fullHomeAlternates : { de: '/' }} />
      <LandingHero
        title={landingContent.hero.title || page?.title || ''}
        description={landingContent.hero.description}
        image={landingContent.hero.image}
        variant="homepage"
        searchDestination={comparisonPath}
        searchCopy={{
          service: {
            label: t('search.specialty'),
            prompt: t('search.specialtyPrompt'),
            search: t('search.specialtySearch'),
            empty: t('search.specialtyEmpty'),
          },
          location: {
            label: t('search.location'),
            prompt: t('search.locationPrompt'),
            search: t('search.locationSearch'),
            empty: t('search.locationEmpty'),
          },
          budget: t('search.budget'),
          submit: t('search.submit'),
        }}
        searchOptions={{ service: heroServiceOptions, location: heroLocationOptions }}
      />

      {landingContent.testimonialsIntro.title && landingContent.testimonials.length > 0 && (
        <ScrollReveal>
          <LandingTestimonials
            testimonials={landingContent.testimonials}
            title={landingContent.testimonialsIntro.title}
            description={landingContent.testimonialsIntro.description}
            className="md:pt-28"
            copy={{
              carousel: t('testimonials.carousel'),
              slide: t('testimonials.slide'),
              positions: landingContent.testimonials.map((_, index) =>
                t('testimonials.position', testimonialIndex(index)),
              ),
              navigation: landingContent.testimonials.map((_, index) =>
                t('testimonials.goTo', testimonialIndex(index)),
              ),
            }}
          />
        </ScrollReveal>
      )}

      {landingContent.categoriesIntro.title && (
        <ScrollReveal>
          <LandingCategories
            title={landingContent.categoriesIntro.title}
            description={landingContent.categoriesIntro.description}
            categories={specialtyCategories.categories}
            items={specialtyCategories.items.map((item) => ({
              ...item,
              linkLabel: t('categories.explore', { specialty: item.title }),
            }))}
            featuredIds={specialtyCategories.featuredIds}
            moreCategoriesLink={{ href: comparisonPath }}
            copy={{
              all: t('categories.all'),
              filters: t('categories.label'),
              viewAll: t('categories.viewAll'),
              moreByCategory: Object.fromEntries(
                specialtyCategories.categories.map(({ label, value }) => [
                  value,
                  t('categories.more', { category: label }),
                ]),
              ),
            }}
          />
        </ScrollReveal>
      )}

      {landingContent.features.title && (
        <ScrollReveal>
          <LandingFeatures
            variant="green"
            backgroundImage={landingContent.features.backgroundImage}
            backgroundParallax={{ rangePx: 64 }}
            features={landingContent.features.items.filter((feature) => Boolean(feature.title && feature.description))}
            title={landingContent.features.title}
            description={landingContent.features.description}
          />
        </ScrollReveal>
      )}

      {landingContent.process.title && (
        <ScrollReveal>
          <LandingProcessRing
            title={landingContent.process.title}
            description={landingContent.process.subtitle}
            steps={landingContent.process.steps
              .filter(({ title, description }) => Boolean(title && description))
              .map(({ step, title, description }) => ({ id: String(step), title, body: description }))}
            stepsLabel={t('process.steps')}
            preset="balanced"
            palette="brand"
            size={620}
            startAngle={25}
            endAngle={335}
            orbitMargin={0}
            logoScale={1.7}
            backgroundColor="#ffffff"
            accentColor="#42E2B7"
            primaryColor="#006DE5"
            vibrancy={1}
            colorBalance={0.4}
            organicness={0}
            density={0.58}
            speed={0.15}
            wobble={0.62}
            glow={1}
          />
        </ScrollReveal>
      )}

      {landingContent.faq.title && (
        <ScrollReveal>
          <FAQSection
            title={landingContent.faq.title}
            description={landingContent.faq.description}
            items={landingContent.faq.items.filter(({ question, answer }) => Boolean(question && answer))}
          />
        </ScrollReveal>
      )}

      {landingContent.blogTeaser.title && normalizedPosts.length > 0 && (
        <ScrollReveal>
          <BlogCardCollection
            title={landingContent.blogTeaser.title}
            intro={landingContent.blogTeaser.description}
            posts={normalizedPosts}
            moreLink={{ href: BLOG_ARCHIVE_PATHS[locale], label: t('blog.more') }}
          />
        </ScrollReveal>
      )}

      {extraContent}

      {landingContent.contact.title && (
        <ScrollReveal>
          <LocalizedPublicContactSection
            locale={locale}
            title={landingContent.contact.title}
            description={landingContent.contact.description}
          />
        </ScrollReveal>
      )}
    </article>
  )
}

async function isEnglishFullHomeAvailable(locale: ContentLocale) {
  return locale === 'en' || (await getPublishedNavigationPageSlugs('en')).includes('home')
}

export async function generateFullHomeMetadata(
  locale: ContentLocale,
  page?: PublicPageRoute['page'],
): Promise<Metadata> {
  const path = fullHomeAlternates[locale]
  const [{ metadata }, englishAvailable] = await Promise.all([
    getHomeLandingContent(locale),
    isEnglishFullHomeAvailable(locale),
  ])
  const title = typeof metadata.title === 'string' ? metadata.title : undefined
  const result = page
    ? await generateMeta({
        doc: {
          ...page,
          meta: {
            ...page.meta,
            title: page.meta?.title || title || page.title,
            description: page.meta?.description || metadata.description,
          },
        },
        path,
        sourceCollection: 'pages',
      })
    : createSiteMetadata({ title, description: metadata.description, path })
  return englishAvailable ? { ...result, alternates: { canonical: path, languages: fullHomeAlternates } } : result
}
