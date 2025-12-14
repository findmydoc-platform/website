import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { useState } from 'react'
import { CheckboxGroup } from '@/components/molecules/CheckboxGroup'

const meta: Meta<typeof CheckboxGroup> = {
  title: 'Molecules/CheckboxGroup',
  component: CheckboxGroup,
}

export default meta

type Story = StoryObj<typeof CheckboxGroup>

export const Uncontrolled: Story = {
  args: {
    label: 'Sprachen',
    options: ['Deutsch', 'Englisch', 'Spanisch'],
    defaultValue: ['Deutsch'],
  },
}

export const Controlled: Story = {
  render: () => {
    const [value, setValue] = useState<string[]>(['Englisch'])

    return (
      <CheckboxGroup
        label="Sprachen"
        options={['Deutsch', 'Englisch', 'Spanisch']}
        value={value}
        onValueChange={setValue}
      />
    )
  },
}
