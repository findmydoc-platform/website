import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import {
  ClinicBlog,
  ClinicCategories,
  ClinicContact,
  ClinicCTA,
  ClinicFeatures,
  ClinicHero,
  ClinicPricing,
  ClinicProcess,
  ClinicTeam,
  ClinicTestimonials,
} from '@/components/organisms/ClinicLanding'

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
      <ClinicHero />
      <ClinicFeatures />
      <ClinicProcess />
      <ClinicCategories />
      <ClinicCTA />
      <ClinicTeam />
      <ClinicTestimonials />
      <ClinicPricing />
      <ClinicBlog />
      <ClinicContact />
    </div>
  ),
}

export const Hero: StoryObj<typeof ClinicHero> = {
  render: () => <ClinicHero />,
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

export const CTA: StoryObj<typeof ClinicCTA> = {
  render: () => <ClinicCTA />,
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

export const Blog: StoryObj<typeof ClinicBlog> = {
  render: () => <ClinicBlog />,
}

export const Contact: StoryObj<typeof ClinicContact> = {
  render: () => <ClinicContact />,
}
