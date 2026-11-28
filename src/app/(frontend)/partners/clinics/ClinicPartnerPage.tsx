import type { Metadata } from 'next'
import { createTranslator } from 'next-intl'
import germanMessages from '@findmydoc-platform/ui-copy/de.json'
import englishMessages from '@findmydoc-platform/ui-copy/en.json'

import { resolveEditorialLandingRoute } from '../../_data/editorialLandingRoute'
import { BLOG_ARCHIVE_PATHS } from '@/i18n/blogArchivePath'
import { LISTING_COMPARISON_PATHS } from '@/i18n/listingComparisonPath'
import { CLINIC_PARTNER_PATHS } from '@/i18n/editorialLandingPaths'
import type { ContentLocale } from '@/utilities/contentLocalization'

import { Heading } from '@/components/atoms/Heading'
import {
  LandingCategories,
  LandingFeatures,
  LandingProcess,
  LandingTeam,
  LandingTestimonials,
} from '@/components/organisms/Landing'
import { BlogCardCollection } from '@/components/organisms/Blog/BlogCardCollection'
import { LandingHero } from '@/components/organisms/Heroes/LandingHero'
import { CallToAction } from '@/components/organisms/CallToAction'
import { FAQSection } from '@/components/organisms/FAQ'
import { ScrollReveal } from '@/components/molecules/ScrollReveal'
import { ClinicRegistrationLandingSection } from '../../_components/ClinicRegistrationLandingSection'
import { getCachedPostArchivePage } from '@/utilities/content/serverData'
import { normalizeArchiveCard } from '../../posts/archiveCards'
import { clinicApplicationCopy } from '@/features/uiCopy/clinicApplication.server'
import { getClinicRegistrationTreatmentCategories } from '@/utilities/clinicRegistration/treatmentCategories'
import { getClinicPartnerLandingContent } from '@/utilities/landing/landingPageContent'
import { getLandingMedicalSpecialtyCategories } from '@/utilities/landing/medicalSpecialtyCategories'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

const catalogs = { de: germanMessages, en: englishMessages }

export async function renderClinicPartnerPage(locale: ContentLocale) {
  const route = await resolveEditorialLandingRoute('clinicPartners', CLINIC_PARTNER_PATHS, locale)
  if (!route.available) return route.renderUnavailable()

  const payload = await getPayload({ config: configPromise })
  const [landingContent, posts, landingSpecialtyCategories, clinicRegistrationTreatmentCategories, applicationCopy] =
    await Promise.all([
      getClinicPartnerLandingContent(locale),
      getCachedPostArchivePage({ preferredLocale: locale }),
      getLandingMedicalSpecialtyCategories(payload, locale),
      getClinicRegistrationTreatmentCategories(payload, locale),
      clinicApplicationCopy(locale),
    ])

  const t = createTranslator({ locale, messages: catalogs[locale], namespace: 'website.home' })
  const blog = createTranslator({ locale, messages: catalogs[locale], namespace: 'blog' })
  const testimonials = landingContent.testimonials.filter(({ quote, role }) => Boolean(quote && role))
  const testimonialPosition = (index: number) => ({ index: index + 1, total: testimonials.length })
  const normalizedPosts = posts.docs.slice(0, 3).map((entry) => {
    const postCopy = createTranslator({ locale: entry.locale, messages: catalogs[entry.locale], namespace: 'blog' })
    return {
      ...normalizeArchiveCard(entry, postCopy('author.editorial')),
      lang: entry.locale,
      languageLabel: entry.locale === locale ? undefined : blog(`archive.language.${entry.locale}`),
      languageLabelLang: locale,
    }
  })
  const partnerContactHref = '#contact'

  return (
    <article className="flex min-h-screen flex-col">
      {route.switcher}
      <LandingHero
        title={landingContent.hero.title}
        description={landingContent.hero.description}
        image={landingContent.hero.image}
      />
      <ScrollReveal>
        <LandingFeatures
          features={landingContent.features.items.filter(({ title, description }) => Boolean(title && description))}
          title={landingContent.features.title}
          description={landingContent.features.description}
        />
      </ScrollReveal>
      <LandingProcess
        title={landingContent.process.title}
        subtitle={landingContent.process.subtitle}
        steps={landingContent.process.steps}
        stepImages={landingContent.process.stepImages}
        stepPercentages={[0, 33.33, 66.67, 100]}
        stepActivationOffsetPx={[0, 28, 48, 0]}
      />
      <ScrollReveal>
        <LandingCategories
          title={landingContent.categoriesIntro.title}
          description={landingContent.categoriesIntro.description}
          categories={landingSpecialtyCategories.categories}
          items={landingSpecialtyCategories.items.map((item) => ({
            ...item,
            linkLabel: t('categories.explore', { specialty: item.title }),
          }))}
          featuredIds={landingSpecialtyCategories.featuredIds}
          moreCategoriesLink={{ href: LISTING_COMPARISON_PATHS[locale] }}
          copy={{
            all: t('categories.all'),
            filters: t('categories.label'),
            viewAll: t('categories.viewAll'),
            moreByCategory: Object.fromEntries(
              landingSpecialtyCategories.categories.map(({ label, value }) => [
                value,
                t('categories.more', { category: label }),
              ]),
            ),
          }}
        />
      </ScrollReveal>
      {landingContent.cta.buttonText && (
        <ScrollReveal>
          <section className="py-20">
            <CallToAction
              variant="spotlight"
              richText={
                <Heading as="h2" align="left" className="text-4xl font-bold text-foreground md:text-5xl">
                  {landingContent.cta.title}
                </Heading>
              }
              links={[
                {
                  href: partnerContactHref,
                  label: landingContent.cta.buttonText,
                  appearance: 'default',
                  size: 'lg',
                  className: 'bg-secondary text-white hover:bg-secondary/90',
                },
              ]}
            />
          </section>
        </ScrollReveal>
      )}
      <ScrollReveal>
        <LandingTeam
          team={landingContent.team}
          title={landingContent.teamIntro.title}
          description={landingContent.teamIntro.description}
          ctaHref={landingContent.teamCta.buttonLink}
          ctaLabel={landingContent.teamCta.buttonText}
        />
      </ScrollReveal>
      <ScrollReveal>
        <LandingTestimonials
          testimonials={testimonials}
          copy={{
            carousel: t('testimonials.carousel'),
            slide: t('testimonials.slide'),
            positions: testimonials.map((_, index) => t('testimonials.position', testimonialPosition(index))),
            navigation: testimonials.map((_, index) => t('testimonials.goTo', testimonialPosition(index))),
          }}
          title={landingContent.testimonialsIntro.title}
          description={landingContent.testimonialsIntro.description}
        />
      </ScrollReveal>
      <ScrollReveal>
        <FAQSection
          title={landingContent.faq.title}
          description={landingContent.faq.description}
          items={landingContent.faq.items.filter(({ question, answer }) => Boolean(question && answer))}
        />
      </ScrollReveal>
      {normalizedPosts.length > 0 ? (
        <ScrollReveal>
          <BlogCardCollection
            title={landingContent.blogTeaser.title}
            intro={landingContent.blogTeaser.description}
            posts={normalizedPosts}
            moreLink={{ href: BLOG_ARCHIVE_PATHS[locale], label: t('blog.more') }}
          />
        </ScrollReveal>
      ) : null}
      <ScrollReveal>
        <ClinicRegistrationLandingSection
          className="border-t border-site-divider/60"
          copy={applicationCopy}
          locale={locale}
          title={landingContent.registrationIntro.title || applicationCopy.title}
          description={landingContent.registrationIntro.description}
          id="contact"
          treatmentCategories={clinicRegistrationTreatmentCategories}
        />
      </ScrollReveal>
    </article>
  )
}

export async function clinicPartnerMetadata(locale: ContentLocale): Promise<Metadata> {
  const route = await resolveEditorialLandingRoute('clinicPartners', CLINIC_PARTNER_PATHS, locale)
  return route.metadata(route.available ? (await getClinicPartnerLandingContent(locale)).metadata : undefined)
}
