import type { Meta, StoryObj } from '@storybook/nextjs-vite'

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
        icon: (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
          >
            <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
          </svg>
        ),
      },
      {
        href: '#',
        label: 'Twitter',
        icon: (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
          >
            <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />
          </svg>
        ),
      },
      {
        href: '#',
        label: 'Instagram',
        icon: (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
          >
            <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
            <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
          </svg>
        ),
      },
    ],
  },
}

export const WithSearchBar: Story = {
  args: {
    title: 'Helping companies do good things',
    description:
      'Quidam officiis similique sea ei, vel tollit indoctum efficiendi ei, at nihil tantas platonem eos. Mazim nemore singulis an ius, nullam ornatus nam ei.',
    image: ph1440x900.src,
    variant: 'homepage',
  },
}
