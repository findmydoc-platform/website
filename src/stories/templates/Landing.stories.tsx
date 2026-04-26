import type { Meta, StoryObj } from '@storybook/react-vite'
import { SiInstagram, SiMeta, SiX } from 'react-icons/si'

import { Heading } from '@/components/atoms/Heading'
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
  clinicPricingModelItems,
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
import { withViewportStory } from '../utils/viewportMatrix'

const meta: Meta = {
  title: 'Domain/Landing/Templates/Landing',
  tags: ['autodocs', 'domain:landing', 'layer:template', 'status:stable', 'used-in:route:/'],
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
            label: 'Meta',
            icon: <SiMeta className="h-5 w-5" />,
          },
          {
            href: '#',
            label: 'X',
            icon: <SiX className="h-5 w-5" />,
          },
          {
            href: '#',
            label: 'Instagram',
            icon: <SiInstagram className="h-5 w-5" />,
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
      <LandingCategories
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
        modelItems={clinicPricingModelItems}
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
          label: 'Meta',
          icon: <SiMeta className="h-5 w-5" />,
        },
        {
          href: '#',
          label: 'X',
          icon: <SiX className="h-5 w-5" />,
        },
        {
          href: '#',
          label: 'Instagram',
          icon: <SiInstagram className="h-5 w-5" />,
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

export const Categories: StoryObj<typeof LandingCategories> = {
  render: () => (
    <LandingCategories
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
      modelItems={clinicPricingModelItems}
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

export const Team320: StoryObj<typeof LandingTeam> = withViewportStory(Team, 'public320', 'Team / 320')
export const Team375: StoryObj<typeof LandingTeam> = withViewportStory(Team, 'public375', 'Team / 375')
export const Team640: StoryObj<typeof LandingTeam> = withViewportStory(Team, 'public640', 'Team / 640')
export const Team768: StoryObj<typeof LandingTeam> = withViewportStory(Team, 'public768', 'Team / 768')
export const Team1024: StoryObj<typeof LandingTeam> = withViewportStory(Team, 'public1024', 'Team / 1024')
export const Team1280: StoryObj<typeof LandingTeam> = withViewportStory(Team, 'public1280', 'Team / 1280')

export const Testimonials320: StoryObj<typeof LandingTestimonials> = withViewportStory(
  Testimonials,
  'public320',
  'Testimonials / 320',
)
export const Testimonials375: StoryObj<typeof LandingTestimonials> = withViewportStory(
  Testimonials,
  'public375',
  'Testimonials / 375',
)
export const Testimonials640: StoryObj<typeof LandingTestimonials> = withViewportStory(
  Testimonials,
  'public640',
  'Testimonials / 640',
)
export const Testimonials768: StoryObj<typeof LandingTestimonials> = withViewportStory(
  Testimonials,
  'public768',
  'Testimonials / 768',
)
export const Testimonials1024: StoryObj<typeof LandingTestimonials> = withViewportStory(
  Testimonials,
  'public1024',
  'Testimonials / 1024',
)
export const Testimonials1280: StoryObj<typeof LandingTestimonials> = withViewportStory(
  Testimonials,
  'public1280',
  'Testimonials / 1280',
)

export const Pricing320: StoryObj<typeof LandingPricing> = withViewportStory(Pricing, 'public320', 'Pricing / 320')
export const Pricing375: StoryObj<typeof LandingPricing> = withViewportStory(Pricing, 'public375', 'Pricing / 375')
export const Pricing640: StoryObj<typeof LandingPricing> = withViewportStory(Pricing, 'public640', 'Pricing / 640')
export const Pricing768: StoryObj<typeof LandingPricing> = withViewportStory(Pricing, 'public768', 'Pricing / 768')
export const Pricing1024: StoryObj<typeof LandingPricing> = withViewportStory(Pricing, 'public1024', 'Pricing / 1024')
export const Pricing1280: StoryObj<typeof LandingPricing> = withViewportStory(Pricing, 'public1280', 'Pricing / 1280')

export const Contact320: StoryObj<typeof LandingContact> = withViewportStory(Contact, 'public320', 'Contact / 320')
export const Contact375: StoryObj<typeof LandingContact> = withViewportStory(Contact, 'public375', 'Contact / 375')
export const Contact640: StoryObj<typeof LandingContact> = withViewportStory(Contact, 'public640', 'Contact / 640')
export const Contact768: StoryObj<typeof LandingContact> = withViewportStory(Contact, 'public768', 'Contact / 768')
export const Contact1024: StoryObj<typeof LandingContact> = withViewportStory(Contact, 'public1024', 'Contact / 1024')
export const Contact1280: StoryObj<typeof LandingContact> = withViewportStory(Contact, 'public1280', 'Contact / 1280')
export const Contact320Short: StoryObj<typeof LandingContact> = withViewportStory(
  Contact,
  'public320Short',
  'Contact / 320 short',
)
export const Contact375Short: StoryObj<typeof LandingContact> = withViewportStory(
  Contact,
  'public375Short',
  'Contact / 375 short',
)
