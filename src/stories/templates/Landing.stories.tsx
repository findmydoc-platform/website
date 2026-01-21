import type { Meta, StoryObj } from '@storybook/react-vite'
import { Facebook, Instagram, Twitter } from 'lucide-react'

import {
  LandingCategories,
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
      <LandingFeatures features={clinicFeaturesData} />
      <LandingProcess
        title={landingProcessPlaceholderTitle}
        subtitle={landingProcessPlaceholderSubtitle}
        steps={clinicProcessData}
        stepImages={landingProcessPlaceholderStepImages}
      />
      <LandingCategories
        categories={clinicCategoriesData}
        items={clinicCategoryItems}
        featuredIds={clinicCategoryFeaturedIds}
      />
      <section className="py-20">
        <CallToAction
          variant="spotlight"
          richText={<h2 className="text-foreground text-4xl font-bold md:text-5xl">{clinicCTAData.title}</h2>}
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
      <LandingTeam team={clinicTeamData} />
      <LandingTestimonials testimonials={clinicTestimonialsData} />
      <LandingPricing plans={clinicPricingData} />
      <BlogCardCollection
        posts={clinicBlogData.map((p) => ({
          title: p.title,
          excerpt: p.excerpt,
          dateLabel: p.date,
          image: p.image ? { src: p.image, alt: p.title } : undefined,
        }))}
      />
      <LandingContact />
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
  render: () => <LandingFeatures features={clinicFeaturesData} />,
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

export const Categories: StoryObj<typeof LandingCategories> = {
  render: () => (
    <LandingCategories
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
        richText={<h2 className="text-foreground text-4xl font-bold md:text-5xl">{clinicCTAData.title}</h2>}
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
  render: () => <LandingTeam team={clinicTeamData} />,
}

export const Testimonials: StoryObj<typeof LandingTestimonials> = {
  render: () => <LandingTestimonials testimonials={clinicTestimonialsData} />,
}

export const Pricing: StoryObj<typeof LandingPricing> = {
  render: () => <LandingPricing plans={clinicPricingData} />,
}

export const Blog: StoryObj = {
  render: () => (
    <section className="py-20">
      <div className="container">
        <BlogCardCollection
          posts={clinicBlogData.map((p) => ({
            title: p.title,
            excerpt: p.excerpt,
            dateLabel: p.date,
            image: p.image ? { src: p.image, alt: p.title } : undefined,
          }))}
        />
      </div>
    </section>
  ),
}

export const Contact: StoryObj<typeof LandingContact> = {
  render: () => <LandingContact />,
}
