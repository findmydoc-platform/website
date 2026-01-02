import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect } from '@storybook/jest'
import { within } from '@storybook/testing-library'
import { Facebook, Instagram, Twitter } from 'lucide-react'

import { LandingHero } from '@/components/organisms/Heroes/LandingHero'
import ph1440x900 from '@/stories/assets/placeholder-1440-900.png'

const meta = {
  title: 'Organisms/Heroes/LandingHero',
  component: LandingHero,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof LandingHero>

export default meta

type Story = StoryObj<typeof meta>

const assertHeroContent: Story['play'] = async ({ canvasElement, args }) => {
  const canvas = within(canvasElement)

  await expect(canvas.getByRole('heading', { name: args.title })).toBeInTheDocument()
  await expect(canvas.getByText(args.description)).toBeInTheDocument()

  if (args.variant === 'homepage') {
    await expect(canvas.getByRole('button', { name: /find my doctor!/i })).toBeInTheDocument()
  }

  if (args.socialLinks?.length) {
    args.socialLinks.forEach((link) => {
      expect(canvas.getByRole('link', { name: link.label })).toBeInTheDocument()
    })
  }
}

export const Default: Story = {
  args: {
    title: 'The best solution for your clinic',
    description: 'Join findmydoc and connect with patients worldwide.',
    image: ph1440x900.src,
    variant: 'clinic-landing',
    socialLinks: [
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
    ],
  },
  play: assertHeroContent,
}

export const WithSearchBar: Story = {
  args: {
    title: 'Helping companies do good things',
    description:
      'Quidam officiis similique sea ei, vel tollit indoctum efficiendi ei, at nihil tantas platonem eos. Mazim nemore singulis an ius, nullam ornatus nam ei.',
    image: ph1440x900.src,
    variant: 'homepage',
  },
  play: assertHeroContent,
}

export const NoImage: Story = {
  args: {
    title: 'A clear hero layout without imagery',
    description: 'Verify the layout remains readable and centered without an image.',
    variant: 'clinic-landing',
  },
  play: assertHeroContent,
}
