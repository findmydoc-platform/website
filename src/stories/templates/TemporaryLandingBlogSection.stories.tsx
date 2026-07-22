import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'

import { TemporaryLandingBlogSection } from '@/components/templates/TemporaryLandingPage/TemporaryLandingBlogSection'
import type { BlogCardBaseProps } from '@/utilities/blog/normalizePost'

const posts: BlogCardBaseProps[] = [
  {
    title: 'How to compare clinic quality signals',
    excerpt: 'A practical guide to structured comparisons before contacting a clinic.',
    href: '/posts/quality-signals',
    dateLabel: 'July 10, 2026',
    category: 'Clinic comparison',
  },
  {
    title: 'Questions to ask before treatment abroad',
    excerpt: 'Prepare the first conversation and make expectations easier to compare.',
    href: '/posts/questions-before-treatment',
    dateLabel: 'July 8, 2026',
    category: 'Patient guidance',
  },
  {
    title: 'Understanding treatment estimates',
    excerpt: 'Put estimates, services, and follow-up details into context.',
    href: '/posts/treatment-estimates',
    dateLabel: 'July 5, 2026',
    category: 'Treatments',
  },
]

const meta = {
  title: 'Internal/Landing/Templates/TemporaryLandingBlogSection',
  component: TemporaryLandingBlogSection,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Reuses the public BlogCard.Simple pattern for the temporary holding page. The section stays hidden when no published posts are available.',
      },
    },
  },
  tags: ['autodocs', 'domain:landing', 'layer:template', 'status:experimental', 'used-in:shared'],
  args: {
    ctaHref: '/posts',
    ctaLabel: 'View all articles',
    description: 'Practical guidance and clear context for comparing clinics, treatments, and quality signals.',
    posts,
    title: 'Latest insights',
  },
} satisfies Meta<typeof TemporaryLandingBlogSection>

export default meta

type Story = StoryObj<typeof meta>

export const ThreePosts: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByRole('heading', { level: 2, name: 'Latest insights' })).toBeInTheDocument()
    await expect(canvas.getAllByRole('link')).toHaveLength(4)
  },
}

export const OnePost: Story = {
  args: { posts: posts.slice(0, 1) },
}

export const TwoPosts: Story = {
  args: { posts: posts.slice(0, 2) },
}

export const MissingImage: Story = {
  args: {
    posts: [
      {
        ...posts[0]!,
        image: undefined,
      },
    ],
  },
}

export const Empty: Story = {
  args: { posts: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.queryByRole('region')).not.toBeInTheDocument()
    await expect(canvas.queryByRole('link')).not.toBeInTheDocument()
  },
}
