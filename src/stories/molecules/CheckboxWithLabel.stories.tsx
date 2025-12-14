import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { useState } from 'react'
import { CheckboxWithLabel } from '@/components/molecules/CheckboxWithLabel'

const meta: Meta<typeof CheckboxWithLabel> = {
  title: 'Molecules/CheckboxWithLabel',
  component: CheckboxWithLabel,
}

export default meta

type Story = StoryObj<typeof CheckboxWithLabel>

export const Default: Story = {
  render: () => {
    const [checked, setChecked] = useState(false)

    return <CheckboxWithLabel label="Option" checked={checked} onCheckedChange={setChecked} />
  },
}

export const Disabled: Story = {
  args: {
    label: 'Option',
    checked: true,
    disabled: true,
  },
}
