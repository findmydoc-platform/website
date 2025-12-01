import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/atoms/card'
import { Button } from '@/components/atoms/button'

const meta = {
  title: 'Atoms/Card',
  component: Card,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
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
    <CardFooter className="justify-end gap-2">
      <Button variant="ghost">Maybe later</Button>
      <Button>Upgrade</Button>
    </CardFooter>
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
