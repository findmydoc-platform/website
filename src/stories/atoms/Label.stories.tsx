import type { Meta, StoryObj } from '@storybook/react-vite'
import { Label } from '@/components/atoms/label'
import { Input } from '@/components/atoms/input'

const meta = {
  title: 'Atoms/Label',
  component: Label,
  tags: ['autodocs'],
} satisfies Meta<typeof Label>

export default meta
type Story = StoryObj<typeof meta>

export const WithInput: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      <Label htmlFor="clinic-name">Clinic Name</Label>
      <Input id="clinic-name" placeholder="findmydoc Medical Center" />
    </div>
  ),
}

export const DisabledPeer: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      <Label htmlFor="disabled-input">Disabled field</Label>
      <Input id="disabled-input" placeholder="Cannot edit" disabled />
    </div>
  ),
}

export const TransformUppercase: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      <Label transform="uppercase" htmlFor="clinic-upper">
        Clinic Name
      </Label>
      <Input id="clinic-upper" placeholder="findmydoc Medical Center" />
    </div>
  ),
}

export const TransformCapitalize: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      <Label transform="capitalize" htmlFor="clinic-cap">
        clinic name
      </Label>
      <Input id="clinic-cap" placeholder="findmydoc Medical Center" />
    </div>
  ),
}
