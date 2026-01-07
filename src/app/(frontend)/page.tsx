import React from 'react'
import { CheckCircle, TrendingUp, Eye } from 'lucide-react'

import { LandingHero } from '@/components/organisms/Heroes/LandingHero'
import { LandingTestimonials } from '@/components/organisms/Landing/LandingTestimonials'
import { LandingCategories } from '@/components/organisms/Landing/LandingCategories'
import { LandingFeatures } from '@/components/organisms/Landing/LandingFeatures'
import { LandingProcess } from '@/components/organisms/Landing/LandingProcess'
import { LandingContact } from '@/components/organisms/Landing/LandingContact'
import { BlogCardCollection } from '@/components/organisms/Blog/BlogCardCollection'
import {
  landingProcessPlaceholderStepImages,
  landingProcessPlaceholderSubtitle,
  landingProcessPlaceholderTitle,
} from '@/utilities/placeholders/landingProcess'

// TODO(homepage): Replace hardcoded copy and Storybook placeholder assets with Payload-driven content.
// This route is currently a visual scaffold for layout work.

import medicalHero from '@/stories/assets/medical-hero.jpg'
import ph80x80 from '@/stories/assets/placeholder-80-80.svg'
import ph570x544 from '@/stories/assets/placeholder-570-544.svg'
import ph570x256 from '@/stories/assets/placeholder-570-256.svg'
import ph270x256 from '@/stories/assets/placeholder-270-256.svg'
import ph1440x900 from '@/stories/assets/placeholder-1440-900.svg'
import ph270x292 from '@/stories/assets/placeholder-270-292.svg'

export default async function Home() {
  return (
    <main>
      <LandingHero
        title="Helping companies do good things"
        description="Quidam officiis similique sea ei, vel tollit indoctum efficiendi ei, at nihil tantas platonem eos. Mazim nemore singulis an ius, nullam ornatus nam ei."
        image={medicalHero}
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

      <LandingCategories
        categories={[
          { name: 'All', active: true },
          { name: 'Eyes' },
          { name: 'Body' },
          { name: 'Hair' },
          { name: 'Dental' },
          { name: 'Nose' },
        ]}
        images={[
          { src: ph570x544, alt: 'Category 1' },
          { src: ph570x256, alt: 'Category 2' },
          { src: ph270x256, alt: 'Category 3' },
          { src: ph270x256, alt: 'Category 4' },
        ]}
      />

      <LandingFeatures
        variant="green"
        backgroundImage={ph1440x900}
        features={[
          {
            title: 'Qualified Leads',
            description: 'Quidam officiis similique sea ei, vel tollit indoctum efficiendi nihil tantas platonem eos.',
            icon: CheckCircle,
          },
          {
            title: 'Reputation Boost',
            description: 'Deseruisse definitionem his et, an has veri integre abhorreant, nam alii epicurei et.',
            icon: TrendingUp,
          },
          {
            title: 'Visibility Increase',
            description: 'Ea eos essent ornatus percipit, mea an persecuti pertinacia, te suas semper per.',
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

      <BlogCardCollection
        variant="blue"
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

export { generateMetadata } from './(pages)/[...slug]/page'
