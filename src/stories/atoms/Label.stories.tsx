import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Label } from '@/components/atoms/label'
import { Input } from '@/components/atoms/input'

const meta = {
  title: 'Atoms/Label',
  component: Label,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Label>

export default meta
type Story = StoryObj<typeof meta>

export const WithInput: Story = {
  render: () => (
    <div className="flex flex-col gap-2 w-80">
      <Label htmlFor="clinic-name">Clinic Name</Label>
      <Input id="clinic-name" placeholder="findmydoc Medical Center" />
    </div>
  ),
}

export const DisabledPeer: Story = {
  render: () => (
    <div className="flex flex-col gap-2 w-80">
      <Label htmlFor="disabled-input">Disabled field</Label>
      <Input id="disabled-input" placeholder="Cannot edit" disabled />
    </div>
  ),
}
