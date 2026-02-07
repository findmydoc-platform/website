import type { Meta, StoryObj } from '@storybook/react-vite'
import { Facebook, Instagram, Twitter } from 'lucide-react'

import { Heading } from '@/components/atoms/Heading'
import {
  LandingCategoriesClient,
  LandingContact,
  LandingFeatures,
  LandingPricing,
  LandingProcess,
  LandingTeam,
  LandingTestimonials,
} from '@/components/organisms/Landing'
import { BlogCardCollection } from '@/components/organisms/Blog/BlogCardCollection'
import {
  clinicBlogData,
  clinicCategoriesData,
  clinicCategoryFeaturedIds,
  clinicCategoryItems,
  clinicCTAData,
  clinicFeaturesData,
  clinicHeroData,
  clinicPricingData,
  clinicProcessData,
  clinicTeamData,
  clinicTestimonialsData,
} from '@/stories/fixtures/listings'
import { LandingHero } from '@/components/organisms/Heroes/LandingHero'
import { CallToAction } from '@/components/organisms/CallToAction'
import {
  landingProcessPlaceholderStepImages,
  landingProcessPlaceholderSubtitle,
  landingProcessPlaceholderTitle,
} from '@/utilities/placeholders/landingProcess'

const meta: Meta = {
  title: 'Templates/Landing',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
}

export default meta

export const FullPage: StoryObj = {
  render: () => (
    <div className="flex min-h-screen flex-col">
      <LandingHero
        title={clinicHeroData.title}
        description={clinicHeroData.description}
        image={clinicHeroData.image}
        socialLinks={[
          {
            href: '#',
            label: 'Facebook',
            icon: <Facebook className="h-5 w-5" />,
          },
          {
            href: '#',
            label: 'Twitter',
            icon: <Twitter className="h-5 w-5" />,
          },
          {
            href: '#',
            label: 'Instagram',
            icon: <Instagram className="h-5 w-5" />,
          },
        ]}
      />
      <LandingFeatures
        features={clinicFeaturesData}
        title="Why partner with us"
        description="Increase your clinic's visibility, attract qualified patients, and grow internationally."
      />
      <LandingProcess
        title={landingProcessPlaceholderTitle}
        subtitle={landingProcessPlaceholderSubtitle}
        steps={clinicProcessData}
        stepImages={landingProcessPlaceholderStepImages}
      />
      <LandingCategoriesClient
        title="Top Treatment Categories"
        description="Showcase your clinic under the categories patients search most."
        categories={clinicCategoriesData}
        items={clinicCategoryItems}
        featuredIds={clinicCategoryFeaturedIds}
      />
      <section className="py-20">
        <CallToAction
          variant="spotlight"
          richText={
            <Heading as="h2" align="left" className="text-4xl font-bold text-foreground md:text-5xl">
              {clinicCTAData.title}
            </Heading>
          }
          links={[
            {
              href: clinicCTAData.buttonLink,
              label: clinicCTAData.buttonText,
              appearance: 'default',
              size: 'lg',
              className: 'bg-secondary text-white hover:bg-secondary/90',
            },
          ]}
        />
      </section>
      <LandingTeam
        team={clinicTeamData}
        title="Our Team"
        description="We are a multidisciplinary team with backgrounds in healthcare, international patient management, medical marketing, and platform technology."
      />
      <LandingTestimonials
        testimonials={clinicTestimonialsData}
        title="Testimonials"
        description="What our partners say about working with us."
      />
      <LandingPricing
        plans={clinicPricingData}
        title="Pricing"
        description="Flexible pricing and partnership options to suit clinics of any size."
      />
      <BlogCardCollection
        posts={clinicBlogData.map((p) => ({
          title: p.title,
          href: `/posts/${p.title.toLowerCase().replace(/\s+/g, '-')}`,
          excerpt: p.excerpt,
          dateLabel: p.date,
          readTime: '5 Min. Lesezeit',
          image: p.image ? { src: p.image, alt: p.title } : undefined,
        }))}
      />
      <LandingContact
        title="Contact"
        description="Reach out to discuss partnerships, integrations, or international patient programs."
      />
    </div>
  ),
}

export const Hero: StoryObj<typeof LandingHero> = {
  render: () => (
    <LandingHero
      title={clinicHeroData.title}
      description={clinicHeroData.description}
      image={clinicHeroData.image}
      socialLinks={[
        {
          href: '#',
          label: 'Facebook',
          icon: <Facebook className="h-5 w-5" />,
        },
        {
          href: '#',
          label: 'Twitter',
          icon: <Twitter className="h-5 w-5" />,
        },
        {
          href: '#',
          label: 'Instagram',
          icon: <Instagram className="h-5 w-5" />,
        },
      ]}
    />
  ),
}

export const Features: StoryObj<typeof LandingFeatures> = {
  render: () => (
    <LandingFeatures
      features={clinicFeaturesData}
      title="Why partner with us"
      description="Increase your clinic's visibility, attract qualified patients, and grow internationally."
    />
  ),
}

export const Process: StoryObj<typeof LandingProcess> = {
  render: () => (
    <LandingProcess
      title={landingProcessPlaceholderTitle}
      subtitle={landingProcessPlaceholderSubtitle}
      steps={clinicProcessData}
      stepImages={landingProcessPlaceholderStepImages}
    />
  ),
}

export const Categories: StoryObj<typeof LandingCategoriesClient> = {
  render: () => (
    <LandingCategoriesClient
      title="Top Treatment Categories"
      description="Showcase your clinic under the categories patients search most."
      categories={clinicCategoriesData}
      items={clinicCategoryItems}
      featuredIds={clinicCategoryFeaturedIds}
    />
  ),
}

export const CTA: StoryObj<typeof CallToAction> = {
  render: () => (
    <section className="py-20">
      <CallToAction
        variant="spotlight"
        richText={
          <Heading as="h2" align="left" className="text-4xl font-bold text-foreground md:text-5xl">
            {clinicCTAData.title}
          </Heading>
        }
        links={[
          {
            href: clinicCTAData.buttonLink,
            label: clinicCTAData.buttonText,
            appearance: 'default',
            size: 'lg',
            className: 'bg-secondary text-white hover:bg-secondary/90',
          },
        ]}
      />
    </section>
  ),
}

export const Team: StoryObj<typeof LandingTeam> = {
  render: () => (
    <LandingTeam
      team={clinicTeamData}
      title="Our Team"
      description="We are a multidisciplinary team with backgrounds in healthcare, international patient management, medical marketing, and platform technology."
    />
  ),
}

export const Testimonials: StoryObj<typeof LandingTestimonials> = {
  render: () => (
    <LandingTestimonials
      testimonials={clinicTestimonialsData}
      title="Testimonials"
      description="What our partners say about working with us."
    />
  ),
}

export const Pricing: StoryObj<typeof LandingPricing> = {
  render: () => (
    <LandingPricing
      plans={clinicPricingData}
      title="Pricing"
      description="Flexible pricing and partnership options to suit clinics of any size."
    />
  ),
}

export const Blog: StoryObj = {
  render: () => (
    <section className="py-20">
      <div className="container">
        <BlogCardCollection
          posts={clinicBlogData.map((p) => ({
            title: p.title,
            href: `/posts/${p.title.toLowerCase().replace(/\s+/g, '-')}`,
            excerpt: p.excerpt,
            dateLabel: p.date,
            readTime: '5 Min. Lesezeit',
            image: p.image ? { src: p.image, alt: p.title } : undefined,
          }))}
        />
      </div>
    </section>
  ),
}

export const Contact: StoryObj<typeof LandingContact> = {
  render: () => (
    <LandingContact
      title="Contact"
      description="Reach out to discuss partnerships, integrations, or international patient programs."
    />
  ),
}
