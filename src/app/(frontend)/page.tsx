import React from 'react'
import type { Metadata } from 'next'

import { LandingHero } from '@/components/organisms/Heroes/LandingHero'
import { LandingTestimonials } from '@/components/organisms/Landing/LandingTestimonials'
import { LandingCategories, LandingProcessRing } from '@/components/organisms/Landing'
import { LandingFeatures } from '@/components/organisms/Landing/LandingFeatures'
import { PublicContactSection } from '@/components/organisms/Contact'
import { BlogCardCollection } from '@/components/organisms/Blog/BlogCardCollection'
import { FAQSection } from '@/components/organisms/FAQ'
import { ScrollReveal } from '@/components/molecules/ScrollReveal'
import { ClinicRegistrationLandingSection } from './_components/ClinicRegistrationLandingSection'
import { normalizePost } from '@/utilities/blog/normalizePost'
import { getLandingMedicalSpecialtyCategories } from '@/utilities/landing/medicalSpecialtyCategories'
import { getHomeLandingContent } from '@/utilities/landing/landingPageContent'
import { TemporaryLandingPage } from '@/components/templates/TemporaryLandingPage'
import {
  buildTemporaryLandingLanguageOptions,
  getTemporaryLandingPageContent,
  isTemporaryLandingModeRequest,
  resolveTemporaryLandingLocale,
} from '@/features/temporaryLandingMode'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { headers } from 'next/headers'
import { findLatestPosts } from '@/utilities/content/serverData'
import { createSiteMetadata } from '@/utilities/generateMeta'

type HomePageSearchParams = Record<string, string | string[] | undefined>

export default async function Home({
  searchParams: searchParamsPromise,
}: {
  searchParams?: Promise<HomePageSearchParams>
} = {}) {
  const requestHeaders = await headers()
  if (isTemporaryLandingModeRequest(requestHeaders)) {
    const searchParams = (await searchParamsPromise) ?? {}
    const locale = resolveTemporaryLandingLocale(searchParams)
    const languageOptions = buildTemporaryLandingLanguageOptions(searchParams)

    return <TemporaryLandingPage locale={locale} languageOptions={languageOptions} />
  }

  const payload = await getPayload({ config: configPromise })
  const [landingContent, posts, landingSpecialtyCategories, cityResult] = await Promise.all([
    getHomeLandingContent(),
    findLatestPosts(payload, 3),
    getLandingMedicalSpecialtyCategories(payload),
    payload.find({
      collection: 'cities',
      depth: 0,
      limit: 250,
      overrideAccess: false,
      pagination: false,
      sort: 'name',
      select: {
        id: true,
        name: true,
      },
    }),
  ])

  const normalizedPosts = posts.map((post) => normalizePost(post))
  const heroServiceOptions = landingSpecialtyCategories.items.map((item) => ({
    label: item.title,
    value: item.id,
  }))
  const heroLocationOptions = (cityResult.docs as Array<{ id: number; name?: string | null }>).flatMap((city) => {
    const label = typeof city.name === 'string' ? city.name.trim() : ''
    if (label.length === 0) {
      return []
    }

    return [
      {
        label,
        value: String(city.id),
      },
    ]
  })

  return (
    <main>
      <LandingHero
        title={landingContent.hero.title}
        description={landingContent.hero.description}
        image={landingContent.hero.image}
        variant="homepage"
        searchOptions={{
          service: heroServiceOptions,
          location: heroLocationOptions,
        }}
      />

      <ScrollReveal>
        <LandingTestimonials
          testimonials={landingContent.testimonials}
          title={landingContent.testimonialsIntro.title}
          description={landingContent.testimonialsIntro.description}
          className="md:pt-28"
        />
      </ScrollReveal>

      <ScrollReveal>
        <LandingCategories
          title={landingContent.categoriesIntro.title}
          description={landingContent.categoriesIntro.description}
          categories={landingSpecialtyCategories.categories}
          items={landingSpecialtyCategories.items}
          featuredIds={landingSpecialtyCategories.featuredIds}
        />
      </ScrollReveal>

      <ScrollReveal>
        <LandingFeatures
          variant="green"
          backgroundImage={landingContent.features.backgroundImage}
          backgroundParallax={{ rangePx: 64 }}
          features={landingContent.features.items}
          title={landingContent.features.title}
          description={landingContent.features.description}
        />
      </ScrollReveal>

      <ScrollReveal>
        <LandingProcessRing
          title={landingContent.process.title}
          preset="balanced"
          palette="brand"
          size={620}
          startAngle={25}
          endAngle={335}
          orbitMargin={0}
          logoScale={1.7}
          backgroundColor="#ffffff"
          accentColor="#42E2B7"
          primaryColor="#0076FF"
          vibrancy={1}
          colorBalance={0.4}
          organicness={0}
          density={0.58}
          speed={0.15}
          wobble={0.62}
          glow={1}
        />
      </ScrollReveal>

      <ScrollReveal>
        <FAQSection
          title={landingContent.faq.title}
          description={landingContent.faq.description}
          items={landingContent.faq.items}
        />
      </ScrollReveal>

      {normalizedPosts.length > 0 ? (
        <ScrollReveal>
          <BlogCardCollection
            title={landingContent.blogTeaser.title}
            intro={landingContent.blogTeaser.description}
            posts={normalizedPosts}
          />
        </ScrollReveal>
      ) : null}

      <ScrollReveal>
        <PublicContactSection title={landingContent.contact.title} description={landingContent.contact.description} />
      </ScrollReveal>

      <ScrollReveal>
        <ClinicRegistrationLandingSection className="border-t border-site-divider/60" />
      </ScrollReveal>
    </main>
  )
}

export async function generateMetadata({
  searchParams: searchParamsPromise,
}: {
  searchParams?: Promise<HomePageSearchParams>
} = {}): Promise<Metadata> {
  const requestHeaders = await headers()

  if (isTemporaryLandingModeRequest(requestHeaders)) {
    const searchParams = (await searchParamsPromise) ?? {}
    const locale = resolveTemporaryLandingLocale(searchParams)
    const content = getTemporaryLandingPageContent(locale)

    return createSiteMetadata({
      title: content.searchSnapshot.metaTitle,
      description: content.searchSnapshot.metaDescription,
      path: '/',
    })
  }

  const metadata = (await getHomeLandingContent()).metadata

  return createSiteMetadata({
    title: typeof metadata.title === 'string' ? metadata.title : null,
    description: metadata.description,
    path: '/',
  })
}
