import type { Meta, StoryObj } from '@storybook/react'
import { Checkbox } from '@/components/atoms/checkbox'
import { Label } from '@/components/atoms/label'

const meta = {
  title: 'Atoms/Checkbox',
  component: Checkbox,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    disabled: {
      control: 'boolean',
    },
    defaultChecked: {
      control: 'boolean',
    },
  },
} satisfies Meta<typeof Checkbox>

export default meta
type Story = StoryObj<typeof meta>

const CheckboxField = (props: React.ComponentProps<typeof Checkbox>) => (
  <div className="flex items-center gap-3">
    <Checkbox id="terms" {...props} />
    <Label htmlFor="terms">I accept the clinic terms</Label>
  </div>
)

export const Default: Story = {
  render: (args) => <CheckboxField {...args} />,
}

export const Checked: Story = {
  args: {
    defaultChecked: true,
  },
  render: (args) => <CheckboxField {...args} />,
}

export const Disabled: Story = {
  args: {
    disabled: true,
  },
  render: (args) => <CheckboxField {...args} />,
}
