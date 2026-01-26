import type { Meta, StoryObj } from '@storybook/react-vite'
import { Container } from '@/components/molecules/Container'

const meta = {
  title: 'Molecules/Container',
  component: Container,
  parameters: {
    demoFrame: false,
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Container>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <div className="bg-muted py-8">
      <Container>
        <div className="rounded-md border bg-background p-6 text-sm text-muted-foreground">
          Content constrained to `--layout-content-max` with responsive padding.
        </div>
      </Container>
    </div>
  ),
}

export const BaseVariant: Story = {
  render: () => (
    <div className="py-8">
      <Container variant="base" className="rounded-md border bg-muted/40 p-6 text-sm">
        Base variant removes the max-width so the container spans the viewport while keeping horizontal padding.
      </Container>
    </div>
  ),
}
