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
import {
  landingProcessPlaceholderStepImages,
  landingProcessPlaceholderSubtitle,
  landingProcessPlaceholderTitle,
} from '@/utilities/placeholders/landingProcess'

// TODO(homepage): Replace hardcoded copy and Storybook placeholder assets with Payload-driven content.
// This route is currently a visual scaffold for layout work.

import clinicHospitalExterior from '@/stories/assets/clinic-hospital-exterior.jpg'
import blogBackground from '@/stories/assets/blog-background.jpg'
import featureBackground from '@/stories/assets/feature-background.jpg'
import ph80x80 from '@/stories/assets/placeholder-80-80.svg'
import ph270x292 from '@/stories/assets/placeholder-270-292.svg'
// TODO: Temporary fixtures for layout; replace with Payload data.
import {
  clinicCategoriesData,
  clinicCategoryFeaturedIds,
  clinicCategoryItems,
  homepageFaqSection,
} from '@/stories/fixtures/listings'

export default async function Home() {
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
            quote:
              'Quidam officiis similique indoctum efficiendi platonem singulis ornatus nam maiestatis everti invenire intellegam, legendos consequuntur eu sit.',
            author: 'Shirline Dungey',
            role: 'Apple',
            image: ph80x80,
          },
          {
            quote:
              'Quidam officiis similique indoctum efficiendi platonem singulis ornatus nam maiestatis everti invenire intellegam, legendos consequuntur eu sit.',
            author: 'Hector Mariano',
            role: 'Google',
            image: ph80x80,
          },
          {
            quote:
              'Quidam officiis similique indoctum efficiendi platonem singulis ornatus nam maiestatis everti invenire intellegam, legendos consequuntur eu sit.',
            author: 'Tiontay Carroll',
            role: 'Facebook',
            image: ph80x80,
          },
        ]}
      />

      <LandingCategoriesClient
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
            subtitle: 'Easy & Robust',
            description:
              'Compare aesthetic clinics based on treatments, specializations and qualifications. All information is presented clearly to support informed decision making.',
            icon: CheckCircle,
          },
          {
            title: 'Reputation Boost',
            subtitle: 'Huge Collection',
            description:
              'Clinics create and manage their own profiles and provide relevant qualifications according to their aesthetic services. This ensures reliable and comparable information.',
            icon: TrendingUp,
          },
          {
            title: 'Visibility Increase',
            subtitle: 'Responsive & Retina',
            description: 'Patients contact clinics directly without intermediaries, obligations or hidden fees.',
            icon: Eye,
          },
        ]}
      />

      <LandingProcess
        title={landingProcessPlaceholderTitle}
        subtitle={landingProcessPlaceholderSubtitle}
        steps={[
          {
            step: 1,
            title: 'Reach Out',
            description:
              'Quidam officiis similique sea ei, vel tollit indoctum efficiendi ei, at nihil tantas platonem eos.',
          },
          {
            step: 2,
            title: 'Create Your Profile',
            description:
              'Vix habeo scaevola percipitur ne, qui noster abhorreant ne, mea in dicant eligendi evertitur.',
          },
          {
            step: 3,
            title: 'Verification & Quality Check',
            description:
              'Te aliquam noluisse his. Et vel epicuri detracto indoctum, et fierent pericula vim, veniam epicuri an eum.',
          },
          {
            step: 4,
            title: 'Connect with Patients',
            description:
              'Te aliquam noluisse his. Et vel epicuri detracto indoctum, et fierent pericula vim, veniam epicuri an eum.',
          },
        ]}
        stepImages={landingProcessPlaceholderStepImages}
      />

      <FAQSection
        title={homepageFaqSection.title}
        description={homepageFaqSection.description}
        items={homepageFaqSection.items}
        defaultOpenItemId={homepageFaqSection.defaultOpenItemId}
      />

      <BlogCardCollection
        variant="blue"
        intro="Stay informed with the latest healthcare insights, medical trends, and expert advice from our team of professionals."
        background={{
          media: {
            src: blogBackground,
            alt: '',
            imgClassName: 'opacity-20',
            priority: false,
          },
          overlay: {
            kind: 'none',
          },
        }}
        posts={[
          {
            title: 'Top 5 Medical Trends in 2024',
            dateLabel: '15 Jan 2024',
            excerpt: 'Discover the latest innovations shaping the future of healthcare and patient support systems.',
            image: { src: ph270x292, alt: 'Medical Trends' },
          },
          {
            title: 'How to Choose the Right Specialist',
            dateLabel: '02 Feb 2024',
            excerpt:
              'A comprehensive guide on what to look for when selecting a medical professional for your specific needs.',
            image: { src: ph270x292, alt: 'Choosing a Specialist' },
          },
          {
            title: 'The Importance of Regular Checkups',
            dateLabel: '10 Mar 2024',
            excerpt:
              'Why preventative care is crucial for long-term health and how often you should really be seeing your doctor.',
            image: { src: ph270x292, alt: 'Regular Checkups' },
          },
        ]}
      />

      <LandingContact />
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
