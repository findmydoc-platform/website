import type { Meta, StoryObj } from '@storybook/react-vite'

import { TrustQualitySection } from '@/components/organisms/TrustQualitySection'
import { clinicTrust } from '@/stories/fixtures'

type LinkItem = {
  label: string
  href: string
}

const getLinkItems = (candidate: unknown): LinkItem[] => {
  if (!candidate || typeof candidate !== 'object') return []
  if (!('links' in candidate)) return []

  const { links } = candidate as { links?: unknown }
  if (!Array.isArray(links)) return []

  return links.filter((link): link is LinkItem => {
    if (!link || typeof link !== 'object') return false
    if (!('label' in link) || !('href' in link)) return false

    const { label, href } = link as { label?: unknown; href?: unknown }

    return typeof label === 'string' && typeof href === 'string'
  })
}

const meta = {
  title: 'Organisms/TrustQualitySection',
  component: TrustQualitySection,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  args: clinicTrust,
} satisfies Meta<typeof TrustQualitySection>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)

    args.stats.forEach(({ value, label }) => {
      expect(canvas.getByText(value)).toBeInTheDocument()
      expect(canvas.getByText(label)).toBeInTheDocument()
    })

    const linkItems = getLinkItems(args)

    if (linkItems.length > 0) {
      linkItems.forEach(({ label, href }) => {
        const link = canvas.getByRole('link', { name: label })
        expect(link).toHaveAttribute('href', href)
      })
    }
  },
}
