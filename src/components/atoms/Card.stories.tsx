import type { Meta, StoryObj } from '@storybook/react-vite'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/atoms/card'

const meta = {
  title: 'Shared/Atoms/Card',
  component: Card,
  tags: ['autodocs', 'domain:shared', 'layer:atom', 'status:stable', 'used-in:shared'],
} satisfies Meta<typeof Card>

export default meta
type Story = StoryObj<typeof meta>

const SampleCard = () => (
  <Card>
    <CardHeader>
      <CardTitle>Plan Upgrade</CardTitle>
      <CardDescription>Get more visibility for your clinic on findmydoc.</CardDescription>
    </CardHeader>
    <CardContent>
      <p className="text-sm text-muted-foreground">
        Premium listings include featured placement, richer doctor profiles, and priority support.
      </p>
    </CardContent>
  </Card>
)

export const Basic: Story = {
  render: () => <SampleCard />,
}

export const Elevated: Story = {
  render: () => <SampleCard />,
  parameters: {
    backgrounds: {
      default: 'muted',
      values: [{ name: 'muted', value: 'var(--color-muted)' }],
    },
  },
}
