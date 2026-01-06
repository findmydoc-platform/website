import React from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'

import { Combobox, type ComboboxOption } from '@/components/atoms/combobox'

const options: ComboboxOption[] = [
  { label: 'Backlog', value: 'backlog' },
  { label: 'Todo', value: 'todo' },
  { label: 'In Progress', value: 'in-progress' },
  { label: 'Done', value: 'done' },
  { label: 'Canceled', value: 'canceled' },
]

type ComboboxPreviewProps = {
  defaultValue: string
}

const ComboboxPreview: React.FC<ComboboxPreviewProps> = ({ defaultValue }) => {
  const [value, setValue] = React.useState(defaultValue)

  React.useEffect(() => {
    setValue(defaultValue)
  }, [defaultValue])

  return (
    <div>
      <Combobox
        options={options}
        value={value}
        onValueChange={setValue}
        placeholder="Select status"
        searchPlaceholder="Search status..."
      />
      <div className="text-muted-foreground mt-2 text-xs">Selected: {value || '(none)'}</div>
    </div>
  )
}

const meta = {
  title: 'Atoms/Combobox',
  component: ComboboxPreview,
  tags: ['autodocs'],
  argTypes: {
    defaultValue: {
      control: 'select',
      options: ['', ...options.map((o) => o.value)],
    },
  },
  args: {
    defaultValue: '',
  },
} satisfies Meta<typeof ComboboxPreview>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithDefaultValue: Story = {
  args: {
    defaultValue: 'in-progress',
  },
}
