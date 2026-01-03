import type { Meta, StoryObj } from '@storybook/react-vite'
import { within, userEvent } from '@storybook/testing-library'
import { expect } from '@storybook/jest'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/atoms/popover'
import { Button } from '@/components/atoms/button'

const meta = {
  title: 'Atoms/Popover',
  component: Popover,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Popover>

export default meta
type Story = StoryObj<typeof meta>

const ClinicsPopover = () => (
  <Popover>
    <PopoverTrigger asChild>
      <Button variant="outline">Filter clinics</Button>
    </PopoverTrigger>
    <PopoverContent>
      <div className="space-y-2 text-sm">
        <p className="font-semibold">Popular filters</p>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          <li>Accredited facilities</li>
          <li>Multilingual staff</li>
          <li>Rehab programs</li>
        </ul>
      </div>
    </PopoverContent>
  </Popover>
)

const ClinicsPopoverRight = () => (
  <Popover>
    <PopoverTrigger asChild>
      <Button variant="outline">Filter clinics</Button>
    </PopoverTrigger>
    <PopoverContent side="right" align="start">
      <div className="space-y-2 text-sm">
        <p className="font-semibold">Popular filters</p>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          <li>Accredited facilities</li>
          <li>Multilingual staff</li>
          <li>Rehab programs</li>
        </ul>
      </div>
    </PopoverContent>
  </Popover>
)

const popoverPlay: Story['play'] = async ({ canvasElement }) => {
  const canvas = within(canvasElement)
  const trigger = canvas.getByRole('button', { name: 'Filter clinics' })

  await userEvent.click(trigger)

  const body = within(document.body)
  expect(body.getByText('Popular filters')).toBeInTheDocument()
}

export const Default: Story = {
  render: () => <ClinicsPopover />,
  play: popoverPlay,
}

export const SideRight: Story = {
  render: () => <ClinicsPopoverRight />,
  play: popoverPlay,
}
