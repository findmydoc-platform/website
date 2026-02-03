import type { Meta, StoryObj } from '@storybook/react-vite'
import { Heading } from '@/components/atoms/Heading'
import { expect, within } from '@storybook/test'

const meta = {
  title: 'Atoms/Heading',
  component: Heading,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Semantic heading component with controlled typography hierarchy (h1-h6). Requires explicit alignment prop to ensure consistent text positioning.',
      },
    },
  },
  args: {
    as: 'h2',
    align: 'left',
    children: 'Heading',
  },
  argTypes: {
    as: {
      control: 'select',
      options: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
    },
    align: {
      control: 'radio',
      options: ['left', 'center', 'right'],
    },
    variant: {
      control: 'radio',
      options: ['default', 'muted', 'primary', 'white'],
    },
    size: {
      control: 'select',
      options: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'section'],
    },
  },
} satisfies Meta<typeof Heading>

export default meta
type Story = StoryObj<typeof meta>

export const AllSizesLeft: Story = {
  render: () => (
    <div className="space-y-4">
      <Heading as="h1" align="left">
        H1 heading - left aligned
      </Heading>
      <Heading as="h2" align="left">
        H2 heading - left aligned
      </Heading>
      <Heading as="h3" align="left">
        H3 heading - left aligned
      </Heading>
      <Heading as="h4" align="left">
        H4 heading - left aligned
      </Heading>
      <Heading as="h5" align="left">
        H5 heading - left aligned
      </Heading>
      <Heading as="h6" align="left">
        H6 heading - left aligned
      </Heading>
    </div>
  ),
}

export const AlignmentVariants: Story = {
  render: () => (
    <div className="space-y-8">
      <Heading as="h2" align="left">
        Left aligned heading
      </Heading>
      <Heading as="h2" align="center">
        Center aligned heading
      </Heading>
      <Heading as="h2" align="right">
        Right aligned heading
      </Heading>
    </div>
  ),
}

export const ColorVariants: Story = {
  render: () => (
    <div className="space-y-4">
      <Heading as="h2" align="left" variant="default">
        Default color
      </Heading>
      <Heading as="h2" align="left" variant="muted">
        Muted color
      </Heading>
      <Heading as="h2" align="left" variant="primary">
        Primary color
      </Heading>
      <div className="rounded-lg bg-primary p-8">
        <Heading as="h2" align="center" variant="white">
          White on primary
        </Heading>
      </div>
    </div>
  ),
}

export const SemanticVsVisual: Story = {
  render: () => (
    <div className="space-y-4">
      <Heading as="h3" size="h1" align="left">
        H3 tag styled as H1
      </Heading>
      <Heading as="h2" size="h3" align="left">
        H2 tag styled as H3
      </Heading>
    </div>
  ),
}

export const HeroExample: Story = {
  render: () => (
    <div className="rounded-lg bg-gradient-to-br from-primary to-primary-hover p-16">
      <Heading as="h1" align="center" variant="white">
        Welcome to findmydoc
      </Heading>
      <p className="mt-4 text-center text-white/80">Find trusted clinicians and book with confidence.</p>
    </div>
  ),
}

export const ArticleTitleExample: Story = {
  render: () => (
    <div className="max-w-4xl">
      <Heading as="h1" align="left" className="mb-4">
        The future of care: AI and digital diagnostics
      </Heading>
      <p className="text-xl text-muted-foreground">
        How clinical teams are adopting automation without losing the human touch.
      </p>
    </div>
  ),
}

export const SectionTitleExample: Story = {
  render: () => (
    <div>
      <Heading as="h2" align="left" className="mb-8">
        Related articles
      </Heading>
      <div className="grid grid-cols-3 gap-6">
        <div className="h-48 rounded-lg bg-muted" />
        <div className="h-48 rounded-lg bg-muted" />
        <div className="h-48 rounded-lg bg-muted" />
      </div>
    </div>
  ),
}

export const VisualRegression: Story = {
  parameters: {
    chromatic: { viewports: [320, 1024] },
    layout: 'padded',
  },
  render: () => (
    <div className="space-y-8">
      <Heading as="h1" align="left">
        H1 heading - left aligned
      </Heading>
      <Heading as="h2" align="left">
        H2 heading - left aligned
      </Heading>
      <Heading as="h3" align="left">
        H3 heading - left aligned
      </Heading>
      <Heading as="h4" align="left">
        H4 heading - left aligned
      </Heading>
      <Heading as="h5" align="left">
        H5 heading - left aligned
      </Heading>
      <Heading as="h6" align="left">
        H6 heading - left aligned
      </Heading>
      <div className="rounded-lg bg-primary p-8">
        <Heading as="h1" align="center" variant="white">
          White on primary
        </Heading>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Basic presence checks
    await expect(canvas.getByText('H1 heading - left aligned')).toBeInTheDocument()
    await expect(canvas.getByText('H5 heading - left aligned')).toBeInTheDocument()

    // Verify tracking and casing on the small heading that previously looked wrong
    const h5 = canvas.getByText('H5 heading - left aligned')
    await expect(h5).toHaveClass('tracking-tight')
    await expect(h5).toHaveClass('normal-case')
  },
}
