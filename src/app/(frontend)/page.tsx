import React from 'react'
import type { Metadata } from 'next'
import { CheckCircle, TrendingUp, Eye } from 'lucide-react'

import { LandingHero } from '@/components/organisms/Heroes/LandingHero'
import { LandingTestimonials } from '@/components/organisms/Landing/LandingTestimonials'
import { LandingCategoriesClient } from '@/components/organisms/Landing'
import { LandingFeatures } from '@/components/organisms/Landing/LandingFeatures'
import { LandingProcess } from '@/components/organisms/Landing/LandingProcess'
import { LandingContact } from '@/components/organisms/Landing/LandingContact'
import { BlogCardCollection } from '@/components/organisms/Blog/BlogCardCollection'
import { FAQSection } from '@/components/organisms/FAQ'
import { landingProcessHomepageStepImages } from '@/utilities/placeholders/landingProcess'
import { normalizePost } from '@/utilities/blog/normalizePost'
import { getLandingMedicalSpecialtyCategories } from '@/utilities/landing/medicalSpecialtyCategories'
import { TemporaryLandingPage } from '@/components/templates/TemporaryLandingPage'
import { isTemporaryLandingModeRequest } from '@/features/temporaryLandingMode'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { headers } from 'next/headers'

// TODO(homepage): Replace hardcoded copy and Storybook placeholder assets with Payload-driven content.
// This route is currently a visual scaffold for layout work.

import featureBackground from '@/stories/assets/feature-background.jpg'
import ph80x80 from '@/stories/assets/placeholder-80-80.svg'
// TODO: Temporary fixtures for layout; replace with Payload data.
import { homepageFaqSection } from '@/stories/fixtures/listings'

export default async function Home() {
  const requestHeaders = await headers()
  if (isTemporaryLandingModeRequest(requestHeaders)) {
    return <TemporaryLandingPage />
  }

  const payload = await getPayload({ config: configPromise })
  const [posts, landingSpecialtyCategories] = await Promise.all([
    payload.find({
      collection: 'posts',
      depth: 1,
      limit: 3,
      overrideAccess: false,
      select: {
        title: true,
        slug: true,
        excerpt: true,
        content: true,
        categories: true,
        authors: true,
        populatedAuthors: true,
        publishedAt: true,
        heroImage: true,
        meta: {
          image: true,
          description: true,
        },
      },
      sort: '-publishedAt',
    }),
    getLandingMedicalSpecialtyCategories(payload),
  ])

  const normalizedPosts = posts.docs.map(normalizePost)

  return (
    <main>
      <LandingHero
        title="Clinic Comparison Turkey for Aesthetic Treatments"
        description="Compare selected aesthetic clinics in Turkey in a transparent and structured way. Our platform helps you understand treatment options, review clinic information and contact clinics directly with confidence."
        image="/images/landing/home-hero-telemedicine.jpg"
        variant="homepage"
      />

      <LandingTestimonials
        testimonials={[
          {
            quote:
              'The platform makes treatment research easier by structuring clinic details around what patients need before deciding.',
            author: 'Maya Bennett',
            role: 'Digital Health Research Advisor',
            image: ph80x80,
          },
          {
            quote:
              'I appreciate how trust signals are integrated into the comparison flow instead of being hidden in long profile text.',
            author: 'Daniel Ortega',
            role: 'Healthcare UX Reviewer',
            image: ph80x80,
          },
          {
            quote:
              'For users planning treatment abroad, the direct contact step is clear, practical, and aligned with real decision journeys.',
            author: 'Sophie Klein',
            role: 'International Care Pathway Consultant',
            image: ph80x80,
          },
        ]}
        title="Expert feedback"
        description="Perspectives from healthcare and product experts who reviewed the patient decision flow."
      />

      <LandingCategoriesClient
        title="Categories"
        description="Explore verified clinics by specialty and compare the best options for your needs."
        categories={landingSpecialtyCategories.categories}
        items={landingSpecialtyCategories.items}
        featuredIds={landingSpecialtyCategories.featuredIds}
      />

      <LandingFeatures
        variant="green"
        backgroundImage={featureBackground}
        backgroundParallax={{ rangePx: 64 }}
        features={[
          {
            title: 'Qualified Leads',
            subtitle: '',
            description:
              'Compare aesthetic clinics based on treatments, specializations and qualifications. All information is presented clearly to support informed decision making.',
            icon: CheckCircle,
          },
          {
            title: 'Reputation Boost',
            subtitle: '',
            description:
              'Clinics create and manage their own profiles and provide relevant qualifications according to their aesthetic services. This ensures reliable and comparable information.',
            icon: TrendingUp,
          },
          {
            title: 'Visibility Increase',
            subtitle: '',
            description: 'Patients contact clinics directly without intermediaries, obligations or hidden fees.',
            icon: Eye,
          },
        ]}
        title="Benefits for Patients"
        description="Compare verified clinics for dental care, hair transplants, and aesthetic treatments with clear trust signals and transparent profile data."
      />

      <LandingProcess
        title="Our Process"
        subtitle="A clear four-step path to compare clinics, review treatment options, and contact your preferred clinic directly."
        steps={[
          {
            step: 1,
            title: 'Explore Verified Clinics',
            description:
              'Browse verified clinics by specialty, treatment focus, and location to quickly find options that match your needs.',
          },
          {
            step: 2,
            title: 'Compare Treatments & Trust Signals',
            description:
              'Review treatment options, qualifications, ratings, and key quality indicators side by side in one clear view.',
          },
          {
            step: 3,
            title: 'Choose with Confidence',
            description:
              'Shortlist your preferred clinics, check before-and-after cases, and make your decision at your own pace.',
          },
          {
            step: 4,
            title: 'Contact the Clinic Directly',
            description:
              'Send your request directly to the clinic and discuss consultation details, next steps, and availability.',
          },
        ]}
        stepImages={landingProcessHomepageStepImages}
        stepPercentages={[0, 33.33, 66.67, 100]}
        stepActivationOffsetPx={[0, 28, 48, 0]}
      />

      <FAQSection
        title={homepageFaqSection.title}
        description="This section answers the most common questions clinics and medical networks have about gaining international patients through our comparison platform. It provides clarity on regions, qualifications, visibility and how clinics connect with international patients across the DACH region and Europe."
        items={homepageFaqSection.items}
        defaultOpenItemId={homepageFaqSection.defaultOpenItemId}
      />

      {normalizedPosts.length > 0 && (
        <BlogCardCollection
          title="From our blog"
          intro="Explore practical insights, expert perspectives, and the latest topics across health and medicine."
          posts={normalizedPosts}
        />
      )}

      <LandingContact
        title="Contact"
        description="Planning treatment abroad? Share your goals and we will help you find relevant clinics and next steps with confidence."
      />
    </main>
  )
}

export const metadata: Metadata = {
  title: 'Gain International Patients | Global Clinic Visibility Platform',
  description:
    'Gain international patients through a trusted comparison platform. Increase clinic reach, visibility, and qualified global patient inquiries.',
}

// TODO: When Payload CMS is connected, switch to dynamic metadata by
// exporting `generateMetadata` here and fetching the homepage metadata from Payload.
