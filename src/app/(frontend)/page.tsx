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
import { landingProcessPlaceholderStepImages } from '@/utilities/placeholders/landingProcess'
import { normalizePost } from '@/utilities/blog/normalizePost'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

// TODO(homepage): Replace hardcoded copy and Storybook placeholder assets with Payload-driven content.
// This route is currently a visual scaffold for layout work.

import clinicHospitalExterior from '@/stories/assets/clinic-hospital-exterior.jpg'
import featureBackground from '@/stories/assets/feature-background.jpg'
import ph80x80 from '@/stories/assets/placeholder-80-80.svg'
// TODO: Temporary fixtures for layout; replace with Payload data.
import {
  clinicCategoriesData,
  clinicCategoryFeaturedIds,
  clinicCategoryItems,
  homepageFaqSection,
} from '@/stories/fixtures/listings'

export default async function Home() {
  // Fetch latest 3 blog posts for homepage
  const payload = await getPayload({ config: configPromise })
  const posts = await payload.find({
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
      populatedAuthors: true,
      publishedAt: true,
      heroImage: true,
      meta: {
        image: true,
        description: true,
      },
    },
    sort: '-publishedAt',
  })

  const normalizedPosts = posts.docs.map(normalizePost)

  return (
    <main>
      <LandingHero
        title="Clinic Comparison Turkey for Aesthetic Treatments"
        description="Compare selected aesthetic clinics in Turkey in a transparent and structured way. Our platform helps you understand treatment options, review clinic information and contact clinics directly with confidence."
        image={clinicHospitalExterior}
        variant="homepage"
      />

      <LandingTestimonials
        testimonials={[
          {
            quote: 'The comparison view made it easy to understand options and reach out to clinics directly.',
            author: 'Shirline Dungey',
            role: 'Apple',
            image: ph80x80,
          },
          {
            quote: 'Clear profiles and qualifications helped me feel confident about my decision.',
            author: 'Hector Mariano',
            role: 'Google',
            image: ph80x80,
          },
          {
            quote: 'Direct contact with clinics saved time and made planning much simpler.',
            author: 'Tiontay Carroll',
            role: 'Facebook',
            image: ph80x80,
          },
        ]}
        title="What others say"
        description="Real experiences from people who compared clinics and planned their treatments with confidence."
      />

      <LandingCategoriesClient
        title="Categories"
        description="Explore verified clinics by specialty and compare the best options for your needs."
        categories={clinicCategoriesData}
        items={clinicCategoryItems}
        featuredIds={clinicCategoryFeaturedIds}
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
        description="Quidam officiis similique sea ei, vel tollit indoctum efficiendi ei, at nihil tantas platonem eos."
      />

      <LandingProcess
        title="Our Process"
        subtitle="Quidam officiis similique sea ei, vel tollit indoctum efficiendi ei, at nihil tantas platonem eos."
        steps={[
          {
            step: 1,
            title: 'Reach Out',
            description:
              'Quidam officiis similique sea ei, vel tollit indoctum efficiendi ei, at nihil tantas platonem eos. Mazim nemore singulis an ius, nullam ornatus nam ei.',
          },
          {
            step: 2,
            title: 'Create Your Profile',
            description:
              'Vix habeo scaevola percipitur ne, qui noster abhorreant ne, mea in dicant eligendi evertitur. Ad falli aliquid menandri his. Usu vocent copiosae ut. No nihil munere eum.',
          },
          {
            step: 3,
            title: 'Verification & Quality Check',
            description:
              'Te aliquam noluisse his. Et vel epicuri detracto indoctum, et fierent pericula vim, veniam epicuri an eum. Ad mutat quaestio erroribus eam, ei mea modus volumus abhorreant.',
          },
          {
            step: 4,
            title: 'Connect with Patients',
            description:
              'Te aliquam noluisse his. Et vel epicuri detracto indoctum, et fierent pericula vim, veniam epicuri an eum. Ad mutat quaestio erroribus eam, ei mea modus volumus abhorreant.',
          },
        ]}
        stepImages={landingProcessPlaceholderStepImages}
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
        description="Ex sea causae dolores, nam et doming dicunt feugait scripta aperiri postulant sed affert audire, no alienum quaestio mea."
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
