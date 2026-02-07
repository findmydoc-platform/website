import type { Meta, StoryObj } from '@storybook/react-vite'
import { Breadcrumb } from '@/components/molecules/Breadcrumb'
import { userEvent, within, expect } from '@storybook/test'
import { ChevronRight } from 'lucide-react'

const meta = {
  title: 'Molecules/Breadcrumb',
  component: Breadcrumb,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Breadcrumb>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    items: [
      { label: 'Home', href: '/' },
      { label: 'Blog', href: '/posts' },
      { label: 'Zahnmedizin', href: '/posts?category=zahnmedizin' },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Verify all breadcrumb items are rendered
    expect(canvas.getByText('Home')).toBeInTheDocument()
    expect(canvas.getByText('Blog')).toBeInTheDocument()
    expect(canvas.getByText('Zahnmedizin')).toBeInTheDocument()
  },
}

export const TwoLevels: Story = {
  args: {
    items: [
      { label: 'Home', href: '/' },
      { label: 'Über uns', href: '/about' },
    ],
  },
}

export const Deep: Story = {
  name: 'Deep Hierarchy (5 levels)',
  args: {
    items: [
      { label: 'Home', href: '/' },
      { label: 'Blog', href: '/posts' },
      { label: 'Medizin', href: '/posts?category=medizin' },
      { label: 'Zahnmedizin', href: '/posts?category=zahnmedizin' },
      { label: 'Implantologie', href: '/posts/implantologie' },
    ],
  },
}

export const LightVariant: Story = {
  name: 'Light Variant (on dark background)',
  args: {
    items: [
      { label: 'Home', href: '/' },
      { label: 'Blog', href: '/posts' },
      { label: 'Artikel', href: '/posts/artikel' },
    ],
    variant: 'light',
  },
  parameters: {
    backgrounds: { default: 'dark' },
  },
}

export const CustomSeparator: Story = {
  args: {
    items: [
      { label: 'Home', href: '/' },
      { label: 'Produkte', href: '/products' },
      { label: 'Kategorie', href: '/products/category' },
    ],
    separator: '/',
  },
}

export const CustomSeparatorIcon: Story = {
  name: 'Custom Separator (Icon)',
  args: {
    items: [
      { label: 'Home', href: '/' },
      { label: 'Docs', href: '/docs' },
      { label: 'Components', href: '/docs/components' },
    ],
    separator: <ChevronRight className="h-3.5 w-3.5" />,
  },
}

export const LongLabels: Story = {
  name: 'Long Labels (Responsive)',
  args: {
    items: [
      { label: 'Home', href: '/' },
      { label: 'Blog und Nachrichten', href: '/posts' },
      { label: 'Gesundheit und Medizin', href: '/posts?category=health' },
      { label: 'Orthopädische Rehabilitation nach Sportverletzungen', href: '/posts/ortho' },
    ],
  },
}

export const Interactive: Story = {
  name: 'Interactive (Hover Test)',
  args: {
    items: [
      { label: 'Home', href: '/' },
      { label: 'Blog', href: '/posts' },
      { label: 'Artikel', href: '/posts/artikel' },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Test hover on middle link
    const blogLink = canvas.getByText('Blog')
    await userEvent.hover(blogLink)

    // Test hover on last link (current page)
    const artikelLink = canvas.getByText('Artikel')
    await userEvent.hover(artikelLink)
  },
}

export const Empty: Story = {
  name: 'Empty (No Items)',
  args: {
    items: [],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Should not render anything
    expect(canvas.queryByRole('navigation')).not.toBeInTheDocument()
  },
}
