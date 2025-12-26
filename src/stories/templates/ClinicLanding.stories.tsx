import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import {
  ClinicCategories,
  ClinicContact,
  ClinicFeatures,
  ClinicPricing,
  ClinicProcess,
  ClinicTeam,
  ClinicTestimonials,
} from '@/components/organisms/ClinicLanding'
import { BlogCardCollection } from '@/components/organisms/Blog/BlogCardCollection'
import { clinicBlogData } from '@/stories/fixtures/clinics'
import { ClinicLandingHero } from '@/components/organisms/Heroes/ClinicLanding'
import { CallToAction } from '@/components/organisms/CallToAction'
import { clinicHeroData, clinicCTAData } from '@/stories/fixtures/clinics'

const meta: Meta = {
  title: 'Templates/ClinicLanding',
  parameters: {
    layout: 'fullscreen',
  },
}

export default meta

export const FullPage: StoryObj = {
  render: () => (
    <div className="flex min-h-screen flex-col">
      <ClinicLandingHero
        title={clinicHeroData.title}
        description={clinicHeroData.description}
        image={clinicHeroData.image}
      />
      <ClinicFeatures />
      <ClinicProcess />
      <ClinicCategories />
      <section className="py-20">
        <CallToAction
          variant="spotlight"
          richText={<h2 className="text-4xl font-bold text-foreground md:text-5xl">{clinicCTAData.title}</h2>}
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
      <ClinicTeam />
      <ClinicTestimonials />
      <ClinicPricing />
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
      <ClinicContact />
    </div>
  ),
}

export const Hero: StoryObj<typeof ClinicLandingHero> = {
  render: () => (
    <ClinicLandingHero
      title={clinicHeroData.title}
      description={clinicHeroData.description}
      image={clinicHeroData.image}
    />
  ),
}

export const Features: StoryObj<typeof ClinicFeatures> = {
  render: () => <ClinicFeatures />,
}

export const Process: StoryObj<typeof ClinicProcess> = {
  render: () => <ClinicProcess />,
}

export const Categories: StoryObj<typeof ClinicCategories> = {
  render: () => <ClinicCategories />,
}

export const CTA: StoryObj<typeof CallToAction> = {
  render: () => (
    <section className="py-20">
      <CallToAction
        variant="spotlight"
        richText={<h2 className="text-4xl font-bold text-foreground md:text-5xl">{clinicCTAData.title}</h2>}
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

export const Team: StoryObj<typeof ClinicTeam> = {
  render: () => <ClinicTeam />,
}

export const Testimonials: StoryObj<typeof ClinicTestimonials> = {
  render: () => <ClinicTestimonials />,
}

export const Pricing: StoryObj<typeof ClinicPricing> = {
  render: () => <ClinicPricing />,
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

export const Contact: StoryObj<typeof ClinicContact> = {
  render: () => <ClinicContact />,
}
