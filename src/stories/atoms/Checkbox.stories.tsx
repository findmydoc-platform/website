import type { Meta, StoryObj } from '@storybook/react-vite'
import React from 'react'
import type { CheckedState } from '@radix-ui/react-checkbox'
import { Checkbox } from '@/components/atoms/checkbox'
import { Label } from '@/components/atoms/label'

const meta = {
  title: 'Atoms/Checkbox',
  component: Checkbox,
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

export const Indeterminate: Story = {
  render: (args) => {
    const Example = () => {
      const [checkedState, setCheckedState] = React.useState<CheckedState>('indeterminate')

      return (
        <CheckboxField {...args} checked={checkedState} onCheckedChange={(value) => setCheckedState(value ?? false)} />
      )
    }

    return <Example />
  },
}

export const Group: Story = {
  render: () => (
    <fieldset className="flex flex-col gap-3" aria-label="Specialties">
      <legend className="text-sm font-medium">Specialties</legend>
      {['Cardiology', 'Orthopedics', 'Dermatology'].map((label) => (
        <div key={label} className="flex items-center gap-3">
          <Checkbox id={label} value={label} defaultChecked={label === 'Cardiology'} />
          <Label htmlFor={label}>{label}</Label>
        </div>
      ))}
    </fieldset>
  ),
}
